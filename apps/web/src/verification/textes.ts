import type { ROUTES, SortieRoute, Statut, TypeDifferee, TypeVerification } from '@janus/contrats'
import { LIBELLES_STATUT } from '@janus/ui'
import { texteJourCourt } from '../revision/textes.ts'

export type ResultatVerification = NonNullable<
  SortieRoute<(typeof ROUTES)['GET /verifications/:id']>['resultat']
>

export const TEXTES_VERIFICATION = {
  titre: 'Vérification',
  quitter: 'Quitter',
  enTeteVerification: 'Vérification · bloc masqué',
  enTeteRetest: 'Retest · bloc masqué',
  introTitre: 'Vérifier ce qui tient dans le temps',
  introAnonyme:
    'Le bloc restera anonyme jusqu’au résultat. Les corrections seront révélées à la fin.',
  introResume: '1 vérification · 3 parties · sans aide',
  introConsigne: 'Réponds de mémoire, sans ouvrir tes notes.',
  commencer: 'Commencer',
  revuTitre: 'Ce bloc a été revu récemment',
  revuExplication:
    'Attendre un jour permet de mesurer une mémoire durable, sans confondre reconnaissance récente et maîtrise.',
  reporter: 'La reporter à demain',
  faireQuandMeme: 'La faire quand même',
  confiance: 'Ton niveau de confiance',
  reponseLibre: 'Réponse libre',
  aideExplication: 'Je reformule le concept avec mes propres mots.',
  ecrisIci: 'Écris ta réponse ici',
  envoyer: 'Envoyer',
  envoyerTache: 'Envoyer la tâche',
  reponseEnregistree: '✓ Réponse enregistrée',
  tesCas: 'Tester les cas',
  ton: 'Ton code',
  taReponse: 'Ta réponse',
  collage: 'Tu as collé du texte. Cette réponse ne comptera pas comme preuve.',
  obligatoire: 'Ce champ est obligatoire.',
  correctionEnCours: 'Le tuteur corrige tes 2 réponses…',
  correctionAttente: 'Les corrections apparaîtront ensemble quand l’analyse sera terminée.',
  indisponible: 'Correction indisponible pour l’instant. Tes réponses sont gardées.',
  reessayer: 'Réessayer',
  reussie: 'Vérification réussie',
  nonValidee: 'Vérification non validée',
  aExaminer: 'Résultat à examiner',
  statutInchange: 'Statut inchangé',
  preuveTient: 'La preuve tient dans les trois parties.',
  aConfirmer: 'À confirmer',
  extrait: 'Extrait de ta réponse',
  confirmer: 'Confirmer l’erreur',
  demanderRevue: 'Demander une revue',
  etapeSuivante: 'Étape suivante',
  retour: 'Retour à Aujourd’hui',
  dialogueTitre: 'Quitter la vérification ?',
  dialogueTexte: 'Tes réponses envoyées sont gardées. Tu reprendras à la partie suivante.',
  continuer: 'Continuer',
  chargement: 'Chargement…',
} as const

export const LIBELLES_PARTIE: Readonly<Record<TypeDifferee, string>> = {
  explication: 'Explication',
  tache: 'Tâche',
  transfert: 'Transfert',
}

export const texteEnTete = (type: TypeVerification) =>
  type === 'verification'
    ? TEXTES_VERIFICATION.enTeteVerification
    : TEXTES_VERIFICATION.enTeteRetest

export const texteRevuLe = (quand: 'hier' | 'aujourdhui') =>
  `Tu as ouvert ce bloc ${quand === 'hier' ? 'hier' : 'aujourd’hui'}. Cette vérification ne compterait pas.`

export const texteEssai = (essai: number) => `Essai ${String(essai)} sur 2`

export const texteCasReussis = (reussis: number, total: number) =>
  `${String(reussis)} cas sur ${String(total)}`

export const texteCetait = (code: string, titre: string) => `C’était ${code} ${titre}`

export const textePasseA = (code: string, statut: Statut) =>
  `${code} passe à ${LIBELLES_STATUT[statut]}`

export const texteDescendA = (code: string, statut: Statut) =>
  `${code} descend à ${LIBELLES_STATUT[statut]}`

export function texteProchaineEcheance(
  issue: ResultatVerification['issue'],
  prochaine: NonNullable<ResultatVerification['prochaine']>,
): string {
  const date = texteJourCourt(prochaine.apres)
  if (issue === 'reussie') {
    const nom = { verification: 'vérification', retest: 'retest', entretien: 'entretien' }[
      prochaine.type
    ]
    return `Prochain${prochaine.type === 'verification' ? 'e' : ''} ${nom} le ${date}`
  }
  const nouveau = {
    verification: 'Nouvelle vérification',
    retest: 'Nouveau retest',
    entretien: 'Nouvel entretien',
  }[prochaine.type]
  return `${nouveau} le ${date}`
}

export const texteSiConfirmee = (code: string) =>
  `Si cette erreur se confirme, ${code} passera à « À reprendre » et une nouvelle vérification sera planifiée.`
