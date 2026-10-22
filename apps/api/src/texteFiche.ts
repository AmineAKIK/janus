import { Alignement } from '@janus/contrats'
import type { Manifeste, TypeEtape, TypeRelation } from '@janus/contrats'
import { blocJson } from './fiches.ts'

// Le texte d'une fiche tel que l'apprenant le lit, pour l'épreuve de l'apprenant neuf (LISEZ-MOI du
// gabarit) : chaque étape dans l'ordre de la page, puis tout ce qu'elle demande, sans aucune réponse.
// Ni les attendus, ni le contexte du correcteur, ni les attributs des outils (réponses, messages de
// réussite). Avec `conception`, pour le gardien de la méthode, ce que l'apprenant ne lit pas.

const ENTITES: Readonly<Record<string, string>> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  rsquo: '’',
  lsquo: '‘',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  ndash: '–',
  times: '×',
  minus: '−',
}

function decoder(texte: string): string {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code: string) => {
    if (/^#x/i.test(code)) return String.fromCodePoint(parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)))
    return ENTITES[code.toLowerCase()] ?? tout
  })
}

/**
 * Remplace chaque élément que `choisir` désigne (sa balise ouvrante et tout son contenu jusqu'à la
 * balise fermante qui lui répond) par le texte que `choisir` rend ; `undefined` le laisse tel quel.
 */
function remplacerElements(
  html: string,
  choisir: (nom: string, attributs: string) => string | undefined,
): string {
  let resultat = ''
  let position = 0
  const ouvrante = /<([a-z][a-z0-9-]*)\b([^>]*)>/gi
  for (let trouve = ouvrante.exec(html); trouve !== null; trouve = ouvrante.exec(html)) {
    const [balise, nom = '', attributs = ''] = trouve
    const remplacement = choisir(nom.toLowerCase(), attributs)
    if (remplacement === undefined) continue
    const memeNom = new RegExp(`<(/?)${nom}\\b[^>]*>`, 'gi')
    memeNom.lastIndex = trouve.index + balise.length
    let profondeur = 1
    let fin = html.length
    for (let suivant = memeNom.exec(html); suivant !== null; suivant = memeNom.exec(html)) {
      profondeur += suivant[1] === '/' ? -1 : 1
      if (profondeur === 0) {
        fin = suivant.index + suivant[0].length
        break
      }
    }
    resultat += html.slice(position, trouve.index) + remplacement
    position = fin
    ouvrante.lastIndex = fin
  }
  return resultat + html.slice(position)
}

