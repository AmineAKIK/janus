import type { Reglages } from '@janus/contrats'

export const TEXTES_PARAMETRES = {
  titre: 'Paramètres',
  introduction:
    'Les préférences règlent ton confort, jamais les règles de preuve. Les délais et seuils méthodologiques restent en lecture seule.',
  sommaire: 'Sur cette page',
  choisir: 'Choisis une section',
  retour: 'Paramètres',
  parDefaut: (valeur: string) => `Par défaut : ${valeur}`,
  revenir: 'Revenir à la valeur par défaut',
  conflit: 'Ces réglages ont changé sur un autre appareil.',
  erreurEnregistrement: 'Le réglage n’a pas été enregistré. Réessaie.',
  pied: (nom: string) => `${nom} ne vend pas tes données.`,
  chargement: 'Chargement…',
  erreur: 'Les paramètres ne se sont pas chargés.',
  reessayer: 'Réessayer',
} as const

export const TEXTES_REVISION = {
  nouvellesCartes: 'Nouvelles cartes par jour',
  nouvellesCartesAide: 'Le plafond touche seulement les nouvelles cartes.',
  retention: 'Rétention visée',
  retentionAide: 'La part des cartes que tu veux encore savoir au moment de les revoir.',
  questionsDebut: 'Questions de début de séance',
  questionsDebutAide: 'Entre 5 et 10 questions.',
} as const

export const TEXTES_COMPTE = {
  nomUtilisateur: 'Nom d’utilisateur',
  fuseau: 'Fuseau horaire',
  heureBascule: 'Heure de bascule du jour',
  motDePasse: 'Mot de passe',
  changer: 'Changer le mot de passe',
  actuel: 'Mot de passe actuel',
  nouveau: 'Nouveau mot de passe',
  nouveauAide: '12 caractères au moins, 72 octets au plus.',
  confirmation: 'Confirmation du nouveau mot de passe',
  differents: 'Les deux mots de passe ne sont pas identiques.',
  obligatoire: 'Ce champ est obligatoire.',
  enregistrer: 'Enregistrer',
  annuler: 'Annuler',
  motDePasseChange: 'Mot de passe changé.',
  sessions: 'Sessions ouvertes',
  cetteSession: 'Cette session',
  deconnecter: 'Déconnecter',
  seDeconnecter: 'Se déconnecter',
} as const

export const texteActivite = (intervalle: string) => `Dernière activité : il y a ${intervalle}`

export const TEXTES_DONNEES = {
  toutes: 'Toutes mes données',
  toutesAide: 'Fiches, réponses, réglages et historique · JSON',
  exporter: 'Exporter',
  nomFichier: 'janus-donnees.json',
  echec: 'L’export n’a pas pu être préparé. Réessaie.',
} as const

export const TEXTES_ZONE = {
  supprimer: 'Supprimer mon compte',
  aide: 'Efface définitivement les fiches, réponses et journaux.',
  titreDialogue: 'Supprimer mon compte ?',
  liste: ['Tes fiches', 'Tes réponses', 'Ton journal', 'Tes réglages'],
  avant: 'Avant de continuer',
  exporte: 'Exporte tes données si tu souhaites en garder une copie.',
  motDePasse: 'Mot de passe',
  definitivement: 'Supprimer définitivement',
  annuler: 'Annuler',
} as const

export const TEXTES_DEMO = {
  avancer: [
    { libelle: 'Avancer d’une heure', ms: 3_600_000 },
    { libelle: 'Avancer d’un jour', ms: 86_400_000 },
    { libelle: 'Avancer de 3 jours', ms: 3 * 86_400_000 },
    { libelle: 'Avancer de 30 jours', ms: 30 * 86_400_000 },
  ],
  heure: 'Heure de démo',
  zero: 'Remettre la démo à zéro',
  vide: 'Compte vide',
  interrupteurs: 'Interrupteurs de démo',
} as const

export const LIBELLES_INTERRUPTEURS = {
  correctionIndisponible: 'Correction indisponible',
  correctionNonVerifiee: 'Correction non vérifiée',
  plafondAtteint: 'Plafond de dépense atteint',
  horsConnexion: 'Hors connexion',
  deuxFormations: 'Deux formations',
  ficheRefusee: 'Fiche refusée',
  reseauLent: 'Réseau lent',
  toutFait: 'Tout est fait aujourd’hui',
  erreurIa: 'Le tuteur propose une erreur critique',
} as const

