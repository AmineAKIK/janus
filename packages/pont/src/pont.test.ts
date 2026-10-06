import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerPont, ErreurPont, INTERVALLE_SAUVER_MS } from './pont.ts'
import type { Autonome, CorrectionRecue } from './pont.ts'

const ID = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b'
const MANIFESTE = { bloc: 'D01', version: 1 }
const INIT = {
  type: 'etat.init',
  bloc: 'B05',
  version: 4,
  etat: { etape: 'ET2' },
  statut: 'en_cours',
  serie_ouverte: { restitution: true, consolidation: false },
} as const
const ATTENDUE: CorrectionRecue = {
  id: ID,
  echantillon: false,
  question: 'R1',
  tour: 1,
  message: 'Correction simulée (démo) : bien.',
  niveau: 'solide',
  erreurs_critiques: [],
  source: 'support',
  ref: 'cours',
  certitude: 'sur',
  compte: true,
}
const CORRECTION = { type: 'restitution.correction', ...ATTENDUE } as const
const DEMANDE = {
  serie: 'restitution',
  question: 'R1',
  reponse: 'Une fiche résume un bloc.',
  confiance: 'sur',
  relance: '',
  support: { colle: false, retour_cours: false },
} as const

interface Envoye {
  readonly type: string
  readonly id: string
  readonly [cle: string]: unknown
}

/** Une fenêtre parente factice : elle note ce qu'elle reçoit. */
function monter() {
  const recus: Envoye[] = []
  const parent = {
    postMessage: vi.fn((message: Envoye) => {
      recus.push(message)
    }),
  }
  const pont = creerPont({ parent })
  const depuisParent = (data: unknown, source: unknown = parent) => {
    const evenement = new MessageEvent('message', { data })
    Object.defineProperty(evenement, 'source', { value: source })
    window.dispatchEvent(evenement)
  }
  const typesEnvoyes = () => recus.map((message) => message.type)
  return { pont, parent, recus, depuisParent, typesEnvoyes }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('poignée de main', () => {
  it('envoie page.prete au démarrage', () => {
    const { pont, recus } = monter()

    void pont.demarrer({ manifeste: MANIFESTE })

    expect(recus).toHaveLength(1)
    expect(recus[0]).toMatchObject({ type: 'page.prete', schema: 2, bloc: 'D01', version: 1 })
  })

  it('passe en mode appli si etat.init arrive dans les 2 secondes, avec le bloc et la version de l’appli', async () => {
    const { pont, depuisParent } = monter()
    const demarrage = pont.demarrer({ manifeste: MANIFESTE })

    await vi.advanceTimersByTimeAsync(1999)
    depuisParent(INIT)

    await expect(demarrage).resolves.toEqual({ mode: 'appli', etat: { etape: 'ET2' }, init: INIT })
    pont.envoyer('etape.vue', { etape: 'ET2' })
  })

  it('utilise le bloc et la version de etat.init pour les messages suivants', async () => {
    const { pont, depuisParent, recus } = monter()
    const demarrage = pont.demarrer({ manifeste: MANIFESTE })
    depuisParent(INIT)
    await demarrage

    pont.envoyer('etape.vue', { etape: 'ET2' })

    expect(recus.at(-1)).toMatchObject({ type: 'etape.vue', bloc: 'B05', version: 4 })
  })

  it('passe en mode autonome au bout de 2 secondes sans réponse', async () => {
    const { pont } = monter()
    const charger = vi.fn(() => ({ etape: 'ET1' }))
    const demarrage = pont.demarrer({
      manifeste: MANIFESTE,
      autonome: { ask: vi.fn(), sauver: vi.fn(), charger },
    })

    await vi.advanceTimersByTimeAsync(2000)

    await expect(demarrage).resolves.toEqual({
      mode: 'autonome',
      etat: { etape: 'ET1' },
      init: null,
    })
  })

  it('en mode autonome sans état à reprendre, rend null', async () => {
    const { pont } = monter()
    const demarrage = pont.demarrer({ manifeste: MANIFESTE })

    await vi.advanceTimersByTimeAsync(2000)

    await expect(demarrage).resolves.toMatchObject({ mode: 'autonome', etat: null })
  })

  it('ignore un etat.init qui arrive après les 2 secondes', async () => {
    const { pont, depuisParent } = monter()
    const demarrage = pont.demarrer({ manifeste: MANIFESTE })
    await vi.advanceTimersByTimeAsync(2000)
    await demarrage

    depuisParent(INIT)
    pont.envoyer('etape.vue', { etape: 'ET2' })

    await expect(demarrage).resolves.toMatchObject({ mode: 'autonome' })
  })
})

describe('fiche ouverte seule', () => {
  it('ne s’envoie rien à elle-même et passe en mode autonome', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const envoye = vi.spyOn(window, 'postMessage')
    const pont = creerPont({ fenetre: window, parent: window })
    const demarrage = pont.demarrer({ manifeste: MANIFESTE })

    expect(pont.envoyer('etape.vue', { etape: 'ET1' })).not.toBeNull()
    await vi.advanceTimersByTimeAsync(2000)

    await expect(demarrage).resolves.toMatchObject({ mode: 'autonome' })
    expect(envoye).not.toHaveBeenCalled()
    expect(erreur).not.toHaveBeenCalled()
  })
})

