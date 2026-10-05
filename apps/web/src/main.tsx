import '@janus/ui/tokens.css'
import '@janus/ui/typographie.css'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { creerTransport } from './api/client.ts'
import { creerClientRequetes, FournisseurApi } from './api/requetes.tsx'
import { creerRouteur } from './routes/arbre.tsx'
import { allerALaConnexion } from './routes/connexion.ts'
import { creerHistorique, modeHistorique } from './routes/historique.ts'

const racine = document.getElementById('racine')
if (racine === null) {
  throw new Error('Élément #racine introuvable dans index.html')
}

const client = creerClientRequetes({
  surNonAuthentifie: () => {
    allerALaConnexion(routeur)
  },
})
const transport = creerTransport(import.meta.env, {
  apresChangementDemo: () => {
    void client.invalidateQueries()
  },
})
const routeur = creerRouteur(creerHistorique(modeHistorique(import.meta.env.VITE_HISTORIQUE)), {
  client,
  transport,
})

createRoot(racine).render(
  <StrictMode>
    <FournisseurApi transport={transport} client={client}>
      <RouterProvider router={routeur} />
    </FournisseurApi>
  </StrictMode>,
)
