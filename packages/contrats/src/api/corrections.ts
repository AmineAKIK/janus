import { z } from 'zod'
import { Confiance, Niveau, Serie } from '../enums.ts'
import { CodeBloc, CorrectionRecue, IdUuid, Identifiant, Reponse, StatutBloc } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const RaisonTranchage = z.string().trim().min(10)

const TranchageCorrection = z
  .strictObject({
    /** Identifiant de la décision, tiré une fois par le client. */
    id: IdUuid,
    /** La correction compte après la décision d'Amine. */
    compte: z.boolean(),
    /** Présent seulement quand Amine remplace le niveau proposé. */
    niveau: Niveau.optional(),
    /** Obligatoire avec un niveau changé, au moins 10 caractères. */
    raison: RaisonTranchage.optional(),
  })
  .superRefine((tranchage, contexte) => {
    const changeNiveau = tranchage.niveau !== undefined || tranchage.raison !== undefined
    if (changeNiveau && !tranchage.compte) {
      contexte.addIssue({
        code: 'custom',
        path: ['compte'],
        message: 'Un niveau changé doit compter.',
      })
    }
    if (tranchage.niveau === undefined && tranchage.raison !== undefined) {
      contexte.addIssue({
        code: 'custom',
        path: ['niveau'],
        message: 'Le niveau est obligatoire avec une raison.',
      })
    }
    if (tranchage.niveau !== undefined && tranchage.raison === undefined) {
      contexte.addIssue({
        code: 'custom',
        path: ['raison'],
        message: 'La raison est obligatoire quand le niveau change.',
      })
    }
  })

const DemandeCorrection = z
  .strictObject({
    /** Identifiant de la demande, tiré une fois par le client : un doublon est ignoré. */
    id: IdUuid,
    serie: Serie,
    /** Numéro de la tentative de la série (une relance garde la même tentative). */
    tentative: z.number().int().min(1),
    question: Identifiant,
    reponse: Reponse.min(1),
    confiance: Confiance,
    /** Le texte de la relance, vide au premier tour. */
    relance: Reponse,
    support: z.strictObject({ colle: z.boolean(), retour_cours: z.boolean() }),
    /** Vrai quand Amine conteste la correction précédente. */
    conteste: z.boolean().optional(),
    bloc: CodeBloc.optional(),
    version: z.number().int().min(1).optional(),
  })
  .superRefine((demande, contexte) => {
    const connu = demande.serie === 'restitution' || demande.serie === 'consolidation'
    for (const champ of ['bloc', 'version'] as const) {
      if (connu && demande[champ] === undefined) {
        contexte.addIssue({
          code: 'custom',
          path: [champ],
          message: `Le champ ${champ} est exigé pour les séries restitution et consolidation.`,
        })
      }
      if (!connu && demande[champ] !== undefined) {
        contexte.addIssue({
          code: 'custom',
          path: [champ],
          message: `Le champ ${champ} ne doit pas être donné pour les séries rappel et verification : le serveur retrouve le bloc par la question.`,
        })
      }
    }
  })

export const ROUTES_CORRECTIONS = {
  'POST /corrections': {
    methode: 'POST',
    chemin: '/corrections',
    corps: DemandeCorrection,
    reponse: CorrectionRecue,
    succes: 200,
  },
  'POST /corrections/:id/accord': {
    methode: 'POST',
    chemin: '/corrections/:id/accord',
    params: z.strictObject({ id: IdUuid }),
    corps: z.strictObject({ accord: z.boolean() }),
    reponse: null,
    succes: 204,
  },
  'POST /corrections/:id/trancher': {
    methode: 'POST',
    chemin: '/corrections/:id/trancher',
    params: z.strictObject({ id: IdUuid }),
    corps: TranchageCorrection,
    reponse: StatutBloc,
    succes: 200,
  },
} satisfies Record<string, DefinitionRoute>
