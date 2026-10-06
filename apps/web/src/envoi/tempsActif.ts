/** Une seconde compte si l'onglet est visible et qu'il s'est passé quelque chose dans les 60 s. */
export const FENETRE_ACTIVITE_MS = 60_000

export interface OptionsCompteur {
  readonly maintenantMs: () => number
  readonly visible: () => boolean
}

/**
 * Le compteur de temps actif d'une page de bloc. `battre` est appelé chaque seconde ; `activite`
 * à chaque message de la fiche ou saisie dans l'appli ; `prendre` rend les secondes comptées et
 * repart de zéro.
 */
export function creerCompteurTempsActif({ maintenantMs, visible }: OptionsCompteur) {
  let secondes = 0
  let derniere = Number.NEGATIVE_INFINITY
  return {
    activite(): void {
      derniere = maintenantMs()
    },
    battre(): void {
      if (visible() && maintenantMs() - derniere <= FENETRE_ACTIVITE_MS) secondes += 1
    },
    prendre(): number {
      const comptees = secondes
      secondes = 0
      return comptees
    },
  }
}
