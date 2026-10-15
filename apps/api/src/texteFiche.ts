import type { Manifeste } from '@janus/contrats'

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

/** Le HTML d'une étape en texte simple : un paragraphe par ligne, les écrans en titres, les outils nommés. */
function enTexte(html: string): string {
  return decoder(
    imagesEnTexte(
      html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''),
    )
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

/** Le contenu des `<template data-etape>` et `<template data-item>` de la page, par identifiant. */
function templates(html: string): {
  etapes: ReadonlyMap<string, string>
  items: ReadonlyMap<string, string>
} {
  const etapes = new Map<string, string>()
  const items = new Map<string, string>()
  const sansCommentaires = html.replace(/<!--[\s\S]*?-->/g, '')
  for (const [, attributs, contenu] of sansCommentaires.matchAll(
    /<template\b([^>]*)>([\s\S]*?)<\/template>/gi,
  )) {
    const etape = /\bdata-etape\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const item = /\bdata-item\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    if (etape !== undefined) etapes.set(etape, contenu ?? '')
    if (item !== undefined) items.set(item, contenu ?? '')
  }
  return { etapes, items }
}

/** Ce que lit l'apprenant neuf : l'objectif, la carte et les explications, puis tout ce qu'on lui demande. */
export function texteDeLaFiche(html: string, manifeste: Manifeste): string {
  const { etapes, items } = templates(html)
  const lignes = [
    `# ${manifeste.bloc} : ${manifeste.titre} (version ${String(manifeste.version)})`,
    '',
    `Objectif : ${manifeste.objectif}`,
    '',
    '## Ce que la fiche enseigne',
  ]
  for (const etape of manifeste.etapes) {
    if (etape.type !== 'carte' && etape.type !== 'explication') continue
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
  return `${lignes.join('\n')}\n`
}
