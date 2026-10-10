export const TEXTES_JOURNAL = {
  titreEcran: 'Journal',
  module: 'Module',
  bloc: 'Bloc',
  type: 'Type',
  tous: 'Tous',
  filtres: 'Filtres',
  toutEffacer: 'Tout effacer',
  appliquer: 'Voir le journal',
  etatBlocs: 'État des blocs',
  ouvrirBloc: 'Ouvrir le bloc',
  contestationEnAttente: 'Contestation en attente',
  ajouterNote: '+ Ajouter une note',
  maNote: 'Ma note',
  modifier: 'Modifier',
  enregistrer: 'Enregistrer',
  annuler: 'Annuler',
  champNote: 'Ta note',
  erreurNote: 'La note n’a pas pu être enregistrée. Réessaie.',
  idees: 'À explorer plus tard',
  champIdee: 'Ajouter une idée',
  ajouterIdee: 'Ajouter',
  aucuneIdee: 'Aucune idée pour l’instant.',
  erreurIdee: 'L’idée n’a pas pu être enregistrée. Réessaie.',
  exporterTexte: 'Exporter en texte',
  exporterJson: 'Exporter en JSON',
  nomFichierTexte: 'journal-janus.txt',
  nomFichierJson: 'journal-janus.json',
  erreurExport: 'L’export n’a pas pu être fait. Réessaie.',
  videFiltres: 'Rien dans le journal pour ces filtres.',
  videSansFiltre: 'Le journal se remplit dès ta première séance.',
  voirPlus: 'Voir plus',
  fermer: 'Fermer',
} as const

export const NOTE_MAX = 1000

export const texteFiltres = (actifs: number) => `Filtres · ${String(actifs)}`
export const texteRetirer = (filtre: string) => `Retirer le filtre ${filtre}`
export const texteEtatBloc = (bloc: string, statut: string) => `${bloc} · ${statut}`

export const texteEvenements = (n: number) => `${String(n)} ${n < 2 ? 'événement' : 'événements'}`
