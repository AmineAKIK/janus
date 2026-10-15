import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Catalogue, validerAlignement, validerManifeste } from '@janus/contrats'
import type { Manifeste, TypeEtape } from '@janus/contrats'
import { blocsFixes, contenuDuBloc, enTeteDuPont, pontEmbarque } from './assemblage.ts'
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
  chercher(
    sansScriptsNiCommentaires(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''),
    'le texte affiché',
  )
  textesDuManifeste(manifeste, '', (chemin, texte) => {
    chercher(texte, chemin)
  })
}

/** Le texte JSON d'un `<script type="application/json" id="…">` de la page. */
function blocJson(html: string, id: string): string | undefined {
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
  poser(manifeste.consolidation, 'consolidation', (q) => q.question)
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
      verifierAdressesExternes(fiche.html, signaler)
      verifierRenvoisAuxCours(resultat.manifeste, fiche.html, signaler)
      verifierAlignement(resultat.manifeste, fiche.html, signaler)

      const avant = contenuDeReference?.(fiche.nom)
      if (regles !== undefined) {
        const grille = await lireSiPresent(
          join(dossierContenu, formation, DOSSIER_FICHES, nomDeLaGrille(bloc)),
        )
        if (grille !== undefined) {
          verifierGrille(grille, regles, resultat.manifeste, signaler)
        } else if (contenuDeReference !== undefined && avant !== fiche.html) {
          // Nouvelle (pas de référence) ou modifiée : la grille se refait avec la fiche. Sans
          // référence (lancement local sans `--base`), on ne sait pas si la fiche a changé : rien.
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
