import { accorder } from './calculs.ts'

export const TEXTES = {
  titreFormations: 'Formations',
  introFormations: 'Retrouve tes parcours et l’état réel de tes acquis.',
  retourFormations: 'Formations',
  formationNonCommencee: 'Formation non commencée · contenu prêt à être importé',
  aucuneFormation: 'Aucune formation pour le moment.',
  aucunModule: 'Aucun module pour le moment.',
  chargement: 'Chargement…',
  erreur: 'Impossible de charger cet écran.',
  reessayer: 'Réessayer',
  legende: 'Légende des statuts',
  repartition: 'Répartition des statuts',
  aucunBloc: 'Aucun bloc n’est encore importé.',
} as const

export const texteModules = (nombre: number) => accorder(nombre, 'module', 'modules')

export const texteResume = (modules: number, blocsDuModuleEnCours: number | null) =>
  blocsDuModuleEnCours === null
    ? texteModules(modules)
    : `${texteModules(modules)} · ${accorder(blocsDuModuleEnCours, 'bloc', 'blocs')} dans le module en cours`

export const texteAcquis = (acquis: number, total: number) =>
  `${accorder(acquis, 'bloc acquis', 'blocs acquis')} sur ${String(total)}`

export const texteModule = (ordre: number, titre: string) => `Module ${String(ordre)} · ${titre}`

export const texteCompteursModule = (total: number, ouverts: number, acquis: number) =>
  `${accorder(total, 'bloc', 'blocs')} · ${accorder(ouverts, 'ouvert', 'ouverts')} · ${accorder(acquis, 'acquis', 'acquis')}`

export const TEXTES_BLOCS = {
  titreParDefaut: 'Blocs',
  filtre: 'Filtrer les blocs',
  tous: 'Tous',
  aFaire: 'À faire',
  aReprendre: 'À reprendre',
  aucunBlocFiltre: 'Aucun bloc ne correspond à ce filtre.',
  aucunBloc: 'Aucun bloc dans ce module.',
  filAriane: 'Fil d’Ariane',
} as const

export const texteBlocs = (nombre: number) => accorder(nombre, 'bloc', 'blocs')
export const titreModule = (ordre: number) => `Module ${String(ordre)}`

export const TEXTES_DETAIL = {
  panneau: 'Détail du bloc',
  objectif: 'Objectif',
  prerequis: 'Prérequis',
  aucunPrerequis: 'aucun',
  erreurCritique: 'Erreur critique',
  cinqPreuves: 'Cinq preuves',
  explicationPreuves:
    'Un bloc est acquis quand tu prouves que tu comprends, que tu fais seul, que tu transfères et que tu retiens.',
  ouvrir: 'Ouvrir le bloc',
  reprendre: 'Reprendre',
} as const
