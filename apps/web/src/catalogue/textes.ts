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
    'Un bloc est acquis quand tu l’expliques, le fais seul, le transfères et le retiens.',
  ouvrir: 'Ouvrir le bloc',
  reprendre: 'Reprendre',
} as const

export const TEXTES_PREREQUIS = {
  titre: 'Prérequis manquant',
  fermer: 'Fermer',
  champ: 'Pourquoi l’ouvrir quand même ?',
  exemple: 'Ex. : je veux seulement survoler le sujet',
  ouvrirQuandMeme: 'Ouvrir quand même',
  raisonTropCourte: 'Écris au moins 3 caractères.',
  erreurServeur: 'Impossible d’ouvrir le bloc. Réessaie.',
} as const

export const RAISON_MIN = 3

export const texteConseil = (manquants: readonly string[]) =>
  manquants.length === 1
    ? `${manquants[0] ?? ''} n’est pas encore acquis provisoirement. La méthode conseille de le consolider d’abord.`
    : `${manquants.join(', ')} ne sont pas encore acquis provisoirement. La méthode conseille de les consolider d’abord.`

export const texteAllerA = (code: string) => `Aller à ${code}`
