document.documentElement.dataset.theme = 'systeme'
document.documentElement.dataset.taille = 'standard'
try {
  var theme = localStorage.getItem('janus.affichage.theme')
  var taille = localStorage.getItem('janus.affichage.taille')
  if (theme === 'clair' || theme === 'sombre') document.documentElement.dataset.theme = theme
  if (taille === 'petit' || taille === 'grand') document.documentElement.dataset.taille = taille
} catch {
  // Stockage indisponible : les valeurs par défaut restent.
}
