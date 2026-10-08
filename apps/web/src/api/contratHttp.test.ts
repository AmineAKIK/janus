import { scenariosContrat } from '@janus/contrats/tests-contrat/scenarios.ts'
import { describe } from 'vitest'
import { creerTransportHttp } from './transportHttp.ts'

// La suite de contrat contre l'API réelle (PR-089) : elle tourne sur le banc de la CI
// (`pnpm --filter @janus/api banc`, sur PostgreSQL) quand `JANUS_BANC_URL` en donne l'adresse.
// Ce sont les mêmes scénarios que contre la démo (`demo/contrat.test.ts`).

const BANC = process.env['JANUS_BANC_URL']
const ORIGINE = process.env['JANUS_BANC_ORIGINE'] ?? 'http://localhost:4173'

/** Un `fetch` qui garde le cookie de session, comme un navigateur, et envoie l'origine de l'appli. */
function fetchAvecCookie(): typeof fetch {
  const cookies = new Map<string, string>()
  return async (entree, init) => {
    const enTetes = new Headers(init?.headers)
    enTetes.set('Origin', ORIGINE)
    if (cookies.size > 0) {
      enTetes.set('Cookie', [...cookies].map(([nom, valeur]) => `${nom}=${valeur}`).join('; '))
    }
    const reponse = await fetch(entree, { ...init, headers: enTetes })
    for (const ligne of reponse.headers.getSetCookie()) {
      const [paire = ''] = ligne.split(';')
      const [nom = '', valeur = ''] = paire.split('=')
      if (valeur === '') cookies.delete(nom.trim())
      else cookies.set(nom.trim(), valeur)
    }
    return reponse
  }
}

async function appelerBanc(chemin: string, corps: unknown) {
  const reponse = await fetch(`${BANC ?? ''}/api/banc/${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGINE },
    body: JSON.stringify(corps),
  })
  if (!reponse.ok) throw new Error(`Le banc a refusé ${chemin} : ${String(reponse.status)}`)
}

describe.skipIf(BANC === undefined)('contre l’API réelle', () => {
  scenariosContrat(async () => {
    await appelerBanc('reinitialiser', {})
    return {
      transport: creerTransportHttp({ base: `${BANC ?? ''}/api`, fetchImpl: fetchAvecCookie() }),
      avancer: (ms) => appelerBanc('horloge', { ms }),
    }
  })
})
