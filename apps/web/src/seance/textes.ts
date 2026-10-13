export const TEXTES_SEANCE = {
  quitter: 'Quitter',
  continuer: 'Continuer',
  etapeSuivante: 'Étape suivante',
} as const

export const texteEtapeSuivante = (tache: string) => `Étape suivante : ${tache}`
