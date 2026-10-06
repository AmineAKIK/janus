import { z } from 'zod'
import { Statut } from '../enums.ts'
import { Manifeste } from '../manifeste.ts'
import { EtatPage } from '../pont.ts'
import { CodeBloc, Identifiant, InstantUtc, ParamId, StatutBloc } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)

const Formation = z.strictObject({ id: Identifiant, titre: Texte, description: z.string() })

const Module = z.strictObject({
  id: Identifiant,
  code: Texte,
  titre: Texte,
  description: z.string(),
  ordre: z.number().int(),
  /** Faux pour un module dont les fiches ne sont pas encore importées. */
  importe: z.boolean(),
})

/** Un bloc dans une liste : jamais son manifeste, qui est gros. */
const BlocListe = z.strictObject({
  bloc: CodeBloc,
  titre: Texte,
  titre_court: Texte,
  partie: z.string(),
  prerequis: z.array(CodeBloc),
  statut: Statut,
})

/** Un bloc ouvert librement si tous ses prérequis sont au moins « acquis provisoirement ». */
export const AccesBloc = z.enum(['libre', 'raison_requise'])
export type AccesBloc = z.infer<typeof AccesBloc>

const PreuveDatee = z.strictObject({ date: InstantUtc }).nullable()

/** Le panneau « Cinq preuves » d'un bloc : la date de chaque preuve, `null` tant qu'elle n'est pas faite. */
export const CinqPreuves = z.strictObject({
  comprendre: PreuveDatee,
  faire_seul: PreuveDatee,
  transferer: PreuveDatee,
  /** La dernière vérification ou le dernier retest réussi, et la prochaine échéance. */
  retenir: z
    .strictObject({
      date: InstantUtc,
      prochaine: z
        .strictObject({
          type: z.enum(['consolidation', 'verification', 'retest', 'entretien']),
          /** Un jour « AAAA-MM-JJ », ou un instant pour la consolidation. */
          apres: z.string(),
        })
        .nullable(),
    })
    .nullable(),
  aisance: z.union([PreuveDatee, z.literal('non_requis')]),
})
export type CinqPreuves = z.infer<typeof CinqPreuves>

const BlocDetail = z.strictObject({
  ...StatutBloc.shape,
  bloc: CodeBloc,
  /** L'identifiant du module du bloc, pour le lien de retour. */
  module: Identifiant,
  version: z.number().int().min(1),
  manifeste: Manifeste,
  /** Les problèmes trouvés dans le manifeste importé : vide si la fiche peut s'ouvrir. */
  problemes: z.array(Texte),
  /** Les séries de questions que la page peut proposer en ce moment. */
  serie_ouverte: z.strictObject({ restitution: z.boolean(), consolidation: z.boolean() }),
  /** Le statut forcé par Amine, s'il y en a un. */
  force: z.strictObject({ statut: Statut, raison: Texte }).nullable(),
  acces: AccesBloc,
  preuves: CinqPreuves,
  /** L'adresse de la fiche, servie par le sous-domaine des fiches. */
  fiche_url: z.url(),
  etat_page: z.strictObject({ version: z.number().int().min(0), etat: EtatPage }).nullable(),
})

export const ROUTES_CATALOGUE = {
  'GET /formations': {
    methode: 'GET',
    chemin: '/formations',
    reponse: z.strictObject({ formations: z.array(Formation) }),
    succes: 200,
  },
  'GET /formations/:id/modules': {
    methode: 'GET',
    chemin: '/formations/:id/modules',
    params: ParamId,
    reponse: z.strictObject({ modules: z.array(Module) }),
    succes: 200,
  },
  'GET /modules/:id/blocs': {
    methode: 'GET',
    chemin: '/modules/:id/blocs',
    params: ParamId,
    reponse: z.strictObject({ blocs: z.array(BlocListe) }),
    succes: 200,
  },
  'GET /blocs/:id': {
    methode: 'GET',
    chemin: '/blocs/:id',
    params: z.strictObject({ id: CodeBloc }),
    reponse: BlocDetail,
    succes: 200,
  },
} satisfies Record<string, DefinitionRoute>