/** Une image (`role="img"`, `<svg>`, `<img>`) se lit par sa description ; ce qui est `aria-hidden` se tait. */
function imagesEnTexte(html: string): string {
  return remplacerElements(html, (nom, attributs) => {
    if (/\baria-hidden\s*=\s*["']true["']/i.test(attributs)) return ''
    if (nom !== 'svg' && !/\brole\s*=\s*["']img["']/i.test(attributs)) return undefined
    const description = /\baria-label\s*=\s*["']([^"']*)["']/i.exec(attributs)?.[1]
    return ` [image : ${description ?? 'sans description'}] `
  }).replace(/<img\b[^>]*>/gi, (balise) => {
    const description = /\balt\s*=\s*["']([^"']*)["']/i.exec(balise)?.[1]
    return ` [image : ${description === undefined || description === '' ? 'sans description' : description}] `
  })
}

/** La page sans ses commentaires, ses scripts ni ses styles : ce qui reste est ce que le navigateur montre. */
function sansCommentairesScriptsNiStyles(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
}

const ETATS_EN_MOTS: Readonly<Record<string, string>> = {
  juste: 'juste',
  faux: 'faux',
  passe: 'passé',
  absent: 'pas encore fait',
}

/**
 * Un encadré qui dépend d'un essai (`data-si-essai`) le dit en tête ; la réponse qu'il cite
 * (`data-essai-rappel`) se lit à sa place : le texte montre tous les encadrés, la page un seul.
 */
function essaisEnTexte(html: string): string {
  return remplacerElements(html, (_nom, attributs) => {
    const cle = /\bdata-essai-rappel\s*=\s*["']([^"']*)["']/i.exec(attributs)?.[1]
    return cle === undefined ? undefined : `[la réponse à l’essai ${cle}]`
  }).replace(
    /(<[a-z][a-z0-9-]*\b[^>]*\bdata-si-essai\s*=\s*["']([^"':]*):([^"']*)["'][^>]*>)/gi,
    (_balise, ouvrante: string, cle: string, etats: string) =>
      `${ouvrante}[seulement si l’essai ${cle} est ${etats
        .split('|')
        .map((etat) => ETATS_EN_MOTS[etat] ?? etat)
        .join(' ou ')}] `,
  )
}

/** Le HTML d'une étape en texte simple : un paragraphe par ligne, les écrans en titres, les outils nommés. */
function enTexte(html: string): string {
  return decoder(
    essaisEnTexte(imagesEnTexte(sansCommentairesScriptsNiStyles(html)))
      .replace(/\s+/g, ' ')
      .replace(
        /<div\b[^>]*\bdata-widget\s*=\s*["']([^"']+)["'][^>]*>/gi,
        '\n[outil interactif : $1]\n',
      )
      .replace(/<div\b[^>]*\bdata-ecran\s*=\s*["']([^"']+)["'][^>]*>/gi, '\n#### $1\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<br\s*\/?>/gi, '\n')
      // Un exposant garde sa marque (2^8, pas 28) ; une boîte de schéma et sa flèche prennent chacune leur ligne,
      // la précision d'une boîte entre parenthèses.
      .replace(/<sup\b[^>]*>/gi, '^')
      // Deux cases collées d'une grille (le numéro et son signe) restent deux mots : 48 0, pas 480.
      .replace(/(<\/(?:span|b)>)(?=<(?:span|b)\b)/gi, '$1 ')
      .replace(
        /<span\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:boite-fixe|fleche)\b[^"']*["'][^>]*>/gi,
        '\n',
      )
      .replace(/<small\b[^>]*>/gi, ' (')
      .replace(/<\/small>/gi, ')')
      .replace(
        /<\/?(?:p|div|ul|ol|li|h[1-6]|table|tr|details|summary|section|figure|figcaption|blockquote|pre)\b[^>]*>/gi,
        '\n',
      )
      .replace(/<t[dh]\b[^>]*>/gi, ' | ')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t ]+/g, ' ').trim())
    .filter((ligne) => ligne !== '')
    .join('\n')
}

/**
 * Le contenu des `<template data-etape>`, `<template data-item>` et `<template data-variante>` de la
 * page, par identifiant, et celui du `<template data-conception>`. Les scripts et les styles sont
 * écartés d'abord : la plomberie cite `<template data-etape="ET1">` dans un commentaire, ce qui n'est
 * pas un template.
 */
function templates(html: string): {
  etapes: ReadonlyMap<string, string>
  items: ReadonlyMap<string, string>
  variantes: ReadonlyMap<string, string>
  conception: string | undefined
} {
  const etapes = new Map<string, string>()
  const items = new Map<string, string>()
  const variantes = new Map<string, string>()
  let conception: string | undefined
  for (const [, attributs, contenu] of sansCommentairesScriptsNiStyles(html).matchAll(
    /<template\b([^>]*)>([\s\S]*?)<\/template>/gi,
  )) {
    const etape = /\bdata-etape\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const item = /\bdata-item\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const variante = /\bdata-variante\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    if (etape !== undefined) etapes.set(etape, contenu ?? '')
    if (item !== undefined) items.set(item, contenu ?? '')
    if (variante !== undefined) variantes.set(variante, contenu ?? '')
    if (/\bdata-conception\b/i.test(attributs ?? '')) conception = contenu ?? ''
  }
  return { etapes, items, variantes, conception }
}

/** Les attributs d'une balise ouvrante, par nom, valeurs décodées. */
function attributsDe(balise: string): ReadonlyMap<string, string> {
  const attributs = new Map<string, string>()
  for (const [, nom = '', guillemets, apostrophes] of balise.matchAll(
    /\s([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  )) {
    attributs.set(nom.toLowerCase(), decoder(guillemets ?? apostrophes ?? ''))
  }
  return attributs
}

/** Des réponses séparées par `|`, entre guillemets : « 32 » ou « 256 ». */
const enGuillemets = (valeurs: string) => `« ${valeurs.split('|').join(' » ou « ')} »`

/**
 * Ce que la page ne montre qu'après une tentative, dans un template : la réponse que l'outil attend
 * (`data-reponse`, l'option juste d'un choix ; `data-accepte`, les réponses acceptées), les coups de
 * pouce (`data-aide1` à `data-aide3`, `data-solution`), les retours écrits à la conception
 * (`data-retour-e1` avec `data-si-e1`, `data-retour` d'une option avec son `data-erreur`,
 * `data-sinon` pour toute autre réponse fausse), l'explication montrée après la réponse
 * (`data-explication`), la justification demandée (`data-justifier`), le message de réussite, le
 * message après un pari (`data-apres`), et,
 * pour un schéma à refaire de mémoire, ses cases (`data-case`), ses liens (`data-lien` parmi
 * `data-choix`, ou à écrire, accepté sur ses mots `data-mots`), leurs indices (`data-indice`), et
 * l'explication du schéma, qui ne vient qu'une fois toutes ses cases justes : elle suit ses cases.
 */
function cachesDuTemplate(contenu: string): string[] {
  const lignes: string[] = []
  const apresLeSchema: string[] = []
  const sansScripts = sansCommentairesScriptsNiStyles(contenu)
  // Les options d'un choix : leur texte et leur retour vont ensemble.
  const options = [...sansScripts.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)].map((option) => ({
    position: option.index,
    id: attributsDe(option[1] ?? '').get('data-option'),
    texte: enTexte(option[2] ?? '').replaceAll('\n', ' '),
  }))
  for (const balise of sansScripts.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/gi)) {
    const attributs = attributsDe(balise[0])
    const lire = (nom: string) => attributs.get(nom)
    const reponse = lire('data-reponse')
    if (reponse !== undefined) {
      // Un choix attend une option : la première qui porte cet identifiant, après l'outil.
      const option = options.find(({ position, id }) => position > balise.index && id === reponse)
      const question = lire('data-question')
      lignes.push(
        `- Réponse attendue${question === undefined ? '' : ` à « ${question} »`} : ${option === undefined ? reponse : `« ${option.texte} »`}`,
      )
    }
    const enCase = lire('data-case')
    if (enCase !== undefined) lignes.push(`- Case à remplir de mémoire : « ${enCase} »`)
    const lien = lire('data-lien')
    if (lien !== undefined) {
      const choix = lire('data-choix')
      lignes.push(
        choix === undefined
          ? `- Lien à écrire de mémoire : « ${lien} »`
          : `- Lien à choisir : « ${lien} », parmi ${enGuillemets(choix)}`,
      )
    }
    const mots = lire('data-mots')
    if (mots !== undefined)
      lignes.push(
        `- Lien accepté s’il dit, avec ses mots : ${mots
          .split(';')
          .map((groupe) => enGuillemets(groupe))
          .join(', et ')}`,
      )
    const accepte = lire('data-accepte')
    if (accepte !== undefined) lignes.push(`- Réponses acceptées : ${enGuillemets(accepte)}`)
    const indice = lire('data-indice')
    if (indice !== undefined)
      lignes.push(`- Indice après une première vérification fausse : ${indice}`)
    for (const cran of ['1', '2', '3']) {
      const aide = lire(`data-aide${cran}`)
      if (aide !== undefined) lignes.push(`- Coup de pouce ${cran} : ${aide}`)
    }
    const solution = lire('data-solution')
    if (solution !== undefined) lignes.push(`- Solution : ${solution}`)
    for (const [nom, texte] of attributs) {
      // `e1` nomme une erreur critique ; une autre clé (`pixels`), une erreur courante.
      const cle = /^data-retour-([a-z][a-z0-9]*)$/.exec(nom)?.[1]
      if (cle === undefined || cle === 'ajoute') continue
      const si = lire(`data-si-${cle}`)
      const condition = si === undefined ? '' : ` si ${enGuillemets(si)}`
      const erreur = /^e\d+$/.test(cle) ? ` (${cle.toUpperCase()})` : ''
      lignes.push(`- Retour${condition}${erreur} : ${texte}`)
    }
    const retourAjoute = lire('data-retour-ajoute')
    if (retourAjoute !== undefined)
      lignes.push(`- Retour si les paris ajoutent au lieu de doubler : ${retourAjoute}`)
    const retour = lire('data-retour')
    if (retour !== undefined) {
      const option = options.find(({ position }) => position === balise.index)
      const erreur = lire('data-erreur')
      const si = lire('data-si')
      const qui =
        option !== undefined
          ? ` à l’option « ${option.texte} »`
          : si !== undefined
            ? ` si ${si}`
            : ''
      lignes.push(`- Retour${qui}${erreur === undefined ? '' : ` (${erreur})`} : ${retour}`)
    }
    const sinon = lire('data-sinon')
    if (sinon !== undefined) lignes.push(`- Retour pour toute autre réponse fausse : ${sinon}`)
    const justifier = lire('data-justifier')
    if (justifier !== undefined)
      lignes.push(
        `- Après une bonne réponse, à justifier : ${justifier} Puis comparée à la solution.`,
      )
    const explication = lire('data-explication')
    if (explication !== undefined && lire('data-widget') === 'schema-memoire')
      apresLeSchema.push(
        `- Schéma de mémoire, une fois toutes les cases justes, si l’apprenant a ouvert l’étape détaillée d’un élément : il explique le schéma sans le regarder, puis la page montre, pour comparer : « ${explication} »`,
      )
    else if (explication !== undefined) lignes.push(`- Après la réponse : ${explication}`)
    const succes = lire('data-succes')
    if (succes !== undefined) lignes.push(`- Réussite : ${succes}`)
    const apres = lire('data-apres')
    if (apres !== undefined) lignes.push(`- Après le choix : ${apres}`)
    const pari = lire('data-avant')
    if (pari !== undefined) {
      const option = options.find(({ position }) => position === balise.index)
      lignes.push(
        `- Rappel du pari du début, si l’apprenant avait choisi « ${option?.texte ?? ''} » : « ${pari} »`,
      )
    }
    lignes.push(...varianteDuCours(lire))
  }
  return [...lignes, ...apresLeSchema]
}

/**
 * La variante d'un outil du cours : un autre nombre pour une conversion (`data-variante`), ou un autre
 * cas (`data-variante-reponse`, avec `data-variante-enonce`, ses coups de pouce, sa solution et ses
 * retours, tous préfixés `data-variante-`), refait sans regarder après une solution, à la place de
 * l'énoncé d'origine.
 */
function varianteDuCours(lire: (nom: string) => string | undefined): string[] {
  const nombre = lire('data-variante')
  if (nombre !== undefined)
    return [`- Après la solution, à refaire sans regarder sur un autre nombre : ${nombre}`]
  const reponse = lire('data-variante-reponse')
  if (reponse === undefined) return []
  const lignes = [
    `- Après la solution, à refaire sans regarder sur un autre cas : « ${lire('data-variante-enonce') ?? ''} » Réponse attendue : ${reponse}`,
  ]
  for (const cran of ['1', '2', '3']) {
    const aide = lire(`data-variante-aide${cran}`)
    if (aide !== undefined) lignes.push(`- Sur l’autre cas, coup de pouce ${cran} : ${aide}`)
  }
  const solution = lire('data-variante-solution')
  if (solution !== undefined) lignes.push(`- Sur l’autre cas, solution : ${solution}`)
  for (const cle of ['e1', 'e2', 'e3', 'e4', 'pixels']) {
    const retour = lire(`data-variante-retour-${cle}`)
    if (retour === undefined) continue
    const si = lire(`data-variante-si-${cle}`)
    const erreur = /^e\d+$/.test(cle) ? ` (${cle.toUpperCase()})` : ''
    lignes.push(
      `- Sur l’autre cas, retour${si === undefined ? '' : ` si ${enGuillemets(si)}`}${erreur} : ${retour}`,
    )
  }
  const sinon = lire('data-variante-sinon')
  if (sinon !== undefined)
    lignes.push(`- Sur l’autre cas, retour pour toute autre réponse fausse : ${sinon}`)
  const succes = lire('data-variante-succes')
  if (succes !== undefined) lignes.push(`- Sur l’autre cas, réussite : ${succes}`)
  return lignes
}

/**
 * Ce que le gabarit fait sur toute fiche et que le texte des étapes ne dit pas, avec ce que l'appli
 * fait des réponses (correction, statut). À tenir à jour avec `contenu/dwwm/gabarit/fiche.html`, la
 * consigne du correcteur (`prompts/correction/v3.md`) et le moteur : les libellés cités entre
 * guillemets sont ceux de la page.
 */
export const CE_QUE_FAIT_LE_GABARIT: readonly string[] = [
  'Le fil groupe les étapes en quatre moments : Découvrir (perception, puis carte, qui vient après le pari), Comprendre (pré-test, explication), S’entraîner (pratique, atelier, aisance, ensemble), Prouver (restitution, bilan).',
  'Une étape à plusieurs écrans les montre un par un, avec Retour et Suivant ; chaque écran a « Écouter », qui le lit à voix haute.',
  'Échelle d’aide, la même dans chaque fiche, au cours comme en pratique : rien avant une réponse fausse ; puis « Un coup de pouce », puis « Un autre coup de pouce », chacun ouvert après une nouvelle réponse fausse ; au bout, « Voir la solution » (sans cran, après deux réponses fausses). Dans un choix, chaque option fausse est retirée ; quand une seule reste, elle est marquée comme solution vue.',
  'Pré-test, la tentative avant l’explication : chaque exercice d’essai (`data-essai`) prend une réponse, ou « Je ne sais pas », sans rien dire de juste ou de faux (« Noté : … La correction vient à la fin de l’étape. ») ; la première réponse part à l’appli. Quand chaque essai a sa réponse, « Tes essais » montre chaque réponse, juste ou pas, ce qui était attendu et ce qui cause l’erreur (le retour de l’outil ou de l’option), sauf après « Je ne sais pas » ; « Étape suivante » attend jusque-là. L’explication qui suit peut montrer un encadré selon la réponse à un essai (`data-si-essai`), et y citer cette réponse (`data-essai-rappel`).',
  'La carte montre son texte, puis l’objectif replié sous « Ce qui sera vérifié » ; le même objectif replié ouvre la pratique.',
  'Pratique : un item à la fois. Quand l’outil de l’item vérifie la réponse, c’est lui qui dit si l’item est réussi ; sinon l’apprenant déclare « J’ai réussi » ou « Pas réussi ». Sous « J’ai eu besoin d’aide », il déclare le cran utilisé : 1 une question qui oriente, 2 un indice, 3 l’étape détaillée, 4 la solution complète. Chaque résultat part à l’appli avec son aide (« Envoyé : réussi, aide 1 »).',
  'Quand l’outil a montré la solution, l’item n’est pas réussi : il affiche « Solution vue » et « Tu as vu la solution. Refais-la sans la regarder. », puis se redessine, et l’outil propose sa variante. La solution compte comme vue dès qu’elle s’affiche, même si l’apprenant quitte l’item. Le même jour, chaque résultat de l’item part avec l’aide 4 ; un autre jour, il repart sans aide.',
  'Toute aide garde son jour : refait le même jour, un item part avec l’aide la plus forte reçue ce jour-là (« Tu as eu de l’aide aujourd’hui : refais-le un autre jour, sans aide, pour qu’il compte. ») ; un autre jour, il repart sans aide.',
  'L’appli ne tient un exercice de pratique pour fait que quand le nombre d’items demandé (`reussite` dans le manifeste) est réussi sans aide, et le bloc ne devient pas « acquis provisoirement » sans toute sa pratique.',
  'Restitution, sans support : la série commence sur « Commencer » (« dès que tu commences, il est masqué jusqu’à ta dernière réponse »), avant toute question ; de ce clic à la dernière réponse, tout le reste de la fiche est masqué (« Cette étape s’ouvrira après ta dernière réponse ») : le cours (perception, pré-test, explications), la carte, la pratique, l’atelier, l’aisance, l’ensemble et le bilan. Une erreur rouverte se reprend de même, sur « Commencer ». « Revenir au cours » le rouvre ; une réponse donnée ensuite, ou collée, ne compte pas pour le statut (« Ne compte pas · Avec support »).',
  'Restitution : une question à la fois, la suivante paraît quand la précédente est envoyée ; les réponses envoyées restent lisibles au-dessus, sans leur correction (« Corrigée à la fin de la série. »). Chaque question a un champ libre, puis « Ta confiance » (Sûr, Hésitant, Au hasard), à choisir avant d’envoyer. Les corrections s’affichent toutes après la dernière réponse (« Envoyée. Sa correction s’affichera à la fin de la série, pour ne pas souffler les questions suivantes. »).',
  'La correction de l’appli compare la réponse à l’attendu du manifeste, avec le contexte du correcteur (`contexte_ia`) : un niveau (Solide, Partiel, Fragile, Pas encore) et un message qui dit ce que la réponse montre de compris, ce qu’elle mélange et ce qui manque. Une réponse à moitié juste est à moitié juste ; un correcteur qui n’est pas sûr de son jugement le dit, et la réponse ne compte pas (« Ne compte pas · Non vérifiée »). Une erreur critique présente dans la réponse la met au plus à Fragile, à Pas encore si l’apprenant s’était dit sûr.',
  'Chaque correction dit d’où vient ce qu’elle corrige : du support (avec sa référence, une des `sources` du manifeste, qui désignent des étapes de la fiche), déduit du support, ou ajouté par le correcteur. Les questions que pose l’appli (rappel, vérifications) l’affichent sous la correction : « D’après le cours », « Déduit du cours » ou « Ajouté hors du cours », puis « Source · Fiche », le bloc et la référence.',
  'La série finie, une réponse qui n’est pas Solide peut se compléter une fois, après sa correction (« Compléter ma réponse », « Ce complément ne compte pas pour le statut ») ; seule la première réponse compte pour le statut. Une correction tirée au sort demande « D’accord avec ce niveau ? ». Le Suivi de l’appli compare la confiance déclarée aux résultats.',
  'Le statut du bloc suit les preuves : « En cours » dès la première trace, « Vu » quand chaque question de la restitution a sa première réponse, puis « Acquis provisoirement » (restitution, pratique et atelier faits), « Acquis » (vérifications réussies) et « Maîtrisé » (acquis, retesté avec succès, et la cible d’aisance atteinte). Une erreur critique ouverte le met « À reprendre », quel que soit le reste.',
  'Ce que la fiche note sans le corriger (un pari, la reprise du pari, le schéma refait de mémoire), un outil le confie au gabarit (événement `fiche:trace`) : il part à l’appli dans l’état de la page, que l’appli garde, et revient à l’outil à la visite suivante.',
  'Bilan, une fois la restitution finie : ce qui est fait (restitution, items réussis dont ceux sans aide), puis toutes les erreurs critiques du bloc, à cocher. Une erreur déjà ouverte, ou repérée depuis le dernier bilan (« Repérée dans tes réponses ») par le correcteur dans une réponse ou par un outil de la fiche (événement `fiche:erreur`, par exemple des bits lus à l’envers en pratique ou en aisance), est cochée d’office et ne se décoche pas : « Une erreur cochée, ou repérée dans tes réponses, reste cochée : seule une réponse solide à une question qui la touche la referme. » Une erreur repérée par le correcteur, puis rejetée dans l’appli (« Ce n’en est pas une »), n’est plus cochée d’office, sauf si une autre réponse ou un outil l’a aussi repérée.',
  'La restitution faite, une erreur repérée attend le bilan : l’aisance s’arrête tant qu’il n’est pas envoyé (« Une erreur critique a été repérée dans tes réponses : … reprend une fois ton bilan envoyé », avec « Aller au bilan »).',
  'Une erreur critique cochée met le bloc « À reprendre », quoi qu’il ait réussi ailleurs : rien ne la compense. Elle rouvre la restitution, où les questions qui la touchent reviennent sous « À reprendre », et elle ne se ferme que par une réponse Solide, qui compte, à une question qui touche la même erreur (restitution ou vérification). Décocher ne ferme rien.',
  'Le rappel, les tâches différées et les cartes ne sont pas dans la page : l’appli pose le rappel en début de séance, tire les tâches différées dans ses vérifications, plus tard, et fait revenir les cartes en répétition.',
]

const NOMS_DES_RELATIONS: Readonly<Record<TypeRelation, string>> = {
  cause: 'cause',
  composition: 'composition',
  categorie: 'catégorie',
  condition: 'condition',
  equivalence: 'équivalence',
  opposition: 'opposition',
  sequence: 'séquence',
}

/** Le tableau d'alignement de la page, en lignes : notions, relations, tout, hors objectif. */
function alignementEnTexte(html: string): string[] {
  const texte = blocJson(html, 'alignement')
  let brut: unknown
  try {
    brut = texte === undefined ? undefined : JSON.parse(texte)
  } catch {
    brut = undefined
  }
  const lu = Alignement.safeParse(brut)
  if (!lu.success) return ['Pas de tableau d’alignement valide : lance `pnpm fiches:verifier`.']
  const { notions, relations = [], ensemble, hors_objectif } = lu.data
  const liste = (ids: readonly string[]) => (ids.length === 0 ? 'rien' : ids.join(', '))
  const lignes = ['Notions :']
  for (const notion of notions) {
    lignes.push(
      `- ${notion.id} : ${notion.notion}. Montrée en ${liste(notion.montree)} ; entraînée par ${liste(notion.pratiquee)} ; interrogée par ${liste(notion.questions)}.`,
    )
  }
  if (relations.length > 0) {
    lignes.push('', 'Relations :')
    for (const relation of relations) {
      lignes.push(
        `- ${relation.id} : de ${relation.de} vers ${relation.vers}, ${NOMS_DES_RELATIONS[relation.type]}. Montrée en ${relation.montree} ; interrogée par ${liste(relation.questions)}.`,
      )
    }
  }
  if (ensemble !== undefined) {
    lignes.push(
      '',
      `Le tout : montré en ${ensemble.montree}, refait en ${ensemble.rappelee} ; interrogé par ${liste(ensemble.questions)}.`,
    )
  }
  lignes.push('', 'Hors objectif (noté pour plus tard, jamais interrogé) :')
  for (const texteHors of hors_objectif) lignes.push(`- ${texteHors}`)
  return lignes
}

/**
 * Les erreurs critiques du manifeste, chacune avec les questions qui la touchent (champ `erreurs`) et
 * les étapes ou items dont un retour est écrit pour elle (`data-retour-e1`, `data-erreur="E1"`).
 */
function erreursEnTexte(html: string, manifeste: Manifeste): string[] {
  const { etapes, items, variantes } = templates(html)
  const questions = [...manifeste.restitution, ...manifeste.rappel, ...manifeste.differees]
  const sources = [
    ...etapes,
    ...items,
    ...[...variantes].map(([id, c]) => [`${id} (variante)`, c] as const),
  ]
  return manifeste.erreurs_critiques.map((erreur) => {
    const touchees = questions.filter((q) => q.erreurs.includes(erreur.id)).map(({ id }) => id)
    const cle = erreur.id.toLowerCase()
    const motif = new RegExp(
      `\\bdata-retour-${cle}\\s*=|\\bdata-erreur\\s*=\\s*["']${erreur.id}["']`,
      'i',
    )
    const retours = sources.filter(([, contenu]) => motif.test(contenu)).map(([id]) => id)
    return `- ${erreur.id} : ${erreur.libelle}${erreur.etape === undefined ? '' : ` (étape ${erreur.etape})`}. Questions qui la touchent : ${touchees.join(', ') || 'aucune'}. Retour écrit pour elle dans : ${retours.join(', ') || 'aucune étape ni aucun item'}.`
  })
}

/**
 * Pour l'épreuve du gardien de la méthode : ce que fait le gabarit sur toute fiche, ce que les outils
 * de la fiche font d'eux-mêmes (`<template data-conception>`), les erreurs critiques, le tableau
 * d'alignement, puis, étape par étape et item par item, ce que la page ne montre qu'après une
 * tentative, et la variante qui remplace un item après une solution vue. L'apprenant neuf ne le lit
 * pas : il y trouverait les réponses.
 */
function conceptionDeLaFiche(html: string, manifeste: Manifeste): string[] {
  const { etapes, items, variantes, conception } = templates(html)
  const lignes = [
    '',
    '## Pour le gardien de la méthode',
    '',
    'Ce que l’apprenant ne lit pas dans les étapes ci-dessus, mais que la page et l’appli font.',
    '',
    '### Ce que fait le gabarit, sur toute fiche',
    '',
    ...CE_QUE_FAIT_LE_GABARIT.map((fait) => `- ${fait}`),
    '',
    '### Ce que les outils de cette fiche font d’eux-mêmes',
    '',
    conception === undefined
      ? 'La fiche ne le dit pas : pas de `<template data-conception>`.'
      : enTexte(conception),
    '',
    '### Les erreurs critiques',
    '',
    ...erreursEnTexte(html, manifeste),
    '',
    '### Le tableau d’alignement',
    '',
    ...alignementEnTexte(html),
    '',
    '## Ce que la page montre après une tentative',
    '',
    'Pour chaque étape et chaque item : la réponse que la page attend, puis ce que l’apprenant ne voit qu’en répondant ou en demandant un coup de pouce, après une tentative (un cran par nouvelle tentative, la solution en dernier), les retours écrits pour une réponse prévue, et le message de réussite. Après une solution vue, la variante remplace l’item.',
  ]
  const section = (titre: string, contenu: string | undefined) => {
    if (contenu === undefined) return
    const caches = cachesDuTemplate(contenu)
    if (caches.length > 0) lignes.push('', `### ${titre}`, '', ...caches)
  }
  for (const etape of manifeste.etapes)
    section(`${etape.id} : ${etape.titre}`, etapes.get(etape.id))
  for (const exercice of manifeste.pratique) {
    for (const { id } of exercice.items) {
      section(id, items.get(id))
      const variante = variantes.get(id)
      if (variante !== undefined) {
        lignes.push(
          '',
          `### ${id}, variante après une solution vue`,
          '',
          enTexte(variante).replaceAll('\n', ' '),
          ...cachesDuTemplate(variante),
        )
      }
    }
  }
  return lignes
}

/** Les étapes dont le template est du texte à lire (gabarit : `ETAPES_LIBRES`). */
const ETAPES_LUES: ReadonlySet<TypeEtape> = new Set<TypeEtape>([
  'perception',
  'pretest',
  'explication',
  'ensemble',
  'aisance',
])

/** L'objectif replié, tel que la carte et la pratique le montrent. */
const objectifReplie = (manifeste: Manifeste) =>
  `Replié sous « Ce qui sera vérifié » : ${manifeste.objectif}`

/**
 * Ce que la page montre à une étape, en texte : son template pour une étape à lire ; pour les
 * autres, ce que le gabarit y affiche, et où sont les questions qu'elle pose.
 */
function etapeEnTexte(
  etape: Manifeste['etapes'][number],
  contenu: string | undefined,
  manifeste: Manifeste,
): string[] {
  if (ETAPES_LUES.has(etape.type))
    return [contenu === undefined ? 'Rien à lire dans cette étape.' : enTexte(contenu)]
  switch (etape.type) {
    case 'carte':
      return contenu === undefined
        ? [manifeste.objectif, ...manifeste.etapes.map(({ titre }) => `- ${titre}`)]
        : [enTexte(contenu), objectifReplie(manifeste)]
    case 'pratique':
      return [
        objectifReplie(manifeste),
        'Les exercices, un item à la fois : plus bas, dans « Ce qu’on te demande », partie Pratique.',
      ]
    case 'atelier':
      return ['Tu dis si tu as réussi l’atelier, sans aide ou non.']
    case 'restitution':
      return [
        'Les questions, une à la fois : plus bas, dans « Ce qu’on te demande », partie Restitution. Elle se fait sans le cours : dès que tu commences, il est masqué jusqu’à ta dernière réponse, comme le reste de la fiche. Tes réponses sont corrigées à la fin de la série, pour qu’une correction ne souffle pas la question suivante.',
      ]
    case 'bilan':
      return [
        'Ce que tu as fait, puis les erreurs critiques du bloc. Celles que la page a repérées dans tes réponses y sont déjà cochées ; tu coches aussi celles que tu sais avoir faites et dois encore revoir. Une erreur cochée met le bloc « À reprendre » jusqu’à ce qu’une réponse solide, à une question qui la touche, la referme.',
        // La page les affiche, à cocher : l'apprenant sait ce qu'il cherche.
        ...manifeste.erreurs_critiques.map(({ libelle }) => `- [ ] ${libelle}`),
      ]
    default:
      return []
  }
}

/**
 * Ce que lit l'apprenant neuf : chaque étape dans l'ordre du manifeste, comme la page la montre (le
 * texte des étapes à lire, l'objectif replié de la carte et de la pratique, où sont les questions),
 * puis tout ce qu'on lui demande. Avec `conception`, pour le gardien de la méthode : en plus, ce que
 * la page et l'appli font sans l'écrire dans les étapes, et ce que la page montre après une tentative.
 */
export function texteDeLaFiche(
  html: string,
  manifeste: Manifeste,
  { conception = false }: { readonly conception?: boolean } = {},
): string {
  const { etapes, items } = templates(html)
  const lignes = [
    `# ${manifeste.bloc} : ${manifeste.titre} (version ${String(manifeste.version)})`,
    '',
    '## Ce que la fiche enseigne',
  ]
  for (const etape of manifeste.etapes) {
    lignes.push(
      '',
      `### ${etape.id} : ${etape.titre}`,
      '',
      ...etapeEnTexte(etape, etapes.get(etape.id), manifeste),
    )
  }

  lignes.push(
    '',
    '## Ce qu’on te demande',
    '',
    'Réponds avec ce qui précède, et seulement avec ça.',
  )
  lignes.push('', '### Pratique')
  for (const exercice of manifeste.pratique) {
    lignes.push('', `${exercice.id} : ${exercice.titre}`)
    for (const { id } of exercice.items) {
      lignes.push(`- ${id} : ${enTexte(items.get(id) ?? '').replaceAll('\n', ' ')}`)
    }
  }
  const liste = (titre: string, elements: readonly { id: string; texte: string }[]) => {
    lignes.push('', `### ${titre}`, '')
    for (const { id, texte } of elements) lignes.push(`- ${id} : ${texte}`)
  }
  liste(
    'Restitution',
    manifeste.restitution.map(({ id, question }) => ({ id, texte: question })),
  )
  liste(
    'Rappel',
    manifeste.rappel.map(({ id, question }) => ({ id, texte: question })),
  )
  liste(
    'Tâches différées',
    manifeste.differees.map(({ id, consigne }) => ({ id, texte: consigne })),
  )
  liste(
    'Cartes',
    manifeste.cartes.map(({ id, recto }) => ({ id, texte: recto })),
  )
  if (conception) lignes.push(...conceptionDeLaFiche(html, manifeste))
  return `${lignes.join('\n')}\n`
}
