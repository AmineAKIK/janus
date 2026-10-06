import { afterEach, describe, expect, it, vi } from 'vitest'
import { egalJson, executerCode, jugerCas } from './executeur.ts'

describe('egalJson', () => {
  it('compare les objets sans tenir compte de l’ordre des clés', () => {
    expect(egalJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true)
  })

  it('distingue les tableaux de longueurs ou d’ordres différents', () => {
    expect(egalJson([1, 2], [1, 2, 3])).toBe(false)
    expect(egalJson([1, 2], [2, 1])).toBe(false)
  })

  it('ne confond ni le nombre et le texte, ni null et un objet vide', () => {
    expect(egalJson(1, '1')).toBe(false)
    expect(egalJson(null, {})).toBe(false)
    expect(egalJson({ a: 1 }, { b: 1 })).toBe(false)
  })
})

describe('jugerCas', () => {
  const cas = [
    { entree: [1, 2], sortie: 3 },
    { entree: [2, 2], sortie: 4 },
    { entree: [0, 0], sortie: 0 },
    { entree: [5, 5], sortie: 10 },
  ]

  it('range chaque cas : réussi, raté, exception, temps dépassé', () => {
    const resultats = jugerCas(cas, [
      { ok: true, sortie: 3 },
      { ok: true, sortie: 5 },
      { ok: false, erreur: 'ReferenceError: x is not defined' },
      { ok: false, erreur: 'temps_depasse' },
    ])

    expect(resultats).toEqual([
      { reussi: true, obtenu: 3 },
      { reussi: false, obtenu: 5 },
      { reussi: false, erreur: 'ReferenceError: x is not defined' },
      { reussi: false, erreur: 'temps_depasse' },
    ])
  })

  it('compte un cas sans réponse comme un temps dépassé', () => {
    expect(jugerCas(cas.slice(0, 1), [])).toEqual([{ reussi: false, erreur: 'temps_depasse' }])
  })
})

describe('executerCode', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  function iframeCree(): HTMLIFrameElement {
    const iframe = document.querySelector('iframe')
    if (iframe === null) throw new Error('Pas d’iframe')
    return iframe
  }

  it('crée une iframe cachée en sandbox allow-scripts seulement', () => {
    void executerCode('function f() {}', [])
    const iframe = iframeCree()

    expect(iframe.hidden).toBe(true)
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('envoie le code quand l’iframe est prête, puis juge les réponses', async () => {
    const promesse = executerCode('function f(a) { return a }', [{ entree: [1], sortie: 1 }])
    const iframe = iframeCree()
    const envoyes: unknown[] = []
    vi.spyOn(iframe.contentWindow ?? window, 'postMessage').mockImplementation(
      (message: unknown) => {
        envoyes.push(message)
      },
    )

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'pret' }, source: iframe.contentWindow }),
    )
    const demande = envoyes[0]
    if (
      typeof demande !== 'object' ||
      demande === null ||
      !('id' in demande) ||
      !('code' in demande)
    ) {
      throw new Error('Demande absente')
    }
    expect(demande.code).toBe('function f(a) { return a }')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'resultat', id: demande.id, resultats: [{ ok: true, sortie: 1 }] },
        source: iframe.contentWindow,
      }),
    )

    expect(await promesse).toEqual({
      code: 'function f(a) { return a }',
      cas: [{ reussi: true, obtenu: 1 }],
      reussis: 1,
    })
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('ignore un message qui ne vient pas de l’iframe', async () => {
    vi.useFakeTimers()
    const promesse = executerCode('function f() {}', [{ entree: [], sortie: 1 }], { delaiMs: 10 })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'resultat', id: 'execution-1', resultats: [{ ok: true, sortie: 1 }] },
        source: window,
      }),
    )
    await vi.advanceTimersByTimeAsync(100)

    expect((await promesse).reussis).toBe(0)
  })

  it('rend une exécution ratée quand l’iframe ne répond jamais', async () => {
    vi.useFakeTimers()
    const promesse = executerCode('function f() {}', [{ entree: [], sortie: 1 }], { delaiMs: 10 })

    await vi.advanceTimersByTimeAsync(100)

    expect(await promesse).toMatchObject({
      reussis: 0,
      cas: [{ reussi: false, erreur: 'temps_depasse' }],
    })
  })
})
