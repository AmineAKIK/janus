import { z } from 'zod'
import { Confiance } from './enums.ts'
import { Fait, InstantUtc } from './faits.ts'
import { CodeBloc, CorrectionRecue, EtatPage, IdUuid, Identifiant } from './pont.ts'
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
  /** Les identifiants de messages déjà reçus : un doublon est ignoré. */
  idsRecus: z.array(z.string()),
  interrupteurs: InterrupteursDemo,
})
export type EtatDemo = z.infer<typeof EtatDemo>
