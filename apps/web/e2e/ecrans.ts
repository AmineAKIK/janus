export interface Ecran {
  readonly nom: string
  /** Chemin relatif à la base de l'appli (`./` pour l'accueil, `./#/…` pour les écrans de l'appli). */
  readonly chemin: string
  /** Titre (`h1`) à attendre à l'écran avant de prendre la capture. */
  readonly etat: string
}

/** Écrans photographiés à chaque PR, en 4 captures chacun. */
export const ecrans: readonly Ecran[] = [
  { nom: 'vitrine', chemin: './vitrine.html', etat: 'Vitrine' },
  { nom: 'accueil', chemin: './#/', etat: 'Aujourd’hui' },
  { nom: 'connexion', chemin: './#/connexion', etat: 'Connexion' },
  { nom: 'questions', chemin: './#/questions', etat: 'Questions de début de séance' },
  { nom: 'formations', chemin: './#/formations', etat: 'Formations' },
  { nom: 'modules', chemin: './#/formations/dwwm', etat: 'Modules' },
  { nom: 'blocs', chemin: './#/modules/m1', etat: 'Blocs' },
  { nom: 'bloc', chemin: './#/blocs/b05', etat: 'Page de bloc' },
  { nom: 'revision', chemin: './#/revision', etat: 'Révision' },
  { nom: 'verification', chemin: './#/verifications/v1', etat: 'Vérification' },
  { nom: 'tableau-de-bord', chemin: './#/tableau-de-bord', etat: 'Tableau de bord' },
  { nom: 'journal', chemin: './#/journal', etat: 'Journal' },
  { nom: 'parametres', chemin: './#/parametres', etat: 'Paramètres' },
  { nom: 'parametres-section', chemin: './#/parametres/revision', etat: 'Paramètres' },
  { nom: 'fiche-demo', chemin: './fiches/demo/fiche-demo.html', etat: 'Bloc de démonstration' },
  { nom: 'introuvable', chemin: './#/n-existe-pas', etat: 'Cette page n’existe pas' },
]
