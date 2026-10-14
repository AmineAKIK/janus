import { CodeBloc } from '@janus/contrats'

/** L'emplacement de la bibliothèque du pont dans une fiche : une balise vide, repérée par son identifiant. */
const BALISE_PONT = '<script id="pont"></script>'
const OUVERTURE_PONT = '<script id="pont">'
/** Le code du bloc que porte le gabarit : le seul endroit à changer pour créer une fiche. */
const BLOC_DU_GABARIT = '"bloc": "X00"'

/** Le pont construit par `pnpm --filter @janus/pont build`, que les fiches embarquent. */
export const CHEMIN_PONT = new URL('../../../packages/pont/dist/pont.js', import.meta.url)

/** La première ligne de `pont.js`, écrite à la construction : la version du contrat et l'empreinte SHA-256 du code. */
const EN_TETE_PONT = /^\s*\/\*! janus-pont v(\d+) ([0-9a-f]{64}) \*\//

export interface EnTetePont {
  readonly version: number
  readonly empreinte: string
}

/** L'en-tête d'un code de pont (construit ou embarqué, même reformaté), `undefined` s'il n'en a pas. */
export function enTeteDuPont(code: string): EnTetePont | undefined {
  const lu = EN_TETE_PONT.exec(code)
  if (lu === null || lu[1] === undefined || lu[2] === undefined) return undefined
  return { version: Number(lu[1]), empreinte: lu[2] }
}

/** Le code du pont embarqué dans une fiche, `</script` rétabli ; `undefined` sans balise ou balise vide. */
export function pontEmbarque(html: string): string | undefined {
  const debut = html.indexOf(OUVERTURE_PONT)
  if (debut === -1) return undefined
  const contenu = html.slice(debut + OUVERTURE_PONT.length).split('</script')[0] ?? ''
  return contenu.trim() === '' ? undefined : contenu.replaceAll('<\\/script', '</script')
}

/** La fiche embarque-t-elle déjà la bibliothèque du pont ? */
export function pontEstPresent(html: string): boolean {
  return pontEmbarque(html) !== undefined
}

/**
 * Les blocs du gabarit que toute fiche reprend tels quels, octet pour octet : les polices, la feuille
 * de style et la plomberie. Ce qui est propre à une fiche va dans `<style id="styles-bloc">` et
 * `<script id="outils-bloc">`.
 */
export const BLOCS_FIXES = ['polices', 'styles-gabarit', 'plomberie'] as const
export type BlocFixe = (typeof BLOCS_FIXES)[number]

interface PositionDuBloc {
  readonly debut: number
  readonly fin: number
}

/** Où commence et finit le contenu du `<style id="…">` ou `<script id="…">` de la page. */
function positionDuBloc(html: string, id: string): PositionDuBloc | undefined {
  const ouverture = new RegExp(`<(style|script)\\b[^>]*\\sid="${id}"[^>]*>`).exec(html)
  if (ouverture === null) return undefined
  const debut = ouverture.index + ouverture[0].length
  const fin = html.indexOf(`</${ouverture[1] ?? ''}>`, debut)
  return fin === -1 ? undefined : { debut, fin }
}

/** Le contenu d'un `<style id="…">` ou `<script id="…">` de la page, `undefined` s'il n'y est pas. */
export function contenuDuBloc(html: string, id: string): string | undefined {
  const position = positionDuBloc(html, id)
  return position === undefined ? undefined : html.slice(position.debut, position.fin)
}

/** Les blocs fixes du gabarit, par identifiant ; une erreur si le gabarit en a perdu un. */
export function blocsFixes(gabarit: string): ReadonlyMap<BlocFixe, string> {
  const blocs = new Map<BlocFixe, string>()
  for (const id of BLOCS_FIXES) {
    const contenu = contenuDuBloc(gabarit, id)
    if (contenu === undefined) throw new Error(`Le gabarit n’a plus de bloc fixe id="${id}".`)
    blocs.set(id, contenu)
  }
  return blocs
}

/**
 * Remplace, dans une fiche, le contenu de chaque bloc fixe par celui du gabarit (`fiches:assembler
 * --forcer`) : la fiche reprend la plomberie du jour, ses blocs propres ne bougent pas.
 */
export function remplacerLesBlocsFixes(html: string, gabarit: string): string {
  let resultat = html
  for (const [id, contenu] of blocsFixes(gabarit)) {
    const position = positionDuBloc(resultat, id)
    if (position === undefined) {
      throw new Error(
        `La fiche n’a pas de bloc fixe id="${id}" : reprends les balises du gabarit (LISEZ-MOI).`,
      )
    }
    resultat = `${resultat.slice(0, position.debut)}${contenu}${resultat.slice(position.fin)}`
  }
  return resultat
}

/**
 * Écrit `pont.js` dans la balise vide de la fiche. Le code ne peut pas contenir `</script`, qui
 * fermerait la balise : on l'écrit `<\/script`, ce que JavaScript lit de la même façon.
 */
export function injecterLePont(html: string, pont: string): string {
  if (!html.includes(BALISE_PONT)) {
    throw new Error(`La fiche n’a pas la balise vide ${BALISE_PONT}.`)
  }
  const sur = pont.replaceAll('</script', '<\\/script')
  // Une fonction évite que `$&` ou `$1` du code soient pris pour des motifs de remplacement.
  return html.replace(BALISE_PONT, () => `<script id="pont">${sur}</script>`)
}

/** Remplace le pont embarqué d'une fiche par `pont` (`fiches:assembler --forcer`) ; sans pont embarqué, l'écrit dans la balise vide. */
export function remplacerLePont(html: string, pont: string): string {
  const debut = html.indexOf(OUVERTURE_PONT)
  if (debut === -1) throw new Error(`La fiche n’a pas la balise ${OUVERTURE_PONT}.`)
  const fin = html.indexOf('</script>', debut)
  if (fin === -1) throw new Error('La balise du pont ne se referme pas.')
  return injecterLePont(
    `${html.slice(0, debut)}${BALISE_PONT}${html.slice(fin + '</script>'.length)}`,
    pont,
  )
}

/** Une fiche neuve : le gabarit, au code du bloc, avec le pont de l'appli. */
export function nouvelleFiche(gabarit: string, bloc: string, pont: string): string {
  if (!CodeBloc.safeParse(bloc).success) {
    throw new Error(`« ${bloc} » n’est pas un code de bloc valide (par exemple B03).`)
  }
  if (!gabarit.includes(BLOC_DU_GABARIT)) {
    throw new Error(`Le gabarit n’a plus la ligne ${BLOC_DU_GABARIT}.`)
  }
  return injecterLePont(
    gabarit.replace(BLOC_DU_GABARIT, () => `"bloc": "${bloc}"`),
    pont,
  )
}
