import type { Transport } from '@janus/contrats'
import { etatGraine } from '../graine.ts'
import { creerHorlogeDemo } from '../horlogeDemo.ts'
import { creerMagasin } from '../store.ts'
import { creerTransportDemo } from '../transportDemo.ts'
import { creerRoutesDemo } from './index.ts'

export const PREMIER_LANCEMENT = '2026-10-05T10:00:00.000Z'
export const RACINE_FICHES = 'https://exemple.test/janus/fiches/'

/** Une démo complète dans les tests : la graine, un transport, et l'horloge qu'on peut avancer. */
export function monterDemo(options: { connecte?: boolean } = {}) {
  const magasin = creerMagasin({
    stockage: null,
    creerEtat: () => ({
      ...etatGraine(PREMIER_LANCEMENT),
      sessionOuverte: options.connecte ?? true,
    }),
  })
  const horloge = creerHorlogeDemo({
    reelle: () => Date.parse(PREMIER_LANCEMENT),
    decalage: {
      lire: () => magasin.lire().decalageMs,
      ecrire: (ms) => {
        magasin.ecrire((etat) => ({ ...etat, decalageMs: ms }))
      },
    },
  })
  const transport: Transport = creerTransportDemo({
    magasin,
    horloge,
    routes: creerRoutesDemo({ racineFiches: RACINE_FICHES }),
  })
  return { magasin, horloge, transport }
}
