import { Reglages } from '@janus/contrats'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerTransportHttp } from '../api/transportHttp.ts'
import { creerClientRequetes, FournisseurApi } from '../api/requetes.tsx'
import { SectionRappels } from './sections/Rappels.tsx'

const MOI = {
  id: '0190a000-0000-7000-8000-000000000001',
  nom_utilisateur: 'amine',
  fuseau: 'Europe/Paris',
  cle_vapid: 'AQID',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const adresseDe = (entree: string | URL | Request) =>
  typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url

function json(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** La section Rappels face à un serveur réel (fetch simulé) : la clé VAPID vient de `GET /moi`. */
function afficherSurServeur(reponseAbonnement: () => Response) {
  vi.stubEnv('VITE_TRANSPORT', 'http')
  const fetchImpl = vi.fn<typeof fetch>((adresse) =>
    Promise.resolve(adresseDe(adresse).endsWith('/moi') ? json(MOI) : reponseAbonnement()),
  )
  const transport = creerTransportHttp({ base: '/api', fetchImpl })
  render(
    <FournisseurApi
      transport={transport}
      client={creerClientRequetes({ surNonAuthentifie: () => undefined })}
    >
      <SectionRappels reglages={Reglages.parse({})} enregistrer={vi.fn()} />
    </FournisseurApi>,
  )
  return fetchImpl
}

function navigateur() {
  const subscribe = vi.fn(() =>
    Promise.resolve({
      toJSON: () => ({
        endpoint: 'https://push.test/abonnement',
        keys: { p256dh: 'clef', auth: 'secret' },
      }),
    }),
  )
  vi.stubGlobal(
    'Notification',
    Object.assign(vi.fn(), {
      permission: 'default',
      requestPermission: vi.fn(() => {
        Object.defineProperty(Notification, 'permission', { value: 'granted' })
        return Promise.resolve('granted')
      }),
    }),
  )
  vi.stubGlobal('navigator', {
    serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe } }) },
  })
  return subscribe
}

describe('Activer les notifications', () => {
  it('abonne l’appareil et l’enregistre sur le serveur', async () => {
    const utilisateur = userEvent.setup()
    const subscribe = navigateur()
    const fetchImpl = afficherSurServeur(() =>
      json({ id: '0190a000-0000-7000-8000-000000000002' }, 201),
    )

    const bouton = await screen.findByRole('button', { name: 'Activer' })
    await waitFor(() => {
      expect(bouton).toBeEnabled()
    })
    await utilisateur.click(bouton)

    await waitFor(() => {
      expect(
        fetchImpl.mock.calls.some(([adresse]) => adresseDe(adresse).endsWith('/push/abonnements')),
      ).toBe(true)
    })
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    })
    const envoi = fetchImpl.mock.calls.find(([adresse]) =>
      adresseDe(adresse).endsWith('/push/abonnements'),
    )
    expect(JSON.parse(typeof envoi?.[1]?.body === 'string' ? envoi[1].body : '')).toMatchObject({
      endpoint: 'https://push.test/abonnement',
      cles: { p256dh: 'clef', auth: 'secret' },
    })
    expect(await screen.findByText('Autorisées sur cet appareil.')).toBeVisible()
  })

  it('dit quand le serveur n’a pas enregistré l’appareil', async () => {
    const utilisateur = userEvent.setup()
    navigateur()
    afficherSurServeur(() => json({ type: 'about:blank', title: 'Panne', status: 500 }, 500))

    const bouton = await screen.findByRole('button', { name: 'Activer' })
    await waitFor(() => {
      expect(bouton).toBeEnabled()
    })
    await utilisateur.click(bouton)

    expect(await screen.findByText(/n’a pas pu être enregistré/)).toBeVisible()
  })
})
