import { scenariosContrat } from '@janus/contrats/tests-contrat/scenarios.ts'
import { monterDemo } from './routes/banc.ts'

// La suite de contrat contre le faux serveur de la démo, sans délai de correction.
scenariosContrat(() => {
  const { transport, horloge } = monterDemo({ connecte: false, delaiCorrectionMs: 0 })
  return {
    transport,
    avancer: (ms) => {
      horloge.avancer(ms)
      return Promise.resolve()
    },
  }
})