export const TEXTES_RAPPELS = {
  introduction: 'C’est toi qui décides quand tu travailles. Le rappel dit seulement ce qui est dû.',
  notifications: 'Notifications sur cet appareil',
  activer: 'Activer',
  indisponible: 'Disponible quand l’appli tourne sur le serveur.',
  autorisees: 'Autorisées sur cet appareil.',
  refusees: 'Refusées par ce navigateur.',
  heure: 'Heure du rappel',
  pause: 'Pause jusqu’au',
  aucunePause: 'Aucune',
  reprendre: 'Reprendre les rappels',
} as const

export const TEXTES_IA = {
  depense: 'Dépense ce mois-ci',
  plafond: 'Plafond mensuel (en euros)',
  plafondErreur: 'Le plafond doit être un nombre entre 0 et 100 €.',
  limite: 'Limite d’appels',
  limiteValeur: (appels: number) => `${String(appels)} appels par heure`,
  confidentialite:
    'Tes réponses et l’extrait de fiche concerné sont envoyés au service de correction, sans ton nom d’utilisateur.',
  plafondAtteint:
    'Plafond atteint : les corrections reprendront le 1er du mois prochain, ou relève le plafond.',
} as const

export const TEXTES_HORS_LIGNE = {
  synchronisation: 'Synchronisation',
  synchronise: 'Tout est synchronisé',
  espace: 'Espace fiches',
  espaceValeur: (megaoctets: string) => `${megaoctets} Mo sur cet appareil`,
  espaceInconnu: 'Non mesurable sur ce navigateur.',
} as const

export const TEXTES_REGLES = {
  badge: 'Règle protégée',
  explication: 'Les délais méthodologiques restent en lecture seule pour préserver la preuve.',
} as const

export const TEXTES_AFFICHAGE = {
  apparence: 'Apparence',
  taille: 'Taille du texte',
} as const

/** Un nombre à la française, avec le nombre de décimales voulu : 0,90. */
export const nombreFrancais = (valeur: number, decimales = 0) =>
  valeur.toFixed(decimales).replace('.', ',')

export function texteDuree(minutes: number): string {
  if (minutes % 1440 === 0) return `${String(minutes / 1440)} j`
  if (minutes % 60 === 0) return `${String(minutes / 60)} h`
  return `${String(minutes)} min`
}

const nomsNombres = new Map([
  [1, 'Un'],
  [2, 'Deux'],
  [3, 'Trois'],
  [4, 'Quatre'],
  [5, 'Cinq'],
])

export function texteEchecs(echecs: number): string {
  const nombre = nomsNombres.get(echecs) ?? String(echecs)
  return `${nombre} échec${echecs > 1 ? 's' : ''} pour descendre`
}

export function texteEntretien(mois: readonly number[]): string {
  const liste = mois.map(String)
  const dernier = liste.pop()
  if (dernier === undefined) return 'Aucun'
  return `${liste.length > 0 ? `${liste.join(', ')} et ` : ''}${dernier} mois`
}

export interface LigneRegle {
  readonly libelle: string
  readonly valeur: string
}

export function lignesRegles(reglages: Reglages): readonly LigneRegle[] {
  return [
    { libelle: 'Consolidation', valeur: texteDuree(reglages.delaiConsolidationMinutes) },
    { libelle: 'Vérification', valeur: `${String(reglages.delaiVerificationJours)} j` },
    { libelle: 'Retest', valeur: `${String(reglages.delaiRetestJours)} j` },
    { libelle: 'Entretien', valeur: texteEntretien(reglages.entretienMois) },
    { libelle: 'Nouvelle tentative', valeur: `${String(reglages.delaiNouvelEssaiJours)} j` },
    { libelle: 'Échecs avant descente', valeur: texteEchecs(reglages.echecsAvantDescente) },
    {
      libelle: 'Seuil de consolidation',
      valeur: `${String(Math.round(reglages.seuilConsolidation * 100))} %`,
    },
    { libelle: 'Revue', valeur: `Tous les ${String(reglages.blocsEntreRevues)} blocs` },
  ]
}
