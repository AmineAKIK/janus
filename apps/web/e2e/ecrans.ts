export interface Ecran {
  readonly nom: string
  /** Chemin relatif à la base de l'appli (`./` pour l'accueil). */
  readonly chemin: string
  /** Texte à attendre à l'écran avant de prendre la capture. */
  readonly etat?: string
}

/** Écrans photographiés à chaque PR, en 4 captures chacun. */
export const ecrans: readonly Ecran[] = [
  { nom: 'accueil', chemin: './', etat: 'Janus' },
  { nom: 'vitrine', chemin: './vitrine.html', etat: 'Vitrine' },
]
