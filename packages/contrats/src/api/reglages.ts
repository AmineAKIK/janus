import { z } from 'zod'
import { Reglages } from '../reglages.ts'
import { IdUuid } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const { shape } = Reglages

/**
 * Les réglages à changer, et eux seuls. `Reglages.partial()` ne convient pas : il remplirait les
 * valeurs par défaut des autres réglages et les remettrait à zéro.
 */
export const ModificationReglages = z.strictObject({
  fuseau: shape.fuseau.unwrap().optional(),
  heureBascule: shape.heureBascule.unwrap().optional(),
  delaiConsolidationMinutes: shape.delaiConsolidationMinutes.unwrap().optional(),
  delaiVerificationJours: shape.delaiVerificationJours.unwrap().optional(),
  delaiRetestJours: shape.delaiRetestJours.unwrap().optional(),
  delaiNouvelEssaiJours: shape.delaiNouvelEssaiJours.unwrap().optional(),
  echecsAvantDescente: shape.echecsAvantDescente.unwrap().optional(),
  seuilConsolidation: shape.seuilConsolidation.unwrap().optional(),
  questionsDebut: shape.questionsDebut.unwrap().optional(),
  nouvellesCartesParJour: shape.nouvellesCartesParJour.unwrap().optional(),
  retentionVisee: shape.retentionVisee.unwrap().optional(),
  heuresSansPageAvantVerification: shape.heuresSansPageAvantVerification.unwrap().optional(),
  joursAvantReutilisation: shape.joursAvantReutilisation.unwrap().optional(),
  seuilRecopie: shape.seuilRecopie.unwrap().optional(),
  relancesMax: shape.relancesMax.unwrap().optional(),
  echantillonControle: shape.echantillonControle.unwrap().optional(),
  seuilDesaccord: shape.seuilDesaccord.unwrap().optional(),
  plafondIaMillioniemes: shape.plafondIaMillioniemes.unwrap().optional(),
  appelsIaParHeure: shape.appelsIaParHeure.unwrap().optional(),
  heureRappel: shape.heureRappel.unwrap().optional(),
  rappelsEnPauseJusquAu: shape.rappelsEnPauseJusquAu.unwrap().optional(),
  formationActive: shape.formationActive.unwrap().optional(),
  blocsEntreRevues: shape.blocsEntreRevues.unwrap().optional(),
})
export type ModificationReglages = z.infer<typeof ModificationReglages>

/**
 * L'adresse d'un service de notifications (celui du navigateur, chez Google, Mozilla ou Apple) :
 * en https, sur un nom public. Le serveur y envoie les rappels, donc ni adresse IP, ni `localhost`,
 * ni nom du réseau interne.
 */
export function estAdressePush(adresse: string): boolean {
  let url: URL
  try {
    url = new URL(adresse)
  } catch {
    return false
  }
  const nom = url.hostname
  const adresseIp = /^[\d.]+$/.test(nom) || nom.includes(':')
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    nom.includes('.') &&
    !adresseIp &&
    !/(^|\.)(localhost|local|internal|lan|home|corp)\.?$/.test(nom)
  )
}

const Abonnement = z.strictObject({
  id: IdUuid,
  endpoint: z.url().refine(estAdressePush, { error: 'Adresse de notifications refusée.' }),
  cles: z.strictObject({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

export const ROUTES_REGLAGES = {
  'GET /reglages': { methode: 'GET', chemin: '/reglages', reponse: Reglages, succes: 200 },
  'PATCH /reglages': {
    methode: 'PATCH',
    chemin: '/reglages',
    corps: ModificationReglages,
    reponse: Reglages,
    succes: 200,
  },
  'POST /push/abonnements': {
    methode: 'POST',
    chemin: '/push/abonnements',
    corps: Abonnement,
    reponse: z.strictObject({ id: IdUuid }),
    succes: 201,
  },
  'DELETE /push/abonnements/:id': {
    methode: 'DELETE',
    chemin: '/push/abonnements/:id',
    params: z.strictObject({ id: IdUuid }),
    reponse: null,
    succes: 204,
  },
} satisfies Record<string, DefinitionRoute>
