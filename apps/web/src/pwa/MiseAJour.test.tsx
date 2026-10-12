import { ErreurReseau, nouvelId } from '@janus/contrats'
import type { Transport } from '@janus/contrats'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerClientRequetes, FournisseurApi } from '../api/requetes.tsx'
import { creerBoiteEnvoi, creerVerrouLocal } from '../envoi/boiteEnvoi.ts'
import { FournisseurEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import { creerStockageMemoire } from '../envoi/stockageEnvoi.ts'
import { monterDemo } from '../demo/routes/banc.ts'
import { MiseAJour } from './MiseAJour.tsx'
import {
  creerMiseAJour,
  estApercu,
  PERIODE_VERIFICATION_MS,
  verifierRegulierement,
} from './miseAJour.ts'
import type { EnregistrerSw } from './miseAJour.ts'

describe('estApercu', () => {
  it('reconnaît l’adresse d’un aperçu de PR', () => {
    expect(estApercu('/janus/pr-preview/pr-42/')).toBe(true)
    expect(estApercu('/janus/')).toBe(false)
  })
})

describe('verifierRegulierement', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('cherche une nouvelle version chaque heure, au retour au premier plan et du réseau', () => {
    vi.useFakeTimers()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const update = vi.fn(() => Promise.resolve())
    const arreter = verifierRegulierement({ update })

    vi.advanceTimersByTime(PERIODE_VERIFICATION_MS)
    expect(update).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledTimes(3)

    arreter()
    vi.advanceTimersByTime(PERIODE_VERIFICATION_MS)
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledTimes(3)
  })

  it('ne cherche rien sans réseau et ignore un échec', async () => {
    vi.useFakeTimers()
    const update = vi.fn(() => Promise.reject(new Error('hors ligne')))
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const arreter = verifierRegulierement({ update })

    vi.advanceTimersByTime(PERIODE_VERIFICATION_MS)
    expect(update).not.toHaveBeenCalled()

    onLine.mockReturnValue(true)
    vi.advanceTimersByTime(PERIODE_VERIFICATION_MS)
    await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(1)
    arreter()
  })
})

describe('creerMiseAJour', () => {
  it('n’enregistre aucun service worker sur un aperçu de PR', () => {
    const enregistrer = vi.fn<EnregistrerSw>()
    creerMiseAJour(enregistrer, '/janus/pr-preview/pr-42/', true).demarrer()
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('n’enregistre rien sans service worker dans le navigateur', () => {
    const enregistrer = vi.fn<EnregistrerSw>()
    creerMiseAJour(enregistrer, '/janus/', false).demarrer()
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('enregistre sur le site principal et signale la version en attente', () => {
    let auBesoin: () => void = () => undefined
    const enregistrer = vi.fn<EnregistrerSw>((options) => {
      auBesoin = options.onNeedRefresh
      return () => Promise.resolve()
    })
    const miseAJour = creerMiseAJour(enregistrer, '/janus/', true)
    const abonne = vi.fn()
    miseAJour.abonner(abonne)
    miseAJour.demarrer()
    expect(miseAJour.versionPrete()).toBe(false)

    auBesoin()
    expect(miseAJour.versionPrete()).toBe(true)
    expect(abonne).toHaveBeenCalledTimes(1)
  })

  it('applique sans rien faire quand rien n’est enregistré', async () => {
    await expect(
      creerMiseAJour(vi.fn<EnregistrerSw>(), '/janus/', false).appliquer(),
    ).resolves.toBeUndefined()
  })
})

function montage() {
  const stockage = creerStockageMemoire()
  // Sans réseau, les messages gardés restent dans la boîte.
  const reseau = { revenu: false }
  const horsReseau: Transport = {
    appeler: () =>
      reseau.revenu
        ? (Promise.resolve({ doublon: false, statut: null }) as never)
        : Promise.reject(new ErreurReseau()),
  }
  const boite = creerBoiteEnvoi({
    stockage,
    transport: horsReseau,
    verrou: creerVerrouLocal(),
    maintenant: () => '2026-10-05T10:00:00Z',
  })
  let auBesoin: () => void = () => undefined
  const appliquer = vi.fn(() => Promise.resolve())
  const miseAJour = creerMiseAJour(
    (options) => {
      auBesoin = options.onNeedRefresh
      return appliquer
    },
    '/janus/',
    true,
  )
  miseAJour.demarrer()
  return {
    boite,
    reseau,
    stockage,
    miseAJour,
    appliquer,
    prete: () => {
      auBesoin()
    },
  }
}

function afficher(
  boite: ReturnType<typeof montage>['boite'],
  miseAJour: ReturnType<typeof montage>['miseAJour'],
) {
  const { transport } = monterDemo()
  render(
    <FournisseurApi
      transport={transport}
      client={creerClientRequetes({ surNonAuthentifie: () => undefined })}
    >
      <FournisseurEnvoi boite={boite}>
        <MiseAJour miseAJour={miseAJour} />
      </FournisseurEnvoi>
    </FournisseurApi>,
  )
}

describe('MiseAJour', () => {
  it('reste cachée tant qu’aucune version n’attend', () => {
    const { boite, miseAJour } = montage()
    afficher(boite, miseAJour)
    expect(screen.queryByText('Une nouvelle version est prête.')).toBeNull()
  })

  it('propose la mise à jour et recharge dès que la boîte d’envoi est vide', async () => {
    const utilisateur = userEvent.setup()
    const { boite, miseAJour, appliquer, prete } = montage()
    afficher(boite, miseAJour)

    act(prete)
    expect(await screen.findByText('Une nouvelle version est prête.')).toBeVisible()
    await utilisateur.click(screen.getByRole('button', { name: 'Mettre à jour' }))

    await waitFor(() => {
      expect(appliquer).toHaveBeenCalledWith(true)
    })
  })

  it('attend l’envoi des réponses gardées avant de recharger', async () => {
    const utilisateur = userEvent.setup()
    const { boite, reseau, stockage, miseAJour, appliquer, prete } = montage()
    await stockage.ajouter({
      id: 'a',
      route: 'POST /evenements',
      corps: { id: nouvelId(1), type: 'temps.actif', bloc: 'B01', secondes: 5 },
      cree_le: '2026-10-05T10:00:00Z',
      ordre: 1,
      essais: 0,
    })
    afficher(boite, miseAJour)

    act(prete)
    await utilisateur.click(await screen.findByRole('button', { name: 'Mettre à jour' }))
    expect(
      await screen.findByText('La mise à jour se fera dès que tes réponses seront envoyées.'),
    ).toBeVisible()
    expect(appliquer).not.toHaveBeenCalled()

    await act(async () => {
      reseau.revenu = true
      await boite.vider()
    })
    await waitFor(() => {
      expect(appliquer).toHaveBeenCalledWith(true)
    })
  })
})
