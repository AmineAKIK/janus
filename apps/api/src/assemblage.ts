import { CodeBloc } from '@janus/contrats'

/** L'emplacement de la bibliothèque du pont dans une fiche : une balise vide, repérée par son identifiant. */
const BALISE_PONT = '<script id="pont"></script>'
const OUVERTURE_PONT = '<script id="pont">'
/** Le code du bloc que porte le gabarit : le seul endroit à changer pour créer une fiche. */
const BLOC_DU_GABARIT = '"bloc": "X00"'

/** La fiche embarque-t-elle déjà la bibliothèque du pont ? */
export function pontEstPresent(html: string): boolean {
  const debut = html.indexOf(OUVERTURE_PONT)
  if (debut === -1) return false
  const contenu = html.slice(debut + OUVERTURE_PONT.length).split('</script')[0] ?? ''
  return contenu.trim() !== ''
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
