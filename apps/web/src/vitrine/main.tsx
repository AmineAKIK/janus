import '@janus/ui/tokens.css'
import '@janus/ui/typographie.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Vitrine } from './Vitrine.tsx'

const racine = document.getElementById('racine')
if (racine === null) {
  throw new Error('Élément #racine introuvable dans vitrine.html')
}

createRoot(racine).render(
  <StrictMode>
    <Vitrine />
  </StrictMode>,
)