describe('messages reçus', () => {
  it('ne lit que les messages venant de la fenêtre parente', () => {
    const { pont, depuisParent } = monter()
    const surStatut = vi.fn()
    pont.surStatut(surStatut)
    void pont.demarrer({ manifeste: MANIFESTE })

    depuisParent({ type: 'statut.maj', statut: 'acquis', manque: [] }, { autre: 'fenêtre' })
    expect(surStatut).not.toHaveBeenCalled()

    depuisParent({ type: 'statut.maj', statut: 'acquis', manque: [] })
    expect(surStatut).toHaveBeenCalledWith({ type: 'statut.maj', statut: 'acquis', manque: [] })
  })

  it('ignore un message mal formé et le dit en console', () => {
    const { pont, depuisParent } = monter()
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const surStatut = vi.fn()
    pont.surStatut(surStatut)
    void pont.demarrer({ manifeste: MANIFESTE })

    depuisParent({ type: 'statut.maj', statut: 'inconnu', manque: [] })

    expect(surStatut).not.toHaveBeenCalled()
    expect(erreur).toHaveBeenCalledWith(expect.stringContaining('mal formé'), expect.anything())
  })

  it('transmet les erreurs, les changements d’étape, et permet de se désabonner', () => {
    const { pont, depuisParent } = monter()
    const surErreur = vi.fn()
    const surEtape = vi.fn()
    const retirer = pont.surErreur(surErreur)
    pont.surEtape(surEtape)
    void pont.demarrer({ manifeste: MANIFESTE })

    depuisParent({ type: 'erreur', code: 'plafond_atteint', detail: 'Plafond.' })
    depuisParent({ type: 'etape.aller', etape: 'ET3' })
    retirer()
    depuisParent({ type: 'erreur', code: 'plafond_atteint', detail: 'Encore.' })

    expect(surErreur).toHaveBeenCalledOnce()
    expect(surEtape).toHaveBeenCalledWith('ET3')
  })
})

describe('etat.init après le démarrage', () => {
  it('prévient la page que les séries ouvertes ont changé', async () => {
    const { pont, depuisParent } = monter()
    const surInit = vi.fn()
    pont.surInit(surInit)
    const demarrage = pont.demarrer({ manifeste: MANIFESTE })
    const init = {
      type: 'etat.init',
      bloc: MANIFESTE.bloc,
      version: MANIFESTE.version,
      etat: null,
      statut: 'vu',
      serie_ouverte: { restitution: false, consolidation: false },
    }
    depuisParent(init)
    await demarrage
    expect(surInit).not.toHaveBeenCalled()

    const ouverte = { ...init, serie_ouverte: { restitution: false, consolidation: true } }
    depuisParent(ouverte)

    expect(surInit).toHaveBeenCalledWith(ouverte)
  })
})

