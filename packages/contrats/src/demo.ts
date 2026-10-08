import { z } from 'zod'
import { ResultatVerification } from './api/apprentissage.ts'
import { IdeeJournal, NoteJournal } from './api/suivi.ts'
import { Confiance, Niveau, NoteCarte, TypeDifferee, TypeVerification } from './enums.ts'
import { Fait, InstantUtc } from './faits.ts'
import { CodeBloc, CorrectionRecue, EtatPage, IdUuid, Identifiant } from './pont.ts'
import { TypeEtape } from './manifeste.ts'
import { Reglages } from './reglages.ts'

// Ce que le backend de démo (dans le navigateur) garde entre deux rechargements de la page.

/** Les interrupteurs de démo, pour afficher les états Figma qui dépendent du serveur. */
export const InterrupteursDemo = z.strictObject({
  correctionIndisponible: z.boolean(),
  correctionNonVerifiee: z.boolean(),
  plafondAtteint: z.boolean(),
  horsConnexion: z.boolean(),
  /** Ajoute une seconde formation, dont aucun module n'est importé. */
  deuxFormations: z.boolean().default(false),
  /** Le manifeste de chaque bloc rend 3 problèmes : la fiche ne s'ouvre pas. */
  ficheRefusee: z.boolean().default(false),
  /** Toutes les routes de démo mettent 2 secondes à répondre. */
  reseauLent: z.boolean().default(false),
  /** Toutes les tâches de la journée sont faites : Aujourd'hui montre « Rien d'autre n'est dû ». */
  toutFait: z.boolean().default(false),
  /** La prochaine correction propose la première erreur critique du manifeste du bloc. */
  erreurIa: z.boolean().default(false),
})
export type InterrupteursDemo = z.infer<typeof InterrupteursDemo>

/** Une vérification de la démo : ses trois parties tirées, les réponses reçues et, à la fin, son résultat. */
export const VerificationDemo = z.strictObject({
  bloc: CodeBloc,
  type: TypeVerification,
  parties: z.array(z.strictObject({ id: Identifiant, type: TypeDifferee })),
  /** Un instant : le début, c'est la première réponse reçue. */
  debut: InstantUtc.nullable(),
  reponses: z.record(
    Identifiant,
    z.strictObject({
      date: InstantUtc,
      compte: z.boolean(),
      niveau: Niveau.optional(),
      reussi: z.boolean().optional(),
      cas: z
        .strictObject({ reussis: z.number().int().min(0), total: z.number().int().min(1) })
        .optional(),
      correction: z.string(),
      indice: z.string().optional(),
      reponse: z.string(),
    }),
  ),
  /** Le jour `AAAA-MM-JJ` jusqu'auquel Amine a reporté la vérification. */
  reporteeJusqua: z.string().nullable(),
  resultat: ResultatVerification.nullable(),
})
export type VerificationDemo = z.infer<typeof VerificationDemo>

export const EtatDemo = z.strictObject({
  version: z.literal(1),
  /** Les faits de la graine sont datés par rapport à cet instant. */
  premierLancement: InstantUtc,
  /** Décalage de l'horloge de démo, en millisecondes (positif : on avance dans le temps). */
  decalageMs: z.number().int(),
  utilisateur: z.strictObject({
    id: IdUuid,
    nom_utilisateur: z.string().min(1),
    fuseau: z.string().min(1),
  }),
  /** Le mot de passe du compte de démo, que « Changer le mot de passe » modifie. */
  motDePasse: z.string().min(1).default('demo-janus'),
  /** Les autres appareils connectés (la session courante est implicite). */
  sessions: z
    .array(
      z.strictObject({
        id: IdUuid,
        appareil: z.string().min(1),
        creee_le: InstantUtc,
        derniere_activite: InstantUtc,
      }),
    )
    .default([]),
  /** Vrai tant que la session simulée (le cookie) est ouverte. */
  sessionOuverte: z.boolean(),
  /** Les échecs de connexion de la dernière minute. */
  echecsConnexion: z.array(InstantUtc),
  /** La connexion est bloquée jusqu'à cet instant (« Trop d'essais »). */
  connexionBloqueeJusqua: InstantUtc.nullable(),
  reglages: Reglages,
  faits: z.array(Fait),
  etatsPage: z.record(CodeBloc, EtatPage),
  /** La série de questions de début de séance du jour : tirée une fois, elle ne change plus avant demain. */
  serieDuJour: z
    .strictObject({
      jour: z.string(),
      questions: z.array(z.strictObject({ bloc: CodeBloc, question: Identifiant })),
    })
    .nullable()
    .default(null),
  /** L'état FSRS des cartes déjà vues, par identifiant de carte. */
  cartes: z
    .record(
      Identifiant,
      z.strictObject({
        echeance: InstantUtc,
        stabilite: z.number(),
        difficulte: z.number(),
        joursProgrammes: z.number(),
        etapeApprentissage: z.number(),
        repetitions: z.number(),
        oublis: z.number(),
        phase: z.enum(['nouvelle', 'apprentissage', 'revision', 'reapprentissage']),
        derniereRevision: InstantUtc.nullable(),
      }),
    )
    .default({}),
  /** Les réponses aux questions de début de séance : de quoi reprendre la série après un départ. */
  rappels: z
    .record(
      Identifiant,
      z.strictObject({
        jour: z.string(),
        bloc: CodeBloc,
        confiance: Confiance,
        reponse: z.string(),
        correction: CorrectionRecue,
      }),
    )
    .default({}),
  /** Chaque carte notée, dans l'ordre : de quoi mesurer la rétention par semaine. */
  /** Les revues de la méthode faites, avec le texte quand il y en a un. */
  revuesMethode: z
    .array(z.strictObject({ id: IdUuid, date: InstantUtc, texte: z.string().optional() }))
    .default([]),
  /** Chaque correction rendue : mise à l'avis d'Amine ou non, vérifiée ou non, et son avis une fois donné. */
  controlesCorrections: z
    .array(
      z.strictObject({
        correction: Identifiant,
        date: InstantUtc,
        echantillon: z.boolean(),
        nonVerifiee: z.boolean(),
        accord: z.boolean().nullable(),
      }),
    )
    .default([]),
  /** Le temps actif reçu, minute par minute, avec le type de l'étape quand l'appli le donnait. */
  tempsActif: z
    .array(
      z.strictObject({
        date: InstantUtc,
        bloc: CodeBloc,
        secondes: z.number().int().min(1),
        etape: TypeEtape.optional(),
      }),
    )
    .default([]),
  revuesCartes: z.array(z.strictObject({ date: InstantUtc, note: NoteCarte })).default([]),
  verifications: z.record(IdUuid, VerificationDemo).default({}),
  /** Les notes d'Amine sur les lignes du journal, par identifiant de note. */
  notesJournal: z.record(IdUuid, NoteJournal).default({}),
  /** « À explorer plus tard » : les idées, dans l'ordre où elles sont arrivées. */
  idees: z.array(IdeeJournal).default([]),
  /** Les identifiants de messages déjà reçus : un doublon est ignoré. */
  idsRecus: z.array(z.string()),
  interrupteurs: InterrupteursDemo,
})
export type EtatDemo = z.infer<typeof EtatDemo>
