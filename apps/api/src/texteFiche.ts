import type { Manifeste, TypeEtape } from '@janus/contrats'

// Le texte d'une fiche tel que l'apprenant le lit, pour l'épreuve de l'apprenant neuf (LISEZ-MOI du
// gabarit) : ce que la fiche enseigne, puis tout ce qu'elle demande, sans aucune réponse. Ni les
// attendus, ni le contexte du correcteur, ni les attributs des outils (réponses, messages de réussite).

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

/** Le HTML d'une étape en texte simple : un paragraphe par ligne, les écrans en titres, les outils nommés. */
function enTexte(html: string): string {
  return decoder(
    imagesEnTexte(sansCommentairesScriptsNiStyles(html))
      .replace(/\s+/g, ' ')
      .replace(
        /<div\b[^>]*\bdata-widget\s*=\s*["']([^"']+)["'][^>]*>/gi,
        '\n[outil interactif : $1]\n',
      )
      .replace(/<div\b[^>]*\bdata-ecran\s*=\s*["']([^"']+)["'][^>]*>/gi, '\n#### $1\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<br\s*\/?>/gi, '\n')
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
 * page, par identifiant. Les scripts et les styles sont écartés d'abord : la plomberie cite
 * `<template data-etape="ET1">` dans un commentaire, ce qui n'est pas un template.
 */
function templates(html: string): {
  etapes: ReadonlyMap<string, string>
  items: ReadonlyMap<string, string>
  variantes: ReadonlyMap<string, string>
} {
  const etapes = new Map<string, string>()
  const items = new Map<string, string>()
  const variantes = new Map<string, string>()
  for (const [, attributs, contenu] of sansCommentairesScriptsNiStyles(html).matchAll(
    /<template\b([^>]*)>([\s\S]*?)<\/template>/gi,
  )) {
    const etape = /\bdata-etape\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const item = /\bdata-item\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const variante = /\bdata-variante\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    if (etape !== undefined) etapes.set(etape, contenu ?? '')
    if (item !== undefined) items.set(item, contenu ?? '')
    if (variante !== undefined) variantes.set(variante, contenu ?? '')
  }
  return { etapes, items, variantes }
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

/**
 * Ce que la page ne montre qu'à la demande ou après une erreur, dans un template : les coups de pouce
 * (`data-aide1` à `data-aide3`, `data-solution`), les retours écrits à la conception (`data-retour-e1`
 * avec `data-si-e1`, `data-retour` d'une option avec son `data-erreur`) et le message de réussite.
 */
function cachesDuTemplate(contenu: string): string[] {
  const lignes: string[] = []
  const sansScripts = sansCommentairesScriptsNiStyles(contenu)
  // Les options d'un choix : leur texte et leur retour vont ensemble.
  const options = new Map<number, string>()
  for (const option of sansScripts.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)) {
    options.set(option.index, enTexte(option[2] ?? '').replaceAll('\n', ' '))
  }
  for (const balise of sansScripts.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/gi)) {
    const attributs = attributsDe(balise[0])
    const lire = (nom: string) => attributs.get(nom)
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
      const condition = si === undefined ? '' : ` si « ${si.split('|').join(' » ou « ')} »`
      const erreur = /^e\d+$/.test(cle) ? ` (${cle.toUpperCase()})` : ''
      lignes.push(`- Retour${condition}${erreur} : ${texte}`)
    }
    const retourAjoute = lire('data-retour-ajoute')
    if (retourAjoute !== undefined)
      lignes.push(`- Retour si les paris ajoutent au lieu de doubler : ${retourAjoute}`)
    const retour = lire('data-retour')
    if (retour !== undefined) {
      const option = options.get(balise.index)
      const erreur = lire('data-erreur')
      const si = lire('data-si')
      const qui =
        option !== undefined ? ` à l’option « ${option} »` : si !== undefined ? ` si ${si}` : ''
      lignes.push(`- Retour${qui}${erreur === undefined ? '' : ` (${erreur})`} : ${retour}`)
    }
    const succes = lire('data-succes')
    if (succes !== undefined) lignes.push(`- Réussite : ${succes}`)
  }
  return lignes
}

/**
 * Pour l'épreuve du gardien de la méthode : ce que la page montre sur demande ou après une erreur (les
 * coups de pouce, les retours des erreurs critiques, le message de réussite), étape par étape et item
 * par item, puis la variante qui remplace un item après une solution vue. L'apprenant neuf ne le lit
 * pas : il y trouverait les réponses.
 */
function conceptionDeLaFiche(html: string, manifeste: Manifeste): string[] {
  const { etapes, items, variantes } = templates(html)
  const lignes = [
    '',
    '## Ce que la page montre sur demande',
    '',
    'Les coups de pouce, les retours écrits pour les erreurs et les variantes proposées après une solution vue : l’apprenant ne les voit qu’en les demandant ou en se trompant.',
  ]
  const section = (titre: string, contenu: string | undefined) => {
    if (contenu === undefined) return
    const caches = cachesDuTemplate(contenu)
    if (caches.length > 0) lignes.push('', `### ${titre}`, '', ...caches)
  }
  for (const etape of manifeste.etapes) section(`${etape.id} : ${etape.titre}`, etapes.get(etape.id))
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

/** Les étapes dont le template est du texte à lire, dans l'ordre du manifeste : ce que la fiche enseigne. */
const ETAPES_LUES: ReadonlySet<TypeEtape> = new Set<TypeEtape>([
  'carte',
  'perception',
  'pretest',
  'explication',
  'ensemble',
])

/**
 * Ce que lit l'apprenant neuf : l'objectif, puis les étapes à lire (carte, perception, pré-test,
 * explications, ensemble) dans l'ordre du manifeste, puis tout ce qu'on lui demande. Avec
 * `conception`, pour le gardien de la méthode : en plus, ce que la page montre sur demande.
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
    `Objectif : ${manifeste.objectif}`,
    '',
    '## Ce que la fiche enseigne',
  ]
  for (const etape of manifeste.etapes) {
    if (!ETAPES_LUES.has(etape.type)) continue
    const contenu = etapes.get(etape.id)
    if (contenu === undefined) continue
    lignes.push('', `### ${etape.id} : ${etape.titre}`, '', enTexte(contenu))
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
    'Consolidation',
    manifeste.consolidation.map(({ id, question }) => ({ id, texte: question })),
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