describe('validation avant envoi', () => {
  it('n’envoie jamais un message mal formé et le dit en console', () => {
    const { pont, recus } = monter()
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    void pont.demarrer({ manifeste: MANIFESTE })
    recus.length = 0

    // La page se trompe : `essais` doit être au moins 1.
    const id = pont.envoyer('pratique.resultat', {
      exercice: 'PR1',
      item: 'PR1-1',
      reussi: true,
      aide: 0,
      essais: 0,
    })

    expect(id).toBeNull()
    expect(recus).toEqual([])
    expect(erreur).toHaveBeenCalledWith(
      expect.stringContaining('pratique.resultat'),
      expect.anything(),
    )
  })

  it('refuse d’envoyer avant demarrer()', () => {
    const { pont, recus } = monter()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(pont.envoyer('etape.vue', { etape: 'ET1' })).toBeNull()
    expect(recus).toEqual([])
  })

  it('envoie un message valide avec un UUID v7 et l’heure en ISO', () => {
    const { pont, recus } = monter()
    void pont.demarrer({ manifeste: MANIFESTE })

    const id = pont.envoyer('etape.vue', { etape: 'ET1' })

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(recus.at(-1)).toMatchObject({ id, t: '2026-10-05T10:00:00.000Z', etape: 'ET1' })
  })

  it('renvoie un message avec le même identifiant', () => {
    const { pont, recus } = monter()
    void pont.demarrer({ manifeste: MANIFESTE })
    const id = pont.envoyer('etape.vue', { etape: 'ET1' })
    vi.setSystemTime(new Date('2026-10-05T10:05:00.000Z'))

    expect(id !== null && pont.renvoyer(id)).toBe(true)

    const [premier, second] = recus.slice(-2)
    expect(second).toEqual(premier)
    expect(pont.renvoyer('inconnu')).toBe(false)
  })

  it('tire des identifiants différents pour des messages différents', () => {
    const { pont } = monter()
    void pont.demarrer({ manifeste: MANIFESTE })

    const ids = new Set(
      Array.from({ length: 50 }, () => pont.envoyer('etape.vue', { etape: 'ET1' })),
    )

    expect(ids.size).toBe(50)
  })
})

