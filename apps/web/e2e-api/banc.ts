import type { APIRequestContext } from '@playwright/test'

const ORIGINE = 'http://localhost:4173'

async function appeler(request: APIRequestContext, chemin: string, donnees: unknown) {
  const reponse = await request.post(`/api/banc/${chemin}`, {
    headers: { Origin: ORIGINE },
    data: donnees,
  })
  if (!reponse.ok()) throw new Error(`Le banc a refusé ${chemin} : ${String(reponse.status())}`)
}

/** Remet le banc à zéro : plus aucun fait, plus de session, le temps repart de là où il était. */
export const remettreAZero = (request: APIRequestContext) => appeler(request, 'reinitialiser', {})

/** Fait passer le temps pour le serveur. */
export const avancer = (request: APIRequestContext, ms: number) =>
  appeler(request, 'horloge', { ms })
