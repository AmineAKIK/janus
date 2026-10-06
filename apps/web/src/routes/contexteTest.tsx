import { RouterProvider } from '@tanstack/react-router'
import { creerClientRequetes, FournisseurApi } from '../api/requetes.tsx'
import { creerBoiteEnvoi, creerVerrouLocal } from '../envoi/boiteEnvoi.ts'
import { FournisseurEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import { creerStockageMemoire } from '../envoi/stockageEnvoi.ts'
import { instantReel } from '../demo/horlogeDemo.ts'
import { monterDemo } from '../demo/routes/banc.ts'
import type { Routeur } from './arbre.tsx'
import type { ContexteRouteur } from './garde.ts'

/** Le contexte des routes dans les tests : un faux serveur de démo, connecté ou non. */
export function creerContexteTest(options: { connecte?: boolean } = {}) {
  const demo = monterDemo(options)
  const client = creerClientRequetes({ surNonAuthentifie: () => undefined })
  const boite = creerBoiteEnvoi({
    stockage: creerStockageMemoire(),
    transport: demo.transport,
    verrou: creerVerrouLocal(),
    maintenant: instantReel,
  })
  const contexte: ContexteRouteur = { client, transport: demo.transport }
  const application = (routeur: Routeur) => (
    <FournisseurApi transport={demo.transport} client={client}>
      <FournisseurEnvoi boite={boite}>
        <RouterProvider router={routeur} />
      </FournisseurEnvoi>
    </FournisseurApi>
  )
  return { ...demo, client, boite, contexte, application }
}
