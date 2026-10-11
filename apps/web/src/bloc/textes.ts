export const TEXTES_BLOC = {
  retour: 'Retour aux blocs',
  enregistre: '✓ Enregistré',
  chargement: 'Chargement de la fiche…',
  muette: 'La fiche ne répond pas.',
  recharger: 'Recharger la fiche',
  erreur: 'Impossible de charger ce bloc.',
  reessayer: 'Réessayer',
  etapes: 'Étapes de la fiche',
  etapeSurTotal: (titre: string, rang: number, total: number) =>
    `${titre} · étape ${String(rang)} sur ${String(total)}`,
  envoyee: 'Envoyée dès le retour du réseau.',
  stockageIndisponible: 'Les réponses ne peuvent pas être gardées sur cet appareil.',
  conflit: 'Ce bloc a été modifié sur un autre appareil.',
  faite: '✓',
  verrou: '🔒',
  verrouillee: 'Verrouillée tant que la série n’est pas envoyée',
} as const

export const TEXTES_REVOIR_COURS = {
  titre: 'Revoir le cours maintenant ?',
  corps: 'Tes réponses pas encore envoyées ne compteront pas comme preuve.',
  rester: 'Rester',
  revoir: 'Revoir le cours',
  fermer: 'Fermer',
} as const

export const textesRefus = (nombre: number) =>
  `Cette fiche ne peut pas s’ouvrir : son manifeste est incomplet (${nombre === 1 ? '1 problème' : `${String(nombre)} problèmes`}).`

export const PROBLEMES_POIGNEE_DE_MAIN = {
  schema: 'La fiche ne parle pas la bonne version du pont (schéma 2 attendu).',
  version: 'La version de la fiche n’est pas celle du manifeste importé.',
} as const

export const TEXTES_ERREUR_IA = {
  titre: 'Erreur critique repérée par l’IA · À confirmer',
  consequence: (code: string) =>
    `Si tu confirmes, ${code} passe à À reprendre jusqu’à ce que tu réussisses une question sur ce point.`,
  confirmer: 'C’est bien une erreur',
  rejeter: 'Ce n’en est pas une',
} as const
