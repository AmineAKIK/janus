import { z } from 'zod'
import { Confiance, Niveau, NoteCarte, Statut, TypeDifferee, TypeVerification } from '../enums.ts'
import { InstantUtc } from '../faits.ts'
import { CodeBloc, CorrectionRecue, IdUuid, Identifiant, Reponse } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)

/** Une tâche de l'écran Aujourd'hui, dans l'ordre où le moteur les range. */
export const Tache = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('reprendre_erreur'),
    bloc: CodeBloc,
    erreur: Identifiant,
    libelle: Texte,
    /** `/blocs/<id>`, suivi de `?etape=<etape>` quand le manifeste donne l'étape de l'erreur. */
    lien: Texte,
  }),
  z.strictObject({ type: z.literal('questions_debut'), nombre: z.number().int().min(1) }),
  z.strictObject({ type: z.literal('reprise'), blocs: z.array(CodeBloc) }),
  z.strictObject({
    type: z.enum(['verification', 'retest', 'entretien']),
    bloc: CodeBloc,
    /** Le jour `AAAA-MM-JJ` à partir duquel c'est dû. */
    apres: Texte,
  }),
  z.strictObject({ type: z.literal('consolidation'), bloc: CodeBloc, apres: InstantUtc }),
  z.strictObject({
    type: z.literal('cartes'),
    dues: z.number().int().min(0),
    nouvelles: z.number().int().min(0),
  }),
  z.strictObject({ type: z.literal('bloc'), bloc: CodeBloc }),
])
export type Tache = z.infer<typeof Tache>

/** Une tâche de la journée : la tâche du moteur, où elle mène et si elle est faite aujourd'hui. */
export const TacheDuJour = z.strictObject({
  tache: Tache,
  /** Le chemin de l'appli vers la tâche, par exemple `/blocs/B03`. */
  lien: Texte,
  /** Vrai quand la tâche a été faite dans la journée : elle reste alors dans la liste. */
  faite: z.boolean(),
})
export type TacheDuJour = z.infer<typeof TacheDuJour>

/** Un bloc du module en cours, avec son statut calculé. */
const BlocDuModule = z.strictObject({
  bloc: CodeBloc,
  titre_court: Texte,
  statut: Statut,
})

/** Une question de début de séance : sans le nom du bloc, pour que les blocs restent mélangés. */
const QuestionDebut = z.strictObject({
  id: Identifiant,
  question: Texte,
  /** Présent une fois la question corrigée : c'est seulement alors que le bloc est donné. */
  deja: z
    .strictObject({
      bloc: CodeBloc,
      confiance: Confiance,
      reponse: Reponse,
      correction: CorrectionRecue,
    })
    .nullable(),
})

/** Dans combien de millisecondes la carte revient pour chaque note : ce que `ts-fsrs` appliquera. */
const ApercuCarte = z.strictObject({
  a_revoir: z.number().int().min(0),
  difficile: z.number().int().min(0),
  bien: z.number().int().min(0),
  facile: z.number().int().min(0),
})

const Carte = z.strictObject({
  id: Identifiant,
  bloc: CodeBloc,
  recto: Texte,
  verso: Texte,
  /** Vrai pour une carte jamais vue. */
  nouvelle: z.boolean(),
  apercu: ApercuCarte,
})

/** Une partie d'une vérification. Une tâche `exacte` ne dit pas la réponse attendue ; une tâche `code` donne ses cas. */
export const PartieVerification = z.strictObject({
  id: Identifiant,
  type: TypeDifferee,
  consigne: Texte,
  /** Un extrait de code à lire (transfert) : le manifeste ne le porte pas encore, la démo n'en donne pas. */
  extrait: Texte.optional(),
  tache: z
    .discriminatedUnion('mode', [
      z.strictObject({ mode: z.literal('exacte') }),
      z.strictObject({
        mode: z.literal('code'),
        langage: z.literal('js'),
        cas: z.array(z.strictObject({ entree: z.array(z.unknown()), sortie: z.unknown() })).min(1),
      }),
    ])
    .optional(),
  /** Vrai quand la réponse à cette partie est déjà envoyée : on reprend à la suivante. */
  envoyee: z.boolean(),
})

/** Ce que l'écran de résultat montre pour une partie, correction comprise. */
export const PartieCorrigee = z.strictObject({
  id: Identifiant,
  type: TypeDifferee,
  consigne: Texte,
  niveau: Niveau.optional(),
  reussi: z.boolean().optional(),
  /** Une tâche de code : cas réussis sur cas testés. */
  cas: z
    .strictObject({ reussis: z.number().int().min(0), total: z.number().int().min(1) })
    .optional(),
  compte: z.boolean(),
  correction: Texte,
  indice: Texte.optional(),
})

