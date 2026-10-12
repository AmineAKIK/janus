import '@janus/ui/tokens.css'
import '@janus/ui/typographie.css'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { creerTransport } from './api/client.ts'
import { garderLesDonnees, reprendreLesDonnees } from './donnees/persistance.ts'
import { ouvrirStockageDonnees } from './donnees/stockageDonnees.ts'
import { invaliderApprentissage } from './api/invalidations.ts'
import { creerClientRequetes, FournisseurApi } from './api/requetes.tsx'
import { creerBoiteEnvoi, creerVerrouNavigateur } from './envoi/boiteEnvoi.ts'
import { FournisseurEnvoi } from './envoi/FournisseurEnvoi.tsx'
import { ouvrirStockageIndexedDB, creerStockageParesseux } from './envoi/stockageEnvoi.ts'
import { instantReel } from './horloge.ts'
import { cibleFenetre, suivreLesErreurs } from './erreurs.ts'
import { creerInstallation } from './pwa/installation.ts'
import { creerMiseAJour } from './pwa/miseAJour.ts'
import { MiseAJour } from './pwa/MiseAJour.tsx'
import { ContexteInstallation } from './pwa/useInstallation.ts'
import { creerRouteur } from './routes/arbre.tsx'
import { allerALaConnexion } from './routes/connexion.ts'
import { creerHistorique, modeHistorique } from './routes/historique.ts'
import { garderLesLiensDansLAppli } from './routes/navigation.ts'

suivreLesErreurs({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  cible: cibleFenetre(window),
  maintenant: instantReel,
  envoyer: (url, corps) => navigator.sendBeacon(url, corps),
  identifiant: () => crypto.randomUUID().replaceAll('-', ''),
})

const racine = document.getElementById('racine')
if (racine === null) {
  throw new Error('Élément #racine introuvable dans index.html')
}

const client = creerClientRequetes({
  surNonAuthentifie: () => {
    allerALaConnexion(routeur)
  },
})
const transport = await creerTransport(import.meta.env, {
  apresChangementDemo: () => {
    void client.invalidateQueries()
  },
})
const { stockage } = creerStockageParesseux(ouvrirStockageIndexedDB())
const boite = creerBoiteEnvoi(
  {
    stockage,
    transport,
    verrou: creerVerrouNavigateur(),
    maintenant: instantReel,
  },
  {
    // Tout message accepté (réponse, carte, report, vérification) change l'avancement affiché.
    surReponse: () => {
      void invaliderApprentissage(client)
    },
  },
)
const routeur = creerRouteur(creerHistorique(modeHistorique(import.meta.env.VITE_HISTORIQUE)), {
  client,
  transport,
})

garderLesLiensDansLAppli(document)

const miseAJour = creerMiseAJour(registerSW, import.meta.env.BASE_URL)
miseAJour.demarrer()

const installation = creerInstallation(window)
installation.demarrer()

// Les dernières données lues reviennent avant le premier affichage : hors connexion l'appli s'ouvre sur
// ce qu'elle montrait. Sans IndexedDB, ou sans réponse à temps, elle s'ouvre sans.
async function demarrer(racineDom: HTMLElement) {
  const stockageDonnees = await ouvrirStockageDonnees()
  if (stockageDonnees !== null) {
    await reprendreLesDonnees(client, stockageDonnees)
    garderLesDonnees(client, stockageDonnees)
  }
  createRoot(racineDom).render(
    <StrictMode>
      <ContexteInstallation value={installation}>
        <FournisseurApi transport={transport} client={client}>
          <FournisseurEnvoi boite={boite}>
            <RouterProvider router={routeur} />
            <MiseAJour miseAJour={miseAJour} />
          </FournisseurEnvoi>
        </FournisseurApi>
      </ContexteInstallation>
    </StrictMode>,
  )
}

void demarrer(racine)