describe('sauver', () => {
  async function pontEnModeAppli() {
    const monte = monter()
    const demarrage = monte.pont.demarrer({ manifeste: MANIFESTE })
    monte.depuisParent(INIT)
    await demarrage
    monte.recus.length = 0
    return monte
  }

  it('envoie tout de suite le premier état', async () => {
    const { pont, typesEnvoyes } = await pontEnModeAppli()

    pont.sauver({ n: 1 })

    expect(typesEnvoyes()).toEqual(['etat.sauver'])
  })

  it('regroupe : au plus un envoi toutes les 2 secondes, avec le dernier état', async () => {
    const { pont, recus } = await pontEnModeAppli()
    pont.sauver({ n: 1 })

    pont.sauver({ n: 2 })
    pont.sauver({ n: 3 })
    expect(recus).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(INTERVALLE_SAUVER_MS)

    expect(recus).toHaveLength(2)
    expect(recus[1]).toMatchObject({ type: 'etat.sauver', etat: { n: 3 } })
  })

  it('n’envoie pas un état qui n’a pas changé', async () => {
    const { pont, recus } = await pontEnModeAppli()
    pont.sauver({ n: 1 })

    pont.sauver({ n: 1 })
    await vi.advanceTimersByTimeAsync(INTERVALLE_SAUVER_MS)
    pont.sauver({ n: 1 })

    expect(recus).toHaveLength(1)
  })

  it('force l’envoi quand la page passe en arrière-plan', async () => {
    const { pont, recus } = await pontEnModeAppli()
    pont.sauver({ n: 1 })
    pont.sauver({ n: 2 })

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(recus).toHaveLength(2)
    expect(recus[1]).toMatchObject({ etat: { n: 2 } })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('force l’envoi à pagehide', async () => {
    const { pont, recus } = await pontEnModeAppli()
    pont.sauver({ n: 1 })
    pont.sauver({ n: 2 })

    window.dispatchEvent(new Event('pagehide'))

    expect(recus).toHaveLength(2)
    expect(recus[1]).toMatchObject({ etat: { n: 2 } })
  })

  it('ne renvoie rien à pagehide quand tout est déjà envoyé', async () => {
    const { pont, recus } = await pontEnModeAppli()
    pont.sauver({ n: 1 })

    window.dispatchEvent(new Event('pagehide'))

    expect(recus).toHaveLength(1)
  })

  it('refuse un état trop gros sans le marquer comme envoyé', async () => {
    const { pont, recus } = await pontEnModeAppli()
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    pont.sauver({ gros: 'x'.repeat(200_001) })

    expect(recus).toEqual([])
    expect(erreur).toHaveBeenCalled()
  })

  it('refuse de sauver avant demarrer()', () => {
    const { pont, recus } = monter()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    pont.sauver({ n: 1 })

    expect(recus).toEqual([])
  })

  it('en mode autonome, appelle autonome.sauver au lieu d’envoyer', async () => {
    const { pont, recus } = monter()
    const sauver = vi.fn()
    const demarrage = pont.demarrer({ manifeste: MANIFESTE, autonome: { ask: vi.fn(), sauver } })
    await vi.advanceTimersByTimeAsync(2000)
    await demarrage
    recus.length = 0

    pont.sauver({ n: 1 })
    pont.sauver({ n: 2 })
    await vi.advanceTimersByTimeAsync(INTERVALLE_SAUVER_MS)

    expect(sauver.mock.calls).toEqual([[{ n: 1 }], [{ n: 2 }]])
    expect(recus).toEqual([])
  })

  it('journalise une sauvegarde autonome qui échoue', async () => {
    const { pont } = monter()
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const autonome: Autonome = { ask: vi.fn(), sauver: () => Promise.reject(new Error('quota')) }
    const demarrage = pont.demarrer({ manifeste: MANIFESTE, autonome })
    await vi.advanceTimersByTimeAsync(2000)
    await demarrage

    pont.sauver({ n: 1 })
    await vi.advanceTimersByTimeAsync(0)

    expect(erreur).toHaveBeenCalledWith(
      expect.stringContaining('sauvegarde autonome'),
      expect.any(Error),
    )
  })
})

describe('demanderCorrection', () => {
  async function pontEnModeAppli() {
    const monte = monter()
    const demarrage = monte.pont.demarrer({ manifeste: MANIFESTE })
    monte.depuisParent(INIT)
    await demarrage
    return monte
  }

  it('envoie la demande et rend la correction de la même question', async () => {
    const { pont, depuisParent, recus } = await pontEnModeAppli()

    const correction = pont.demanderCorrection(DEMANDE)
    depuisParent({ ...CORRECTION, question: 'R2' })
    depuisParent(CORRECTION)

    expect(recus.at(-1)).toMatchObject({
      type: 'restitution.demande',
      question: 'R1',
      reponse: DEMANDE.reponse,
    })
    await expect(correction).resolves.toEqual(ATTENDUE)
  })

  it('refuse avec l’erreur de l’appli quand elle refuse ce message', async () => {
    const { pont, depuisParent, recus } = await pontEnModeAppli()
    const correction = pont.demanderCorrection(DEMANDE)
    const id = recus.at(-1)?.id

    depuisParent({
      type: 'erreur',
      code: 'correction_indisponible',
      detail: 'Indisponible.',
      message_id: id,
    })

    await expect(correction).rejects.toBeInstanceOf(ErreurPont)
    await expect(correction).rejects.toMatchObject({
      code: 'correction_indisponible',
      detail: 'Indisponible.',
    })
  })

  it('refuse une demande mal formée sans rien envoyer', async () => {
    const { pont, recus } = await pontEnModeAppli()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const avant = recus.length

    await expect(pont.demanderCorrection({ ...DEMANDE, reponse: '' })).rejects.toThrow('mal formée')
    expect(recus).toHaveLength(avant)
  })

  describe('en mode autonome', () => {
    async function pontAutonome(ask: Autonome['ask']) {
      const monte = monter()
      const demarrage = monte.pont.demarrer({
        manifeste: MANIFESTE,
        autonome: { ask, sauver: vi.fn() },
      })
      await vi.advanceTimersByTimeAsync(2000)
      await demarrage
      return monte
    }

    it('appelle autonome.ask et rend sa correction validée', async () => {
      const ask = vi.fn(() => Promise.resolve(ATTENDUE))
      const { pont, recus } = await pontAutonome(ask)
      const avant = recus.length

      await expect(pont.demanderCorrection(DEMANDE)).resolves.toEqual(ATTENDUE)

      expect(ask).toHaveBeenCalledWith(DEMANDE)
      expect(recus).toHaveLength(avant)
    })

    it('refuse une correction qui ne respecte pas le schéma', async () => {
      const { pont } = await pontAutonome(() => Promise.resolve({ message: 'ok' } as never))

      await expect(pont.demanderCorrection(DEMANDE)).rejects.toThrow()
    })

    it('refuse une demande mal formée sans appeler ask', async () => {
      const ask = vi.fn()
      const { pont } = await pontAutonome(ask)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(pont.demanderCorrection({ ...DEMANDE, reponse: '' })).rejects.toThrow(
        'mal formée',
      )
      expect(ask).not.toHaveBeenCalled()
    })

    it('refuse si la fiche n’a pas fourni « ask »', async () => {
      const monte = monter()
      const demarrage = monte.pont.demarrer({ manifeste: MANIFESTE })
      await vi.advanceTimersByTimeAsync(2000)
      await demarrage

      await expect(monte.pont.demanderCorrection(DEMANDE)).rejects.toThrow('ask')
    })
  })
})
