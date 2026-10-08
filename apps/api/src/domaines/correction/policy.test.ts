import { Manifeste } from '@janus/contrats'
import demo from '@janus/contrats/fixtures/manifeste-demo.json'
import { describe, expect, it } from 'vitest'
import { MESSAGE_MAX, MESSAGE_MIN, moisDe, tireeAuSort, validerSortie } from './policy.ts'

const MANIFESTE = Manifeste.parse(demo)
const [source] = MANIFESTE.sources
const [erreur] = MANIFESTE.erreurs_critiques
const MESSAGE = `${'Tu as bien compris que la fiche résume un seul bloc de cours. '.repeat(3)}Reprends maintenant l’exemple du cours pour voir comment l’appliquer.`

const sortie = (surcharge: Record<string, unknown> = {}) =>
  JSON.stringify({
    message: MESSAGE,
    niveau: 'solide',
    erreurs_critiques: [],
    source: 'deduit',
    ref: '',
    certitude: 'sur',
    ...surcharge,
  })
const motif = (texte: string) => {
  const validation = validerSortie(texte, MANIFESTE)
  return validation.valide ? undefined : validation.motif
}

describe('validerSortie', () => {
  it('accepte un JSON aux champs exacts', () => {
    const validation = validerSortie(sortie(), MANIFESTE)

    expect(validation).toEqual({
      valide: true,
      sortie: {
        message: MESSAGE,
        niveau: 'solide',
        erreurs: [],
        source: 'deduit',
        ref: '',
        certitude: 'sur',
      },
    })
    expect(MESSAGE.length).toBeGreaterThanOrEqual(MESSAGE_MIN)
  })

  it.each([
    ['un texte qui n’est pas du JSON', 'bonjour'],
    ['un JSON qui n’est pas un objet', '[1]'],
    ['un champ en trop', sortie({ statut: 'acquis' })],
    ['un niveau inconnu', sortie({ niveau: 'moyen' })],
    ['une source inconnue', sortie({ source: 'internet' })],
    ['une certitude inconnue', sortie({ certitude: 'peut-etre' })],
    ['un champ manquant', JSON.stringify({ message: MESSAGE })],
  ])('refuse %s', (_nom, texte) => {
    expect(motif(texte)).toBe('JSON absent ou aux champs inattendus')
  })

  it('refuse un message trop court ou trop long', () => {
    expect(motif(sortie({ message: 'x'.repeat(MESSAGE_MIN - 1) }))).toMatch(/hors de 150 à 1500/)
    expect(motif(sortie({ message: 'x'.repeat(MESSAGE_MAX + 1) }))).toMatch(/hors de 150 à 1500/)
    expect(motif(sortie({ message: 'x'.repeat(MESSAGE_MIN) }))).toBeUndefined()
    expect(motif(sortie({ message: 'x'.repeat(MESSAGE_MAX) }))).toBeUndefined()
  })

  it.each(['acquis', 'Validé', 'ACQUIS', 'c’est acquis.'])(
    'refuse un message qui donne un statut (« %s »)',
    (mot) => {
      expect(motif(sortie({ message: `${MESSAGE} ${mot}` }))).toBe('message avec un mot de statut')
    },
  )

  it('laisse passer des mots qui contiennent seulement ces lettres', () => {
    expect(
      motif(sortie({ message: `${MESSAGE} Cette acquisition est validée par le cours.` })),
    ).toBe(undefined)
  })

  it('remplace les espaces insécables et fines par des espaces normales', () => {
    const insecable = String.fromCharCode(0xa0)
    const fine = String.fromCharCode(0x202f)
    const validation = validerSortie(
      sortie({ message: `${MESSAGE} Bravo${insecable}!${fine}Encore.` }),
      MANIFESTE,
    )

    expect(validation.valide && validation.sortie.message.endsWith('Bravo ! Encore.')).toBe(true)
  })

  it('refuse une ref qui n’existe pas, et une source « support » sans ref', () => {
    expect(motif(sortie({ ref: 'S99' }))).toBe('ref inconnue')
    expect(motif(sortie({ source: 'support', ref: '' }))).toBe('source « support » sans ref')
    expect(motif(sortie({ source: 'support', ref: source?.id }))).toBeUndefined()
  })

  it('écarte les erreurs critiques inconnues et les doublons', () => {
    const validation = validerSortie(
      sortie({ erreurs_critiques: [erreur?.id, 'E99', erreur?.id] }),
      MANIFESTE,
    )

    expect(validation.valide && validation.sortie.erreurs).toEqual([erreur?.id])
  })
})

describe('tireeAuSort', () => {
  it('tire un premier tour sur dix, jamais une relance', () => {
    expect(tireeAuSort(1, 10, 0)).toBe(true)
    expect(tireeAuSort(1, 10, 0.099)).toBe(true)
    expect(tireeAuSort(1, 10, 0.1)).toBe(false)
    expect(tireeAuSort(2, 10, 0)).toBe(false)
  })

  it('ne tire rien quand le réglage est à zéro', () => {
    expect(tireeAuSort(1, 0, 0)).toBe(false)
  })
})

describe('moisDe', () => {
  it('rend AAAA-MM', () => {
    expect(moisDe('2026-10-31T23:59:59.000Z')).toBe('2026-10')
  })
})
