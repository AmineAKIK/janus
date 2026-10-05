// Textes de l'écran de connexion, repris mot pour mot des cadres Figma (page 01, 6:1010 à 6:1565).
export const TEXTES = {
  titre: 'Atelier',
  sousTitre: 'Apprendre pour de vrai, à ton rythme.',
  identifiant: 'Nom d’utilisateur',
  motDePasse: 'Mot de passe',
  rester: 'Rester connecté sur cet appareil',
  connecter: 'Se connecter',
  erreur: 'Nom d’utilisateur ou mot de passe incorrect.',
  horsConnexion: 'Pas de connexion internet. Vérifie ton réseau puis réessaie.',
} as const

/** « Trop d’essais. Réessaie dans 1 minute. » : la durée vient de la réponse du serveur. */
export function texteTropDEssais(secondes: number): string {
  const minutes = Math.max(1, Math.ceil(secondes / 60))
  return `Trop d’essais. Réessaie dans ${String(minutes)} ${minutes > 1 ? 'minutes' : 'minute'}.`
}

/** « Réessayer dans 0:58 » */
export function texteReessayer(secondes: number): string {
  const minutes = Math.floor(secondes / 60)
  const reste = String(secondes % 60).padStart(2, '0')
  return `Réessayer dans ${String(minutes)}:${reste}`
}
