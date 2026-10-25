import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Catalogue, validerAlignement, validerManifeste } from '@janus/contrats'
import type { Manifeste, TypeEtape } from '@janus/contrats'
import {
  BLOCS_FIXES,
  blocsFixes,
  contenuDuBloc,
  enTeteDuPont,
  pontEmbarque,
  remplacerLeContenuDuBloc,
} from './assemblage.ts'
import type { BlocFixe, EnTetePont } from './assemblage.ts'
import { extraireManifeste } from './domaines/catalogue/composition.ts'
import { CHEMIN_REGLES, lireLesRegles, nomDeLaGrille, verifierGrille } from './grille.ts'
import type { RegleDeLaMethode } from './grille.ts'

/** Le dossier des fiches d'une formation, à côté de son catalogue : `contenu/<formation>/fiches/`. */
export const DOSSIER_FICHES = 'fiches'

/**
 * Le poids maximal d'une fiche, images et sons en `data:` compris (décision du 14 octobre 2026) :
 * au-delà, une fiche se charge mal sur un téléphone et se réduit après coup, au prix du contenu.
 */
export const TAILLE_MAX_FICHE = 5_000_000

export interface FicheDuDepot {
  /** Le chemin lisible : `dwwm/fiches/B01.html`. */
  readonly nom: string
  readonly chemin: string
  readonly html: string
}

/** Les fiches d'une formation, triées par nom, ou rien si le dossier n'existe pas. */
export async function lireLesFiches(
  dossierContenu: string,
  formation: string,
): Promise<readonly FicheDuDepot[]> {
  const dossier = join(dossierContenu, formation, DOSSIER_FICHES)
  let noms: string[]
  try {
    noms = (await readdir(dossier)).filter((nom) => nom.endsWith('.html')).sort()
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw cause
  }
  return Promise.all(
    noms.map(async (nom) => {
      const chemin = join(dossier, nom)
      return {
        nom: relative(dossierContenu, chemin),
        chemin,
        html: await readFile(chemin, 'utf8'),
      }
    }),
  )
}

/** Les codes de blocs que déclare un catalogue, toutes parties confondues. */
function codesDuCatalogue(json: unknown): ReadonlySet<string> {
  const catalogue = Catalogue.parse(json)
  return new Set(
    catalogue.modules.flatMap((leModule) =>
      leModule.importe ? leModule.parties.flatMap(({ blocs }) => blocs) : [],
    ),
  )
}

/** Les étapes dont le contenu vient d'un `<template data-etape="…">` de la page (gabarit : `afficherLibre`). */
const ETAPES_A_TEMPLATE: ReadonlySet<TypeEtape> = new Set<TypeEtape>([
  'perception',
  'pretest',
  'explication',
  'ensemble',
  'aisance',
])

/** Le HTML sans ses scripts ni ses commentaires : ce que la page affiche, où les templates se cherchent. */
function sansScriptsNiCommentaires(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
}

