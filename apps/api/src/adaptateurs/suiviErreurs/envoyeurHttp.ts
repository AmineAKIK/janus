const DELAI_MS = 3000

/** Poste une enveloppe Sentry : le seul endroit, avec le correcteur, où l'API sort sur le réseau. */
export async function envoyerEnveloppe(url: string, corps: string): Promise<void> {
  const reponse = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-sentry-envelope' },
    body: corps,
    signal: AbortSignal.timeout(DELAI_MS),
  })
  if (!reponse.ok) throw new Error(`Le suivi d'erreurs a répondu ${String(reponse.status)}.`)
}
