import '@janus/ui/tokens.css'
import '@janus/ui/typographie.css'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { creerHistorique, modeHistorique } from './routes/historique.ts'
import { creerRouteur } from './routes/arbre.tsx'

const racine = document.getElementById('racine')
if (racine === null) {
  throw new Error('Élément #racine introuvable dans index.html')
}

const routeur = creerRouteur(creerHistorique(modeHistorique(import.meta.env.VITE_HISTORIQUE)))

createRoot(racine).render(
  <StrictMode>
    <RouterProvider router={routeur} />
  </StrictMode>,
)