/** Le HTML sans la bibliothèque du pont (`<script id="pont">`), qui appartient à l'appli, ni ses commentaires. */
function sansPontNiCommentaires(html: string): string {
  return html
    .replace(/<script\s+id=["']pont["'][^>]*>[\s\S]*?<\/script>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

/** Les `<template data-etape="…">` et `<template data-item="…">` que la page affiche. */
function templatesDeLaPage(html: string): {
  etapes: ReadonlySet<string>
  items: ReadonlySet<string>
} {
  const etapes = new Set<string>()
  const items = new Set<string>()
  for (const [, attributs] of sansScriptsNiCommentaires(html).matchAll(/<template\b([^>]*)>/gi)) {
    const etape = /\bdata-etape\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const item = /\bdata-item\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    if (etape !== undefined) etapes.add(etape)
    if (item !== undefined) items.add(item)
  }
  return { etapes, items }
}

/**
 * Une étape à lire sans son template s'afficherait « Rien à lire dans cette étape », un item de
 * pratique sans son énoncé n'aurait pas de consigne : la page le tait, la vérification le dit.
 */
function verifierTemplates(
  manifeste: Manifeste,
  html: string,
  signaler: (message: string) => void,
): void {
  const { etapes, items } = templatesDeLaPage(html)
  for (const etape of manifeste.etapes) {
    if (ETAPES_A_TEMPLATE.has(etape.type) && !etapes.has(etape.id)) {
      signaler(
        `l’étape ${etape.id} (${etape.type}) n’a pas de <template data-etape="${etape.id}"> : la page afficherait « Rien à lire dans cette étape ».`,
      )
    }
  }
  for (const exercice of manifeste.pratique) {
    for (const item of exercice.items) {
      if (!items.has(item.id)) {
        signaler(
          `l’item ${item.id} n’a pas de <template data-item="${item.id}"> : l’apprenant n’aurait pas d’énoncé.`,
        )
      }
    }
  }
}

const ETATS_D_ESSAI: ReadonlySet<string> = new Set(['juste', 'faux', 'passe', 'absent'])

/**
 * Une explication qui part des essais (règle C03) renvoie à un essai de la fiche : `data-si-essai`
 * (« c2:faux|passe ») et `data-essai-rappel` (« c2 »). Un renvoi à un essai absent, ou à un état
 * que la page ne connaît pas, cacherait le paragraphe pour toujours : la vérification le dit.
 */
function verifierRenvoisAuxEssais(html: string, signaler: (message: string) => void): void {
  const page = sansScriptsNiCommentaires(html)
  const essais = new Set<string>()
  for (const [, attributs] of page.matchAll(
    /<[a-z][\w-]*\b([^>]*\bdata-essai\b(?![-=])[^>]*)>/gi,
  )) {
    const id = /\bdata-id\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    if (id !== undefined) essais.add(id)
  }
  for (const [, nom = '', valeur = ''] of page.matchAll(
    /\b(data-si-essai|data-essai-rappel)\s*=\s*["']([^"']*)["']/gi,
  )) {
    const [cle = '', etats] = nom === 'data-si-essai' ? valeur.split(':') : [valeur]
    if (!essais.has(cle)) {
      signaler(`${nom}="${valeur}" renvoie à l’essai ${cle}, qui n’est pas dans la fiche.`)
      continue
    }
    if (etats === undefined) {
      if (nom === 'data-si-essai')
        signaler(`${nom}="${valeur}" : l’état manque (juste, faux, passe ou absent après « : »).`)
      continue
    }
    for (const inconnu of etats.split('|').filter((e) => !ETATS_D_ESSAI.has(e)))
      signaler(
        `${nom}="${valeur}" : l’état « ${inconnu} » n’existe pas (juste, faux, passe ou absent).`,
      )
  }
}

/** Le texte de chaque `<template data-item="…">`, hors scripts et commentaires, par identifiant. */
function templatesDesItems(html: string): ReadonlyMap<string, string> {
  const items = new Map<string, string>()
  for (const [, id, corps] of sansScriptsNiCommentaires(html).matchAll(
    /<template\b[^>]*\bdata-item\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/template\s*>/gi,
  )) {
    if (id !== undefined) items.set(id, corps ?? '')
  }
  return items
}

/**
 * Leçons du B01 (AGENTS.md) : on n'explique que ce que l'écran ne montre pas, au plus un tiers des
 * items demandent une explication en prose (`data-justifier`) ; et chaque erreur critique a un item
 * de pratique qui la révèle (`data-erreur="E…"` sur l'option ou l'outil qui la repère), sinon elle
 * n'est vue qu'aux questions, trop tard pour la corriger en s'entraînant. Une explication demandée
 * se déclare au manifeste (`explication`, par sa clé : l'item, ou l'item suivi de `:variante`) : l'IA
 * la juge sur la question et l'attendu qu'elle y lit, et l'item n'est réussi qu'avec elle.
 */
function verifierPratique(
  manifeste: Manifeste,
  html: string,
  signaler: (message: string) => void,
): void {
  const templates = templatesDesItems(html)
  const ids = manifeste.pratique.flatMap((exercice) => exercice.items.map((item) => item.id))
  const avecExplication = ids.filter((id) => /\bdata-justifier\s*=/i.test(templates.get(id) ?? ''))
  const plafond = Math.ceil(ids.length / 3)
  const declarees = new Set(manifeste.explication.map(({ id }) => id))
  const demandees = new Set<string>()
  if (avecExplication.length > plafond) {
    signaler(
      `pratique : ${String(avecExplication.length)} items sur ${String(ids.length)} demandent une explication (data-justifier : ${avecExplication.join(', ')}), au plus un tiers (${String(plafond)}) : ce que l’écran montre déjà ne se demande pas.`,
    )
  }
  for (const [, genre, id, corps] of sansScriptsNiCommentaires(html).matchAll(
    /<template\b[^>]*\bdata-(item|variante)\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/template\s*>/gi,
  )) {
    // Un choix sans crans écrits n'aurait que la solution après ses réponses fausses (règle F03).
    // Chaque réponse fausse retire une option, et un cran attend une réponse fausse (F04) : les crans
    // utiles sont ceux qu'on atteint avant qu'il ne reste qu'une option, un au moins, trois au plus.
    const choix = Array.from(
      (corps ?? '').matchAll(/<[a-z][^>]*\bdata-widget\s*=\s*["']choix["'][^>]*>/gi),
      ([balise]) => balise,
    )
    const options = ((corps ?? '').match(/\bdata-option\s*=/gi) ?? []).length
    for (const balise of choix) {
      const attendus = Math.min(3, Math.max(1, Math.round(options / choix.length) - 2))
      const manquent = ['data-aide1', 'data-aide2', 'data-aide3']
        .slice(0, attendus)
        .filter((nom) => !new RegExp(`\\b${nom}\\s*=\\s*["'][^"']`, 'i').test(balise))
      if (manquent.length > 0) {
        signaler(
          `pratique : ${genre === 'variante' ? 'la variante de ' : 'l’item '}${String(id)} a un choix sans ses coups de pouce (${manquent.join(', ')} ${manquent.length > 1 ? 'manquent' : 'manque'}) : après une réponse fausse, l’apprenant n’aurait que la solution (règle F03).`,
        )
      }
    }
    const qui = `${genre === 'variante' ? 'la variante de ' : 'l’item '}${String(id)}`
    for (const [balise] of (corps ?? '').matchAll(/<[a-z][^>]*\bdata-justifier\s*=[^>]*>/gi)) {
      const cle = `${String(id)}${genre === 'variante' ? ':variante' : ''}`
      demandees.add(cle)
      if (!declarees.has(cle)) {
        signaler(
          `pratique : ${qui} demande une explication (data-justifier) que le manifeste ne déclare pas : ajoute à explication la clé « ${cle} », sa question et son attendu, que l’IA lit pour la juger.`,
        )
      }
      if (/\bdata-fiche\s*=/i.test(balise)) {
        signaler(
          `pratique : ${qui} porte data-fiche : l’attendu d’une explication est dans le manifeste (explication), que l’IA lit pour la juger.`,
        )
      }
    }
  }
  for (const explication of manifeste.explication) {
    if (!demandees.has(explication.id)) {
      signaler(
        `explication « ${explication.id} » : ni l’item ${explication.item} ni sa variante ne la demandent (data-justifier) : l’IA jugerait une explication que la page ne pose pas.`,
      )
    }
  }
  for (const erreur of manifeste.erreurs_critiques) {
    const motif = new RegExp(`\\bdata-erreur\\s*=\\s*["']${erreur.id}["']`, 'i')
    if (!ids.some((id) => motif.test(templates.get(id) ?? ''))) {
      signaler(
        `l’erreur critique ${erreur.id} n’a aucun item de pratique qui la révèle (data-erreur="${erreur.id}" dans un <template data-item>) : elle ne serait repérée qu’aux questions.`,
      )
    }
  }
}

/** Une erreur critique se rattache à l'étape d'explication qui la montre : c'est là que le bilan renvoie. */
function verifierErreursCritiques(manifeste: Manifeste, signaler: (message: string) => void): void {
  for (const erreur of manifeste.erreurs_critiques) {
    const etape = manifeste.etapes.find((e) => e.id === erreur.etape)
    if (etape !== undefined && etape.type !== 'explication') {
      signaler(
        `l’erreur critique ${erreur.id} est rattachée à ${etape.id} (${etape.type}) : elle se rattache à l’étape d’explication qui la montre, celle où l’apprenant retourne depuis le bilan.`,
      )
    }
  }
}

/** Une phrase qui demande quelque chose : une question, ou un ordre (« Écris… », « Puis explique… »). */
const DEMANDE =
  /^(?:puis\s+)?(?:écris|dis|explique|donne|calcule|traduis|trace|transcris|corrige|trouve|compare|décris|nomme|cite|justifie|montre|convertis|lis|relis|complète|adapte|remets|remplis|propose|indique|précise|réponds|choisis|range|fais|décode|encode|dessine|retrouve|vérifie)\b/i

/** Combien de choses une question demande : ses phrases interrogatives et ses ordres. */
function sousQuestions(question: string): number {
  return question
    .split(/(?<=[.?!])\s+/)
    .filter((phrase) => phrase.endsWith('?') || DEMANDE.test(phrase)).length
}

/**
 * Une question de restitution, une tâche, deux sous-questions au plus (leçons du B01) : au-delà,
 * l'apprenant répond à la première et oublie les autres, et le correcteur note un manque qui n'en
 * est pas un.
 */
/**
 * Le cycle commence par percevoir (règles C01 et C02) : une carte placée avant la perception dit ce
 * que le pari demande de deviner (son objectif, ce que l'apprenant saura faire). B01 et B02 l'ont
 * fait sans que rien ne le refuse, alors qu'AGENTS.md donnait déjà l'ordre.
 */
function verifierOrdreDuCycle(manifeste: Manifeste, signaler: (message: string) => void): void {
  const perception = manifeste.etapes.findIndex((etape) => etape.type === 'perception')
  if (perception === -1) return
  for (const etape of manifeste.etapes.slice(0, perception)) {
    if (etape.type === 'carte') {
      signaler(
        `la carte ${etape.id} vient avant la perception ${manifeste.etapes[perception]?.id ?? ''} : le bloc s’ouvre sur la perception et son pari, la carte vient après (règles C01 et C02).`,
      )
    }
  }
}

function verifierRestitution(manifeste: Manifeste, signaler: (message: string) => void): void {
  for (const question of manifeste.restitution) {
    const n = sousQuestions(question.question)
    if (n > 2) {
      signaler(
        `restitution ${question.id} : la question demande ${String(n)} choses ; une question de restitution, une tâche, deux sous-questions au plus.`,
      )
    }
  }
}

/**
 * Une adresse qui sort de la page (`http(s)://…` ou `//…`) là où le navigateur la chargerait ou la
 * suivrait : un attribut `src`, `href`, `srcset`, `poster`, `action`, `formaction`, `data` ou `ping`,
 * un `url()` de CSS, un `@import`. `data-lien` n'en fait pas partie : c'est l'appli qui ouvre ces liens.
 */
const ADRESSE_EXTERNE =
  /(?:(?<![\w-])(?:src|href|srcset|poster|action|formaction|data|ping)\s*=\s*["']?\s*|\burl\(\s*["']?\s*|@import\s+(?:url\(\s*)?["']?\s*)((?:https?:)?\/\/[^\s"')>]+)/gi

/** La fiche n'a aucun accès réseau (section « Pont » du cadrage, et la CSP de son origine coupe tout) : rien d'externe. */
function verifierAdressesExternes(html: string, signaler: (message: string) => void): void {
  const vues = new Set<string>()
  for (const [, adresse] of sansPontNiCommentaires(html).matchAll(ADRESSE_EXTERNE)) {
    if (adresse === undefined || vues.has(adresse)) continue
    vues.add(adresse)
    signaler(
      `une adresse externe est chargée ou liée (${adresse}) : la fiche n’a aucun accès réseau, embarque le fichier en data: ; un lien vers un site s’écrit <a data-lien="https://…">.`,
    )
  }
}

/**
 * Une fiche se suffit à elle-même (Amine, 14 octobre 2026) : un cours sert à tracer le chemin et à fixer
 * l'objectif, jamais de lecture obligée. Ni la page ni le manifeste (que lit le correcteur) ne renvoient
 * donc à un support extérieur. La liste reprend les renvois déjà trouvés dans une fiche et s'allonge à
 * chaque nouveau ; elle ne remplace pas l'épreuve de l'apprenant neuf (LISEZ-MOI du gabarit).
 */
const RENVOIS_A_UN_COURS: readonly RegExp[] = [
  /\bStudi\b/gi,
  /\bcorrigé officiel\b/gi,
  /\bsolution\s+n[°o]\s*\d+/gi,
  /\bpages\s+\d+/gi,
  /\bp\.\s?\d+/gi,
  /\bP\d+\.\d+\b/g,
]

/** Chaque texte du manifeste, avec son chemin (`sources[0].titre`), dans l'ordre du fichier. */
function textesDuManifeste(
  valeur: unknown,
  chemin: string,
  rendre: (chemin: string, texte: string) => void,
): void {
  if (typeof valeur === 'string') rendre(chemin, valeur)
  else if (Array.isArray(valeur))
    valeur.forEach((element, index) => {
      textesDuManifeste(element, `${chemin}[${String(index)}]`, rendre)
    })
  else if (typeof valeur === 'object' && valeur !== null)
    for (const [cle, element] of Object.entries(valeur))
      textesDuManifeste(element, chemin === '' ? cle : `${chemin}.${cle}`, rendre)
}

function verifierRenvoisAuxCours(
  manifeste: Manifeste,
  html: string,
  codes: ReadonlySet<string>,
  signaler: (message: string) => void,
): void {
  const chercher = (texte: string, ou: string) => {
    const vus = new Set<string>()
    for (const motif of RENVOIS_A_UN_COURS) {
      for (const [trouve] of texte.matchAll(motif)) {
        if (vus.has(trouve)) continue
        vus.add(trouve)
        signaler(
          `la fiche renvoie à un support extérieur (« ${trouve} » dans ${ou}) : une fiche se suffit à elle-même, un cours ne sert qu’à fixer l’objectif et à vérifier les faits.`,
        )
      }
    }
  }
  // B02 v33 : « comme la table hexadécimale en B01 » dans `contexte_ia`. Le code d'un autre bloc du
  // catalogue est un code du plan ; le manifeste ne nomme que son bloc et ses prérequis (`bloc`, `prerequis`).
  const autreBloc = (texte: string, ou: string) => {
    for (const [code] of texte.matchAll(/(?<![\w-])[A-Z]\d{2}(?![\w-])/g)) {
      if (code === manifeste.bloc || !codes.has(code)) continue
      signaler(
        `la fiche nomme un autre bloc par son code (« ${code} » dans ${ou}) : redonne ce qu’il faut sur place, sans renvoi au plan.`,
      )
    }
  }
  const page = sansScriptsNiCommentaires(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  chercher(page, 'le texte affiché')
  autreBloc(page, 'le texte affiché')
  textesDuManifeste(manifeste, '', (chemin, texte) => {
    chercher(texte, chemin)
    if (chemin !== 'bloc' && !chemin.startsWith('prerequis')) autreBloc(texte, chemin)
  })
}

/**
 * Ce que l'apprenant lit ne laisse pas passer la conception (Amine, 25 octobre 2026) : les onglets n'ont
 * pas de numéro, donc « l'étape 3 » ne mène nulle part (on nomme l'onglet : « À l'intuition ») ; et
 * « Avant de lire la suite : » était une étiquette de conception, pas une question. Le contexte du
 * correcteur (`contexte_ia`) et les notes de conception (`<template data-conception>`) restent libres.
 * Les attendus aussi : leur texte est haché dans l'identifiant de la question, et tout ce qui les montre
 * ou les lit (correcteur IA, correction affichée, mode autonome de la fiche) passe par `etapesEnMots`.
 */
const COULISSES: readonly { motif: RegExp; pourquoi: string }[] = [
  {
    motif: /(?<![\p{L}\p{N}])étapes?\s+\d+/giu,
    pourquoi: 'les onglets n’ont pas de numéro : nomme l’onglet, par exemple « À l’intuition »',
  },
  {
    motif: /\bAvant de lire\b[^:?.]*/gu,
    pourquoi: 'c’est une étiquette de conception : pose directement la question',
  },
  {
    // B02 v33 (25 octobre 2026) : « Image : … », « Sa limite : … », « Les limites de l'image »
    // recopiaient le patron de la méthode (image, mécanisme, terme, limite de l'image, règle C05).
    // Une étiquette en tête de bloc, pas « la hauteur de l’image : … » au fil d'une phrase ; puis
    // « L’image a sa limite : » (B02) et « La chaîne a sa limite : » (B01), la même étiquette en phrase.
    motif:
      /(?<=(?:>|[.!?])\s*)(?:image|sa limite)\s*:|limites? de l[’']image|\ba\s+(?:sa|ses)\s+limites?\s*:/giu,
    pourquoi:
      'c’est le vocabulaire de la méthode : dis l’image et sa limite en langue naturelle (« Pour te le représenter : », « Ce que les interrupteurs ne montrent pas »)',
  },
  {
    // B02 v33 : un script d'édition a laissé deux fois « RAW: » devant un paragraphe affiché.
    motif: /\bRAW:/gu,
    pourquoi: 'c’est un reste d’un script d’édition : retire-le',
  },
]

function verifierCoulisses(
  manifeste: Manifeste,
  html: string,
  signaler: (message: string) => void,
): void {
  const chercher = (texte: string, ou: string) => {
    for (const { motif, pourquoi } of COULISSES) {
      const vus = new Set<string>()
      for (const [trouve] of texte.matchAll(motif)) {
        const net = trouve.replace(/\s+/g, ' ').trim()
        if (vus.has(net)) continue
        vus.add(net)
        signaler(
          `le texte de l’apprenant laisse voir la conception (« ${net} » dans ${ou}) : ${pourquoi}.`,
        )
      }
    }
  }
  chercher(
    sansScriptsNiCommentaires(html)
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<template\b[^>]*\bdata-conception\b[^>]*>[\s\S]*?<\/template>/gi, ''),
    'le texte affiché',
  )
  textesDuManifeste(manifeste, '', (chemin, texte) => {
    if (chemin !== 'contexte_ia' && !/(^|\.)attendu$/.test(chemin)) chercher(texte, chemin)
  })
}

/**
 * Une question ne dit pas la règle qu'elle vérifie ni le résultat qu'elle attend (B02 v33, passes 11
 * à 13) : « explique ce qui les fait différer », « pourquoi sa réponse change-t-elle ? », « n'a pas
 * besoin de dire », « qu'est-ce qu'il confond ? » donnaient la réponse à celui qui a l'erreur qu'on
 * cherche. La liste reprend les tournures trouvées et s'allonge à chaque nouvelle.
 */
const PRESUPPOSES: readonly RegExp[] = [
  /\bdiffèrent\b/giu,
  /\bdifférer\b/giu,
  /\bchange-t-(?:il|elle)\b/giu,
  /\bn[’']a pas besoin de\b/giu,
  /\bqu[’']est-ce qu[’'](?:il|elle) confond\b/giu,
  /\bpourquoi une seule\b/giu,
  /\bmais pas les deux\b/giu,
]

function verifierPresupposes(
  manifeste: Manifeste,
  html: string,
  signaler: (message: string) => void,
): void {
  const chercher = (texte: string, ou: string) => {
    for (const motif of PRESUPPOSES)
      for (const [trouve] of texte.matchAll(motif))
        signaler(
          `la question souffle sa réponse (« ${trouve} » dans ${ou}) : demande le résultat sans le dire, par exemple « donnent-elles le même résultat ? Pourquoi ? ».`,
        )
  }
  textesDuManifeste(manifeste, '', (chemin, texte) => {
    if (/\.(?:question|consigne|recto)$/.test(chemin)) chercher(texte, chemin)
  })
  for (const [, texte = ''] of html.matchAll(/\bdata-justifier="([^"]*)"/g))
    chercher(texte, 'data-justifier')
}

/**
 * Un texte nu entre deux blocs n'a été écrit pour personne : « RAW: » restait affiché entre deux
 * paragraphes de B02 version 33, et « Écouter » le lisait. Le texte de l'apprenant est dans un bloc.
 */
const BLOC = 'p|div|pre|ul|ol|table|h[1-6]|figure|details|section|blockquote'

function verifierTexteNu(html: string, signaler: (message: string) => void): void {
  const page = sansScriptsNiCommentaires(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  const nu = new RegExp(
    `</(?:${BLOC})>\\s*([^<\\s][^<]*?)\\s*<(?:/?(?:${BLOC})|/template)\\b`,
    'gi',
  )
  for (const [, texte = ''] of page.matchAll(nu)) {
    signaler(
      `le texte « ${texte.replace(/\s+/g, ' ').slice(0, 60)} » est posé entre deux blocs, hors de tout paragraphe : retire-le, ou mets-le dans le paragraphe qu’il complète.`,
    )
  }
}

/**
 * Un écran se résout avec ce qu'il montre (Amine, 25 octobre 2026) : « Pour la chaîne des médailles,
 * bien rangée, quelles sont les valeurs limites ? » demandait de se souvenir des seuils d'un autre
 * écran. Pour un exercice qui calcule sur des données (`data-chaine`, `data-expr`, `data-variable`),
 * chaque nombre et chaque variable se lit dans le texte de son écran (ou de son item), hors attributs.
 */
function verifierDonneesALEcran(html: string, signaler: (message: string) => void): void {
  const texte = (morceau: string) =>
    morceau
      .replace(/<[^>]+>/g, ' ')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
  const modeles = sansScriptsNiCommentaires(html).matchAll(
    /<template\b[^>]*\bdata-(etape|item)\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/template>/gi,
  )
  for (const [, sorte = '', id = '', contenu = ''] of modeles) {
    // Les écrans sont frères : chacun va de son ouverture à celle du suivant.
    const debuts = [...contenu.matchAll(/<div\b[^>]*\bdata-ecran\s*=/gi)].map(({ index }) => index)
    const ecrans =
      debuts.length === 0
        ? [contenu]
        : debuts.map((debut, k) => contenu.slice(debut, debuts[k + 1] ?? contenu.length))
    for (const ecran of ecrans) {
      const titre = /\bdata-ecran\s*=\s*"([^"]*)"/.exec(ecran)?.[1]
      const ou = sorte === 'item' ? `l’item ${id}` : `${id}${titre ? `, écran « ${titre} »` : ''}`
      const visible = texte(ecran)
      for (const [balise] of ecran.matchAll(/<div\b(?=[^>]*\bclass\s*=\s*"ex")[^>]*>/gi)) {
        const attribut = (nom: string) =>
          new RegExp(`\\b${nom}\\s*=\\s*"([^"]*)"`).exec(balise)?.[1]
        const exercice = attribut('data-id') ?? attribut('data-widget') ?? 'un exercice'
        const manque = new Set<string>()
        for (const nom of ['data-chaine', 'data-expr']) {
          for (const [nombre] of texte(attribut(nom) ?? '').matchAll(/\d+(?:[.,]\d+)?/g)) {
            if (!new RegExp(`(?<![\\d.,])${nombre.replace(/[.,]/g, '[.,]')}(?!\\d)`).test(visible))
              manque.add(nombre)
          }
        }
        const variable = attribut('data-variable')
        if (
          variable &&
          !new RegExp(`(?<![\\p{L}\\p{N}_])${variable}(?![\\p{L}\\p{N}_])`, 'u').test(visible)
        )
          manque.add(variable)
        if (manque.size > 0) {
          signaler(
            `${ou} : l’exercice ${exercice} calcule sur ${[...manque].join(', ')}, que son écran ne montre pas : redonne la donnée sur l’écran (la chaîne, la règle en mots), l’apprenant ne la cherche pas ailleurs.`,
          )
        }
      }
    }
  }
}

/** Un texte ramené à ce qui se compare : casse, espaces (insécables compris) et apostrophes mises à part. */
function pourComparer(texte: string): string {
  return texte
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\\u00a0/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (chiffre) => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(chiffre)))
    .replace(/[\s\u00a0\u202f]+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * La grille décrit vrai (25 octobre 2026) : ce qu'une ligne « appliquée » cite entre « » se lit dans la
 * page, outils et gabarit compris. Une citation périmée (la page a changé, la grille non) laisse croire
 * qu'une règle est tenue. Une coupure se marque « … » ou « […] » : chaque morceau doit s'y lire.
 */
export function verifierCitationsDeLaGrille(
  grille: string,
  html: string,
  signaler: (message: string) => void,
): void {
  // Le texte entre les balises (un exposant <sup> collé à son nombre), et les attributs tels quels :
  // coups de pouce, retours, titres d'écran, textes des outils.
  const page = [html.replace(/<[^>]+>/g, ' '), html.replace(/<[^>]+>/g, ''), html]
    .map(pourComparer)
    .join('\n')
  grille.split(/\r?\n/).forEach((ligne, index) => {
    if (!ligne.trim().startsWith('|') || !/\|\s*appliquée\s*\|/i.test(ligne)) return
    for (const [, cite = ''] of ligne.matchAll(/«\s*([^«»]+?)\s*»/g)) {
      const morceaux = cite
        .split(/\[…\]|…|\.\.\./)
        .map((morceau) => pourComparer(morceau))
        .filter((morceau) => morceau.length > 0)
      if (morceaux.every((morceau) => page.includes(morceau))) continue
      signaler(
        `grille : la ligne ${String(index + 1)} cite « ${cite.trim()} », qui ne se lit plus dans la page : une citation dit ce que l’apprenant voit, recopie-la de la page ou coupe-la par « … ».`,
      )
    }
  })
}

/** Le texte JSON d'un `<script type="application/json" id="…">` de la page. */
export function blocJson(html: string, id: string): string | undefined {
  for (const [, attributs, contenu] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const identifiant = /\bid\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    if (type === 'application/json' && identifiant === id) return contenu
  }
  return undefined
}

/** Le tableau d'alignement (`<script id="alignement">`) confronté au manifeste : voir `validerAlignement`. */
function verifierAlignement(
  manifeste: Manifeste,
  html: string,
  signaler: (message: string) => void,
): void {
  const texte = blocJson(html, 'alignement')
  if (texte === undefined) {
    signaler(
      'pas de tableau d’alignement (<script type="application/json" id="alignement">) : il se remplit avant la fiche, voir « Créer la fiche d’un bloc » dans le LISEZ-MOI du gabarit.',
    )
    return
  }
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    signaler('le tableau d’alignement n’est pas du JSON valide.')
    return
  }
  for (const { chemin, message } of validerAlignement(brut, manifeste)) {
    signaler(chemin === '' ? `alignement : ${message}` : `alignement.${chemin} : ${message}`)
  }
}

/** Texte comparé sans tenir compte de la casse ni des espaces en trop, comme dans le validateur. */
function normaliserTexte(texte: string): string {
  return texte.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Les textes qui font le sens d'une question, par liste et identifiant : la question (ou la consigne) et l'attendu. */
function textesDesQuestions(manifeste: Manifeste): ReadonlyMap<string, string> {
  const textes = new Map<string, string>()
  const poser = <T extends { readonly id: string; readonly attendu: string }>(
    liste: readonly T[],
    nom: string,
    enonce: (element: T) => string,
  ) => {
    for (const element of liste) {
      textes.set(
        `${nom} ${element.id}`,
        `${normaliserTexte(enonce(element))}\n${normaliserTexte(element.attendu)}`,
      )
    }
  }
  poser(manifeste.restitution, 'restitution', (q) => q.question)
  poser(manifeste.rappel, 'rappel', (q) => q.question)
  poser(manifeste.differees, 'differees', (d) => d.consigne)
  return textes
}

/**
 * Les identifiants sont stables (cadrage) : les réponses déjà données s'y rattachent. Une question dont
 * le texte change sous le même identifiant est refusée ; elle reçoit un nouvel identifiant, l'ancien
 * reste en base pour l'historique. Ajouter ou retirer une question ne change rien aux autres.
 */
function verifierIdentifiantsStables(
  avant: Manifeste,
  apres: Manifeste,
  signaler: (message: string) => void,
): void {
  const anciens = textesDesQuestions(avant)
  for (const [cle, texte] of textesDesQuestions(apres)) {
    const ancien = anciens.get(cle)
    if (ancien === undefined || ancien === texte) continue
    const [nom, id] = cle.split(' ')
    signaler(
      `la question ${id ?? ''} (${nom ?? ''}) a changé de texte sous le même identifiant : une question dont le sens change reçoit un nouvel identifiant, l’ancien reste en base pour l’historique.`,
    )
  }
}

/**
 * Le pont embarqué doit être celui du dépôt : même version du contrat que le manifeste (`pont`) et
 * même empreinte que le pont construit. Sinon la fiche parlerait à l'appli dans une langue d'hier.
 */
function verifierLePont(
  embarque: string,
  pontDuManifeste: number,
  attendu: EnTetePont,
  signaler: (message: string) => void,
): void {
  const enTete = enTeteDuPont(embarque)
  if (enTete === undefined) {
    signaler(
      'le pont embarqué n’a pas d’en-tête « /*! janus-pont … */ » : relance `pnpm fiches:assembler --forcer`, puis augmente la version du manifeste.',
    )
    return
  }
  if (enTete.version !== pontDuManifeste) {
    signaler(
      `le manifeste déclare pont ${String(pontDuManifeste)} mais le pont embarqué est en version ${String(enTete.version)} : mets pont à ${String(enTete.version)} dans le manifeste.`,
    )
  }
  if (enTete.empreinte !== attendu.empreinte) {
    signaler(
      `le pont embarqué (${enTete.empreinte.slice(0, 8)}…) n’est pas celui du dépôt (${attendu.empreinte.slice(0, 8)}…) : relance \`pnpm fiches:assembler --forcer\`, puis augmente la version du manifeste.`,
    )
  }
}

/**
 * Les blocs fixes (polices, feuille de style, plomberie) sont ceux du gabarit, octet pour octet : une
 * fiche n'y touche pas, ce qui lui est propre va dans `<style id="styles-bloc">` et `<script id="outils-bloc">`.
 */
function verifierBlocsFixes(
  html: string,
  attendus: ReadonlyMap<BlocFixe, string>,
  signaler: (message: string) => void,
): void {
  for (const [id, attendu] of attendus) {
    const contenu = contenuDuBloc(html, id)
    if (contenu === undefined) {
      signaler(
        `le bloc fixe id="${id}" du gabarit manque : reprends ses balises, relance \`pnpm fiches:assembler --forcer\`, puis augmente la version du manifeste.`,
      )
    } else if (contenu !== attendu) {
      signaler(
        `le bloc fixe id="${id}" n’est pas celui du gabarit : ce qui est propre à la fiche va dans <style id="styles-bloc"> ou <script id="outils-bloc"> ; relance \`pnpm fiches:assembler --forcer\`, puis augmente la version du manifeste.`,
      )
    }
  }
}

/** Ce que `fiches:assembler --forcer` réécrit dans une fiche : les blocs fixes du gabarit et le pont. */
const BLOCS_REECRITS_A_L_ASSEMBLAGE: readonly string[] = [...BLOCS_FIXES, 'pont']

/**
 * La fiche sans ce qu'un réassemblage change : les blocs fixes et le pont vidés, la version du manifeste
 * ramenée à zéro. Deux fiches égales ainsi n'ont rien de différent à montrer à l'apprenant : la grille
 * de la méthode n'a pas à se refaire entre elles.
 */
function sansCeQueLAssemblageReecrit(html: string): string {
  let resultat = html
  for (const id of BLOCS_REECRITS_A_L_ASSEMBLAGE) {
    resultat = remplacerLeContenuDuBloc(resultat, id, () => '')
  }
  return remplacerLeContenuDuBloc(resultat, 'bloc-manifest', (texte) => {
    try {
      const manifeste: unknown = JSON.parse(texte)
      if (typeof manifeste !== 'object' || manifeste === null) return texte
      return JSON.stringify({ ...manifeste, version: 0 })
    } catch {
      return texte
    }
  })
}

/** Le contenu d'un fichier facultatif, ou `undefined` s'il n'existe pas ; toute autre erreur remonte. */
async function lireSiPresent(chemin: string): Promise<string | undefined> {
  try {
    return await readFile(chemin, 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw cause
  }
}

/** Le gabarit d'une formation (`contenu/<formation>/gabarit/fiche.html`), ou `undefined` si elle n'en a pas. */
export function lireLeGabarit(
  dossierContenu: string,
  formation: string,
): Promise<string | undefined> {
  return lireSiPresent(join(dossierContenu, formation, 'gabarit', 'fiche.html'))
}

/**
 * Les règles de la méthode d'une formation (`methode/regles.json`), par identifiant. Sans ce fichier,
 * la formation n'exige pas de grille ; s'il ne se lit pas, un seul problème le dit pour la formation et
 * aucune grille n'est contrôlée : on ne juge pas les fiches à l'aune de règles qu'on ne lit pas.
 */
async function reglesDeLaMethode(
  dossierContenu: string,
  formation: string,
  signaler: (message: string) => void,
): Promise<ReadonlyMap<string, RegleDeLaMethode> | undefined> {
  const texte = await lireSiPresent(join(dossierContenu, formation, CHEMIN_REGLES))
  if (texte === undefined) return undefined
  const lecture = lireLesRegles(texte)
  if (!lecture.ok) {
    signaler(lecture.probleme)
    return undefined
  }
  return lecture.regles
}

export interface OptionsVerification {
  /** Le dossier `contenu/` du dépôt. */
  readonly dossierContenu: string
  /** Le code du pont construit (`packages/pont/dist/pont.js`), avec son en-tête ; absent, le pont embarqué n'est pas comparé. */
  readonly pont?: string
  /**
   * Le contenu d'une fiche à une révision de référence (la branche de base), ou `undefined` si elle
   * n'y existait pas. Sert à refuser un contenu modifié sans que la version du manifeste change, et
   * à exiger la grille de la méthode d'une fiche nouvelle ou modifiée.
   */
  readonly contenuDeReference?: (nom: string) => string | undefined
}

/**
 * Vérifie les fiches du dépôt comme l'API le fera au démarrage, mais avant la fusion :
 * une fiche refusée au démarrage arrêterait l'API en production.
 * Rend tous les problèmes d'un coup, un par ligne.
 */
export async function verifierLesFiches({
  dossierContenu,
  pont,
  contenuDeReference,
}: OptionsVerification): Promise<string[]> {
  const problemes: string[] = []
  const pontAttendu = pont === undefined ? undefined : enTeteDuPont(pont)
  if (pont !== undefined && pontAttendu === undefined) {
    throw new Error(
      'Le pont construit n’a pas d’en-tête « /*! janus-pont … */ » : reconstruis-le (`pnpm --filter @janus/pont build`).',
    )
  }
  const formations = (await readdir(dossierContenu, { withFileTypes: true }))
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name)
    .sort()

  for (const formation of formations) {
    const fiches = await lireLesFiches(dossierContenu, formation)
    if (fiches.length === 0) continue
    const codes = codesDuCatalogue(
      JSON.parse(await readFile(join(dossierContenu, formation, 'catalogue.json'), 'utf8')),
    )
    const gabarit = await lireLeGabarit(dossierContenu, formation)
    const fixes = gabarit === undefined ? undefined : blocsFixes(gabarit)
    const regles = await reglesDeLaMethode(dossierContenu, formation, (message) =>
      problemes.push(`${formation}/${CHEMIN_REGLES} : ${message}`),
    )
    const vues = new Map<string, string>()
    for (const fiche of fiches) {
      const signaler = (message: string) => problemes.push(`${fiche.nom} : ${message}`)
      const taille = Buffer.byteLength(fiche.html, 'utf8')
      if (taille > TAILLE_MAX_FICHE) {
        signaler(
          `la fiche pèse ${(taille / 1_000_000).toFixed(1)} Mo, plus que les ${String(TAILLE_MAX_FICHE / 1_000_000)} Mo autorisés : allège les images et les sons embarqués en data:.`,
        )
      }
      if (fixes !== undefined) verifierBlocsFixes(fiche.html, fixes, signaler)
      const embarque = pontEmbarque(fiche.html)
      if (embarque === undefined) {
        signaler('le pont de l’appli n’est pas dans la fiche : lance `pnpm fiches:assembler`.')
      }
      const texte = extraireManifeste(fiche.html)
      if (texte === undefined) {
        signaler('aucun manifeste (<script type="application/json" id="bloc-manifest">).')
        continue
      }
      let brut: unknown
      try {
        brut = JSON.parse(texte)
      } catch {
        signaler('le manifeste n’est pas du JSON valide.')
        continue
      }
      const resultat = validerManifeste(brut)
      if (!resultat.ok) {
        for (const { chemin, message } of resultat.problemes)
          signaler(chemin === '' ? message : `${chemin} : ${message}`)
        continue
      }
      const { bloc, version } = resultat.manifeste
      if (!fiche.nom.endsWith(`/${bloc}.html`)) {
        signaler(`le fichier doit s’appeler ${bloc}.html (le manifeste est celui de ${bloc}).`)
      }
      if (!codes.has(bloc)) {
        signaler(`le bloc ${bloc} n’est pas dans le catalogue de ${formation}.`)
      }
      const autre = vues.get(bloc)
      if (autre !== undefined) signaler(`le bloc ${bloc} a déjà sa fiche : ${autre}.`)
      vues.set(bloc, fiche.nom)
      if (embarque !== undefined && pontAttendu !== undefined) {
        verifierLePont(embarque, resultat.manifeste.pont, pontAttendu, signaler)
      }
      verifierTemplates(resultat.manifeste, fiche.html, signaler)
      verifierPratique(resultat.manifeste, fiche.html, signaler)
      verifierErreursCritiques(resultat.manifeste, signaler)
      verifierRestitution(resultat.manifeste, signaler)
      verifierOrdreDuCycle(resultat.manifeste, signaler)
      verifierAdressesExternes(fiche.html, signaler)
      verifierRenvoisAuxEssais(fiche.html, signaler)
      verifierRenvoisAuxCours(resultat.manifeste, fiche.html, codes, signaler)
      verifierCoulisses(resultat.manifeste, fiche.html, signaler)
      verifierTexteNu(fiche.html, signaler)
      verifierPresupposes(resultat.manifeste, fiche.html, signaler)
      verifierDonneesALEcran(fiche.html, signaler)
      verifierAlignement(resultat.manifeste, fiche.html, signaler)

      const avant = contenuDeReference?.(fiche.nom)
      if (regles !== undefined) {
        const grille = await lireSiPresent(
          join(dossierContenu, formation, DOSSIER_FICHES, nomDeLaGrille(bloc)),
        )
        if (grille !== undefined) {
          verifierGrille(grille, regles, resultat.manifeste, signaler)
          verifierCitationsDeLaGrille(grille, fiche.html, signaler)
        } else if (
          contenuDeReference !== undefined &&
          (avant === undefined ||
            sansCeQueLAssemblageReecrit(avant) !== sansCeQueLAssemblageReecrit(fiche.html))
        ) {
          // Nouvelle (pas de référence) ou modifiée : la grille se refait avec la fiche. Un simple
          // réassemblage (blocs fixes, pont, version) ne montre rien de neuf à l'apprenant : rien à
          // refaire. Sans référence (lancement local sans `--base`), on ne sait pas si la fiche a
          // changé : rien.
          signaler(
            `pas de grille de la méthode (${nomDeLaGrille(bloc)}) : une fiche nouvelle ou modifiée ne se fusionne pas sans sa grille, une ligne par règle de ${CHEMIN_REGLES} (« Concevoir une fiche » dans AGENTS.md).`,
          )
        }
      }
      if (avant !== undefined && avant !== fiche.html) {
        const ancienne = validerManifeste(JSON.parse(extraireManifeste(avant) ?? 'null'))
        if (ancienne.ok && ancienne.manifeste.version === version) {
          signaler(
            `le contenu a changé mais la version ${String(version)} du manifeste est la même : incrémente-la, sinon l’API refuse la fiche au démarrage.`,
          )
        }
        if (ancienne.ok)
          verifierIdentifiantsStables(ancienne.manifeste, resultat.manifeste, signaler)
      }
    }
  }
  return problemes
}

/** Le contenu d'un fichier du dépôt à une révision git, ou `undefined` s'il n'y existait pas. */
export function contenuGit(
  racineDepot: string,
  revision: string,
  chemin: string,
): string | undefined {
  try {
    return execFileSync('git', ['show', `${revision}:${chemin}`], {
      cwd: racineDepot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return undefined
  }
}
