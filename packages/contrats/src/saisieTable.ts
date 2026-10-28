/** Une grille de table de vérité, telle que le manifeste la déclare (`SaisieTable`), en lecture seule. */
interface Grille {
  readonly type: 'table'
  readonly entrees: readonly string[]
  readonly colonnes: readonly string[]
}

/**
 * Les cas d'une table de vérité, rangés comme on compte en binaire : FAUX avant VRAI, le premier fait
 * change le moins souvent (FAUX FAUX, FAUX VRAI, VRAI FAUX, VRAI VRAI). C'est l'ordre des lignes que
 * la page dessine (`contenu/dwwm/gabarit/fiche.html`, `casDeLaTable`).
 */
export function casDeLaTable(entrees: readonly string[]): readonly (readonly boolean[])[] {
  const nombre = entrees.length
  return Array.from({ length: 2 ** nombre }, (_, rang) =>
    entrees.map((_, place) => ((rang >> (nombre - 1 - place)) & 1) === 1),
  )
}

const enMot = (valeur: boolean) => (valeur ? 'VRAI' : 'FAUX')

/** Un cas en mots : « A FAUX, B VRAI ». */
export const casEnMots = (entrees: readonly string[], cas: readonly boolean[]): string =>
  entrees.map((entree, place) => `${entree} ${enMot(cas[place] === true)}`).join(', ')

/**
 * La réponse en texte, telle que la page l'envoie au correcteur : une ligne par cas,
 * « A FAUX, B FAUX : NON B VRAI ; A OU NON B VRAI ». `valeurs` : une ligne par cas, une valeur par colonne.
 */
export function texteDeLaTable(saisie: Grille, valeurs: readonly (readonly boolean[])[]): string {
  return casDeLaTable(saisie.entrees)
    .map(
      (cas, ligne) =>
        `${casEnMots(saisie.entrees, cas)} : ${saisie.colonnes
          .map((colonne, place) => `${colonne} ${enMot(valeurs[ligne]?.[place] === true)}`)
          .join(' ; ')}`,
    )
    .join('\n')
}

/** Ce que l'apprenant voit de la table, en une phrase : pour le texte de la fiche et pour « Écouter ». */
export function lectureDeLaTable(saisie: Grille): string {
  const cas = casDeLaTable(saisie.entrees)
  const premier = cas[0] ?? []
  const dernier = cas[cas.length - 1] ?? []
  return `Une table à remplir, une ligne par cas, de ${casEnMots(saisie.entrees, premier)} à ${casEnMots(saisie.entrees, dernier)}. Pour chaque ligne, choisis VRAI ou FAUX pour ${saisie.colonnes.join(', puis pour ')}.`
}

/** La forme d'une ligne de réponse, pour qui répond en texte (l'apprenant neuf) : « A FAUX, B FAUX : NON B VRAI ou FAUX ; … ». */
export function modeleDeLigne(saisie: Grille): string {
  const premier = casDeLaTable(saisie.entrees)[0] ?? []
  return `${casEnMots(saisie.entrees, premier)} : ${saisie.colonnes.map((colonne) => `${colonne} VRAI ou FAUX`).join(' ; ')}`
}
