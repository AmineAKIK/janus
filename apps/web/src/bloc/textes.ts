export const TEXTES_BLOC = {
  retour: 'Retour aux blocs',
  enregistre: '✓ Enregistré',
  chargement: 'Chargement de la fiche…',
  muette: 'La fiche ne répond pas.',
  recharger: 'Recharger la fiche',
  erreur: 'Impossible de charger ce bloc.',
  reessayer: 'Réessayer',
  etapes: 'Étapes de la fiche',
  envoyee: 'Envoyée dès le retour du réseau.',
  stockageIndisponible: 'Les réponses ne peuvent pas être gardées sur cet appareil.',
  conflit: 'Ce bloc a été modifié sur un autre appareil.',
  faite: '✓',
} as const

export const textesRefus = (nombre: number) =>
  `Cette fiche ne peut pas s’ouvrir : son manifeste est incomplet (${nombre === 1 ? '1 problème' : `${String(nombre)} problèmes`}).`

export const PROBLEMES_POIGNEE_DE_MAIN = {
  schema: 'La fiche ne parle pas la bonne version du pont (schéma 2 attendu).',
  version: 'La version de la fiche n’est pas celle du manifeste importé.',
} as const
