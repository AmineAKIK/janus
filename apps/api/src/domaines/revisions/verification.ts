import { Niveau, ResultatVerification, TypeDifferee } from '@janus/contrats'
import type {
  Differee,
  Fait,
  Manifeste,
  Reglages,
  ReponseVerification,
  Statut,
  TypeVerification,
} from '@janus/contrats'
import {
  ajouterJours,
  compositionReussie,
  compte,
  echeances,
  jourDe,
  tirerDifferee,
} from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { z } from 'zod'

/** Les trois parties tirées d'une vérification, dans l'ordre : ce que `verifications_tirees` garde. */
export const Tirage = z.array(z.strictObject({ id: z.string(), type: TypeDifferee }))
export type Tirage = z.infer<typeof Tirage>

const TYPES_DE_PARTIES = TypeDifferee.options
const HEURE_MS = 3_600_000

/** Tire une question de chaque type, jamais la même deux fois de suite (réserve épuisée : la plus ancienne). */
export function tirerParties(
  manifeste: Manifeste,
  faits: readonly Fait[],
  reglages: Reglages,
  maintenant: string,
): Tirage {
  const dejaPosees = faits.flatMap((fait) =>
    fait.type === 'verification_terminee'
      ? fait.reponses.map(({ question }) => ({ question, date: fait.date }))
      : [],
  )
  return TYPES_DE_PARTIES.flatMap((type) => {
    const differee = tirerDifferee(manifeste, type, dejaPosees, maintenant, reglages)
    return differee === null ? [] : [{ id: differee.id, type }]
  })
}

/** Ce que la page voit d'une partie : la consigne et le mode de la tâche, jamais l'attendu. */
export function partieVisible(differee: Differee, envoyee: boolean) {
  const mode = differee.verification
  return {
    id: differee.id,
    type: differee.type,
    consigne: differee.consigne,
    ...(differee.type !== 'tache'
      ? {}
      : mode?.mode === 'code'
        ? { tache: { mode: 'code' as const, langage: mode.langage, cas: mode.cas } }
        : { tache: { mode: 'exacte' as const } }),
    envoyee,
  }
}

/** La page du bloc a-t-elle été ouverte dans la fenêtre sans page avant la vérification ? */
export function revuRecemment(
  faitsDuBloc: readonly Fait[],
  reglages: Reglages,
  maintenant: string,
): 'hier' | 'aujourdhui' | null {
  const fenetre = reglages.heuresSansPageAvantVerification * HEURE_MS
  const derniere = faitsDuBloc
    .filter(
      (fait) =>
        fait.type === 'bloc_ouvert' &&
        Date.parse(maintenant) - Date.parse(fait.date) <= fenetre &&
        Date.parse(fait.date) <= Date.parse(maintenant),
    )
    .map(({ date }) => date)
    .sort()
    .at(-1)
  if (derniere === undefined) return null
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  return jour(derniere) === jour(maintenant) ? 'aujourdhui' : 'hier'
}

/** Le jour à partir duquel la vérification est due : l'échéance du bloc, ou le report s'il va plus loin. */
export function dateDue(
  etat: ResultatBloc,
  reglages: Reglages,
  maintenant: string,
  reporteeJusqua: string | null,
): string {
  const echeance = echeances(etat, reglages)
  const attendue =
    echeance?.genre === 'jour'
      ? echeance.apres
      : jourDe(maintenant, reglages.fuseau, reglages.heureBascule)
  return reporteeJusqua !== null && reporteeJusqua > attendue ? reporteeJusqua : attendue
}

/** Les événements d'une vérification, tels que `evenements` les garde (le moteur n'en lit aucun). */
export const EvenementReport = z.looseObject({ jusqua: z.string() })
export const EvenementResultat = z.looseObject({ resultat: ResultatVerification })
export const EvenementPartie = z.looseObject({
  partie: z.string(),
  type: TypeDifferee,
  reponse: z.string(),
  compte: z.boolean(),
  niveau: Niveau.optional(),
  reussi: z.boolean().optional(),
  cas: z.strictObject({ reussis: z.number(), total: z.number() }).optional(),
  correction: z.string(),
  indice: z.string().optional(),
  /** La ligne de `corrections` d'une partie corrigée par l'IA. */
  correctionId: z.string().optional(),
  erreurs: z.array(z.string()).default([]),
})
export type EvenementPartie = z.infer<typeof EvenementPartie>
export type ResultatVerification = z.infer<typeof ResultatVerification>

/** Une partie corrigée sans IA (une tâche) : exacte ou testée dans le navigateur. */
export type PartieCorrigee = Pick<EvenementPartie, 'reussi' | 'cas' | 'compte' | 'correction'>

