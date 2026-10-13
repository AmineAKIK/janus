document.documentElement.dataset.theme = 'systeme'
document.documentElement.dataset.taille = 'standard'
try {
  var theme = localStorage.getItem('janus.affichage.theme')
  var taille = localStorage.getItem('janus.affichage.taille')
  if (theme === 'clair' || theme === 'sombre') {
    document.documentElement.dataset.theme = theme
    // La barre du navigateur suit le thème choisi (mêmes couleurs que `couleurBarre.ts`).
    var couleur = theme === 'clair' ? '#ffffff' : '#14171a'
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (balise) {
      balise.content = couleur
    })
  }
  if (taille === 'petit' || taille === 'grand') document.documentElement.dataset.taille = taille
} catch {
  // Stockage indisponible : les valeurs par défaut restent.
}
