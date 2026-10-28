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

// Les premières lectures de l'appli partent avec la page, pendant que le JavaScript se télécharge : sans cela
// elles attendent qu'il soit évalué, puis que la session soit vérifiée (`GET /moi`). Ces requêtes ne sont que
// lancées ici : `transportHttp` les adopte à la première lecture de même adresse (`prechargement.ts`), valide
// la réponse comme toutes les autres, et refait l'appel si elle n'est pas un succès (session absente). Seul un
// build qui parle à l'API pose `data-api` (voir `prechargementApi` dans vite.config.ts) ; la connexion ne lit
// rien. Une lecture que l'écran n'utilise pas serait un appel perdu : chaque écran d'arrivée lance les siennes.
;(function () {
  try {
    var script = document.currentScript
    var api = script.getAttribute('data-api')
    var base = script.getAttribute('data-base') || '/'
    var ecran = location.pathname.slice(base.length)
    if (!api || ecran === 'connexion') return
    var parEcran = {
      '': ['aujourdhui', 'formations'],
      formations: ['formations'],
      journal: ['formations'],
      'tableau-de-bord': ['formations'],
      revision: ['aujourdhui'],
    }
    var lectures = ['moi', 'reglages'].concat(
      Object.prototype.hasOwnProperty.call(parEcran, ecran) ? parEcran[ecran] : [],
    )
    var lancees = {}
    lectures.forEach(function (nom) {
      var adresse = api + '/' + nom
      var reponse = fetch(adresse, {
        credentials: 'include',
        headers: { Accept: 'application/json, text/plain' },
      })
      // Une lecture qui échoue sera refaite par l'appli : aucune erreur à signaler d'ici.
      reponse.catch(function () {})
      lancees[adresse] = { debut: performance.now(), reponse: reponse }
    })
    window.janusPrecharges = lancees
  } catch {
    // Sans préchargement, l'appli lit ses données elle-même, un peu plus tard.
  }
})()