/** Corrige une tâche ; `undefined` quand une tâche de code arrive sans le résultat de ses cas. */
export function corrigerTache(
  differee: Differee,
  corps: {
    reponse: string
    support: { colle: boolean; retour_cours: boolean }
    code?: { reussis: number; total: number } | undefined
  },
): PartieCorrigee | undefined {
  const { verification } = differee
  const comptee = compte({
    tour: 1,
    colle: corps.support.colle,
    retourCours: corps.support.retour_cours,
    recopiee: false,
    certitude: 'sur',
  }).compte
  if (verification?.mode === 'code') {
    if (corps.code === undefined) return undefined
    const { reussis, total } = corps.code
    return {
      reussi: reussis === total && total >= verification.cas.length,
      cas: { reussis, total },
      compte: comptee,
      correction: `${String(reussis)} cas sur ${String(total)}.`,
    }
  }
  const reussi = (verification?.reponses ?? [differee.attendu]).some(
    (attendue) => attendue === corps.reponse.trim(),
  )
  return {
    reussi,
    compte: comptee,
    correction: reussi ? 'Réponse exacte.' : `Attendu : ${differee.attendu}`,
  }
}

/** La réponse d'une partie telle que le fait `verification_terminee` la garde. */
export function reponseDeFait(partie: EvenementPartie): ReponseVerification {
  const commun = { question: partie.partie, tour: 1, compte: partie.compte }
  if (partie.type === 'tache') {
    return {
      type: 'tache',
      ...commun,
      ...(partie.reussi === undefined ? {} : { reussi: partie.reussi }),
    }
  }
  return {
    type: partie.type,
    ...commun,
    ...(partie.niveau === undefined ? {} : { niveau: partie.niveau }),
  }
}

const ORDRE_DES_STATUTS: readonly Statut[] = [
  'a_reprendre',
  'non_commence',
  'en_cours',
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
]
const LONGUEUR_EXTRAIT = 160

/** Le résultat rendu avec la réponse à la dernière partie, et gardé pour rouvrir la vérification. */
export function construireResultat(o: {
  bloc: { code: string; titre: string }
  manifeste: Manifeste
  type: TypeVerification
  parties: readonly EvenementPartie[]
  validite: { valable: boolean; raison: 'revu_avant' | 'avec_support' | null }
  statutAvant: Statut
  apres: ResultatBloc
  reglages: Reglages
  maintenant: string
}): ResultatVerification {
  const { bloc, manifeste, type, parties, validite, statutAvant, apres, reglages, maintenant } = o
  const reussie = validite.valable && compositionReussie(parties.map(reponseDeFait))
  const reprogrammee = validite.valable
    ? null
    : ajouterJours(jourDe(maintenant, reglages.fuseau, reglages.heureBascule), 1)
  const echeance = echeances(apres, reglages)
  const prochaine =
    reprogrammee !== null
      ? { type, apres: reprogrammee }
      : echeance !== null && echeance.type !== 'consolidation'
        ? { type: echeance.type, apres: echeance.apres }
        : null
  // La partie qui a fait proposer une erreur critique, le transfert d'abord.
  const proposee = [...parties]
    .sort((a, b) => Number(b.type === 'transfert') - Number(a.type === 'transfert'))
    .flatMap((partie) => {
      const erreur = manifeste.erreurs_critiques.find(({ id }) => id === partie.erreurs[0])
      return erreur === undefined || partie.correctionId === undefined
        ? []
        : [{ partie, erreur, correction: partie.correctionId }]
    })[0]
  return {
    bloc,
    issue: proposee !== undefined ? 'a_examiner' : reussie ? 'reussie' : 'ratee',
    valable: validite.valable,
    ...(validite.raison === null ? {} : { raison_invalide: validite.raison }),
    statut_avant: statutAvant,
    statut: apres.statut,
    descend: ORDRE_DES_STATUTS.indexOf(apres.statut) < ORDRE_DES_STATUTS.indexOf(statutAvant),
    prochaine,
    parties: parties.map((partie) => ({
      id: partie.partie,
      type: partie.type,
      consigne:
        manifeste.differees.find(({ id }) => id === partie.partie)?.consigne ?? partie.partie,
      ...(partie.niveau === undefined ? {} : { niveau: partie.niveau }),
      ...(partie.reussi === undefined ? {} : { reussi: partie.reussi }),
      ...(partie.cas === undefined ? {} : { cas: partie.cas }),
      compte: partie.compte,
      correction: partie.correction,
      ...(partie.indice === undefined ? {} : { indice: partie.indice }),
    })),
    erreur_a_confirmer:
      proposee === undefined
        ? null
        : {
            correction: proposee.correction,
            erreur: proposee.erreur.id,
            libelle: proposee.erreur.libelle,
            explication: proposee.partie.correction,
            extrait: proposee.partie.reponse.slice(0, LONGUEUR_EXTRAIT),
          },
  }
}
