/** Un morceau de texte en ligne : brut, gras ou `code`. */
export type Segment =
  | { readonly type: 'texte'; readonly texte: string }
  | { readonly type: 'gras'; readonly texte: string }
  | { readonly type: 'code'; readonly texte: string }

export type Bloc =
  | { readonly type: 'paragraphe'; readonly segments: readonly Segment[] }
  | { readonly type: 'liste'; readonly elements: readonly (readonly Segment[])[] }
  | { readonly type: 'bloc_de_code'; readonly code: string }

const MOTIF_EN_LIGNE = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g
const MOTIF_LISTE = /^\s*\d+[.)]\s+(.*)$/

/** Le sous-ensemble de Markdown d'une carte : `code` en ligne et **gras**, rien d'autre n'est interprété. */
export function analyserEnLigne(texte: string): Segment[] {
  const segments: Segment[] = []
  let fin = 0
  for (const trouve of texte.matchAll(MOTIF_EN_LIGNE)) {
    const debut = trouve.index
    if (debut > fin) segments.push({ type: 'texte', texte: texte.slice(fin, debut) })
    const [, code, gras] = trouve
    if (code !== undefined) segments.push({ type: 'code', texte: code })
    else if (gras !== undefined) segments.push({ type: 'gras', texte: gras })
    fin = debut + trouve[0].length
  }
  if (fin < texte.length) segments.push({ type: 'texte', texte: texte.slice(fin) })
  return segments
}

/**
 * Découpe le texte en blocs : paragraphes (séparés par une ligne vide), listes numérotées (« 1. »,
 * « 2) »…) et blocs de code entre ``` ```. Un bloc de code jamais refermé court jusqu'à la fin.
 */
export function analyser(texte: string): Bloc[] {
  const blocs: Bloc[] = []
  const lignes = texte.replaceAll('\r\n', '\n').split('\n')
  let paragraphe: string[] = []
  let liste: string[] = []

  const viderParagraphe = () => {
    if (paragraphe.length > 0) {
      blocs.push({ type: 'paragraphe', segments: analyserEnLigne(paragraphe.join('\n')) })
      paragraphe = []
    }
  }
  const viderListe = () => {
    if (liste.length > 0) {
      blocs.push({ type: 'liste', elements: liste.map((element) => analyserEnLigne(element)) })
      liste = []
    }
  }

  for (let index = 0; index < lignes.length; index += 1) {
    const ligne = lignes[index] ?? ''
    if (ligne.trimStart().startsWith('```')) {
      viderParagraphe()
      viderListe()
      const code: string[] = []
      index += 1
      while (index < lignes.length && !(lignes[index] ?? '').trimStart().startsWith('```')) {
        code.push(lignes[index] ?? '')
        index += 1
      }
      blocs.push({ type: 'bloc_de_code', code: code.join('\n') })
      continue
    }
    const element = MOTIF_LISTE.exec(ligne)?.[1]
    if (element !== undefined) {
      viderParagraphe()
      liste.push(element)
    } else if (ligne.trim() === '') {
      viderParagraphe()
      viderListe()
    } else {
      viderListe()
      paragraphe.push(ligne)
    }
  }
  viderParagraphe()
  viderListe()
  return blocs
}