export const ResultatVerification = z.strictObject({
  bloc: z.strictObject({ code: CodeBloc, titre: Texte }),
  /** `a_examiner` : le tuteur propose une erreur critique qu'Amine doit confirmer ou contester. */
  issue: z.enum(['reussie', 'ratee', 'a_examiner']),
  valable: z.boolean(),
  raison_invalide: z.enum(['revu_avant', 'avec_support']).optional(),
  statut_avant: Statut,
  statut: Statut,
  /** Vrai après deux échecs de suite : le bloc descend d'un cran. */
  descend: z.boolean(),
  /** La prochaine échéance (retest, entretien ou nouvelle vérification), au jour `AAAA-MM-JJ`. */
  prochaine: z.strictObject({ type: TypeVerification, apres: Texte }).nullable(),
  parties: z.array(PartieCorrigee),
  erreur_a_confirmer: z
    .strictObject({
      /** La correction qui l'a proposée : « Demander une revue » la conteste. */
      correction: IdUuid,
      erreur: Identifiant,
      libelle: Texte,
      explication: Texte,
      extrait: Texte,
    })
    .nullable(),
})

export const ROUTES_APPRENTISSAGE = {
  'GET /aujourdhui': {
    methode: 'GET',
    chemin: '/aujourdhui',
    reponse: z.strictObject({
      /** Le jour `AAAA-MM-JJ`, avec la bascule à l'heure réglée. */
      jour: Texte,
      en_retard: z.boolean(),
      /** Présent quand la dernière séance date d'au moins 7 jours. */
      retour: z.strictObject({ jours: z.number().int().min(7) }).optional(),
      /** Vrai tant qu'aucun fait n'est enregistré : la file n'a qu'une tâche, commencer le premier bloc. */
      premiere_connexion: z.boolean(),
      taches: z.array(TacheDuJour),
      /** Le module en cours, `null` si aucun n'est importé. */
      module: z
        .strictObject({ id: Identifiant, titre: Texte, blocs: z.array(BlocDuModule) })
        .nullable(),
    }),
    succes: 200,
  },
  'GET /questions-debut': {
    methode: 'GET',
    chemin: '/questions-debut',
    reponse: z.strictObject({ questions: z.array(QuestionDebut) }),
    succes: 200,
  },
  'GET /cartes/dues': {
    methode: 'GET',
    chemin: '/cartes/dues',
    reponse: z.strictObject({
      dues: z.array(Carte),
      nouvelles: z.array(Carte),
      /** Quand la prochaine carte revient, `null` s'il n'y en a aucune à venir. */
      prochaine: InstantUtc.nullable(),
    }),
    succes: 200,
  },
  'POST /cartes/:id/note': {
    methode: 'POST',
    chemin: '/cartes/:id/note',
    params: z.strictObject({ id: Identifiant }),
    corps: z.strictObject({ id: IdUuid, note: NoteCarte }),
    reponse: z.strictObject({ echeance: InstantUtc }),
    succes: 200,
  },
  'GET /verifications/:id': {
    methode: 'GET',
    chemin: '/verifications/:id',
    params: z.strictObject({ id: IdUuid }),
    reponse: z.strictObject({
      id: IdUuid,
      type: TypeVerification,
      /** Le jour `AAAA-MM-JJ` à partir duquel elle est due. */
      due_le: Texte,
      terminee: z.boolean(),
      /** Présent quand la page du bloc a été ouverte dans les 24 h : la vérification ne compterait pas. */
      revu_recemment: z.enum(['hier', 'aujourdhui']).nullable(),
      /** Les trois parties, dans l'ordre : sans le code ni le titre du bloc, qui n'apparaissent qu'au résultat. */
      parties: z.array(PartieVerification),
      /** Le résultat, une fois toutes les parties envoyées. */
      resultat: ResultatVerification.nullable(),
    }),
    succes: 200,
  },
  'POST /verifications/:id/reponses': {
    methode: 'POST',
    chemin: '/verifications/:id/reponses',
    params: z.strictObject({ id: IdUuid }),
    corps: z.strictObject({
      id: IdUuid,
      /** L'identifiant de la partie, tel que `GET /verifications/:id` le donne. */
      partie: Identifiant,
      reponse: Reponse.min(1),
      confiance: Confiance,
      support: z.strictObject({ colle: z.boolean(), retour_cours: z.boolean() }),
      /** Une tâche de code : le code a été essayé dans le navigateur, le serveur garde ce résultat. */
      code: z
        .strictObject({ reussis: z.number().int().min(0), total: z.number().int().min(1) })
        .optional(),
    }),
    reponse: z.strictObject({
      partie: Identifiant,
      /** Vrai quand toutes les parties ont une réponse : la vérification est terminée. */
      terminee: z.boolean(),
      /** Rendu avec la réponse à la dernière partie : aucune correction n'est donnée avant. */
      resultat: ResultatVerification.optional(),
    }),
    succes: 200,
  },
  'POST /verifications/:id/reporter': {
    methode: 'POST',
    chemin: '/verifications/:id/reporter',
    params: z.strictObject({ id: IdUuid }),
    corps: z.strictObject({ id: IdUuid }),
    reponse: z.strictObject({ due_le: Texte }),
    succes: 200,
  },
} satisfies Record<string, DefinitionRoute>
