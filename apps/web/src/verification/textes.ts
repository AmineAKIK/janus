import type { ROUTES, SortieRoute, Statut, TypeDifferee, TypeVerification } from '@janus/contrats'
import { LIBELLES_STATUT } from '@janus/ui'
import { texteJourCourt } from '../revision/textes.ts'

export type ResultatVerification = NonNullable<
  SortieRoute<(typeof ROUTES)['GET /verifications/:id']>['resultat']
>

export const TEXTES_VERIFICATION = {
  titre: 'Vérification',
  enTeteVerification: 'Vérification · bloc masqué',
  enTeteRetest: 'Retest · bloc masqué',
  introTitre: 'Vérifier ce qui tient dans le temps',
  introAnonyme:
    'Le bloc restera anonyme jusqu’au résultat. Les corrections seront révélées à la fin.',
  introConsigne: 'Réponds de mémoire, sans ouvrir tes notes.',
  commencer: 'Commencer',
  revuTitre: 'Ce bloc a été revu récemment',
  revuExplication:
    'Attendre un jour permet de mesurer une mémoire durable, sans confondre reconnaissance récente et maîtrise.',
  reporter: 'La reporter à demain',
  reporterTitre: 'Reporter la vérification ?',
  reporterMessage: 'La vérification est reportée à demain.',
  annuler: 'Annuler',
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
  criteres: 'Critères atteints',
  criteresAide:
    'Coche seulement ce que tu as réellement obtenu. Cette réussite repose sur ta parole.',
  niveauAide: 'Ton niveau d’aide',
  declaree: 'Déclarée par toi',
  collage: 'Tu as collé du texte. Cette réponse ne comptera pas comme preuve.',
  obligatoire: 'Ce champ est obligatoire.',
  correctionAttente: 'Les corrections apparaîtront ensemble quand l’analyse sera terminée.',
  indisponible: 'Correction indisponible pour l’instant. Tes réponses sont gardées.',
  reessayer: 'Réessayer',
  reussie: 'Vérification réussie',
  nonValidee: 'Vérification non validée',
  aExaminer: 'Résultat à examiner',
  statutInchange: 'Statut inchangé',
  aConfirmer: 'À confirmer',
  extrait: 'Extrait de ta réponse',
  confirmer: 'Confirmer l’erreur',
  demanderRevue: 'Demander une revue',
  retour: 'Retour à Aujourd’hui',
  dialogueTitre: 'Quitter la vérification ?',
  dialogueTexte: 'Tes réponses envoyées sont gardées. Tu reprendras à la partie suivante.',
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

const EN_LETTRES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six'] as const
const enLettres = (n: number) => EN_LETTRES[n] ?? String(n)

/** « 1 vérification · 2 parties · sans aide » : le nombre de parties vient du tirage. */
export const texteIntroResume = (parties: number) =>
  `1 vérification · ${String(parties)} ${parties === 1 ? 'partie' : 'parties'} · sans aide`

/** « La preuve tient dans les deux parties. » */
export const textePreuveTient = (parties: number) =>
  parties === 1
    ? 'La preuve tient dans cette partie.'
    : `La preuve tient dans les ${enLettres(parties)} parties.`

/** « Le tuteur corrige tes 2 réponses… » : les parties corrigées par le tuteur, la tâche exclue. */
export const texteCorrectionEnCours = (reponses: number) =>
  reponses === 1
    ? 'Le tuteur corrige ta réponse…'
    : `Le tuteur corrige tes ${String(reponses)} réponses…`

export const texteEssai = (essai: number) => `Essai ${String(essai)} sur 2`

export const LIBELLES_AIDE = [
  '0 : aucune aide',
  '1 : un indice',
  '2 : une piste détaillée',
  '3 : une partie de la solution',
  '4 : la solution',
] as const

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
