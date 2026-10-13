import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { instantEnMs, jourDe } from './temps.ts'

// L'ancienne implémentation, mot pour mot (un formateur Intl neuf à chaque appel, aucun cache) :
// elle sert d'oracle à la version mise en cache.
const MS_PAR_JOUR_REF = 86_400_000
const enJourRef = (date: Date) =>
  `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

function lireJourRef(jour: string): Date {
  const trouve = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour)
  if (trouve === null) throw new Error(`Jour illisible : ${jour}`)
  const date = new Date(Date.UTC(Number(trouve[1]), Number(trouve[2]) - 1, Number(trouve[3])))
  if (enJourRef(date) !== jour) throw new Error(`Jour illisible : ${jour}`)
  return date
}

function instantEnMsRef(instantIso: string): number {
  const jour = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/.exec(
    instantIso,
  )?.[1]
  let existe = false
  try {
    if (jour !== undefined) {
      lireJourRef(jour)
      existe = true
    }
  } catch {
    existe = false
  }
  if (jour === undefined || !existe) throw new Error(`Instant illisible : ${instantIso}`)
  return Date.parse(instantIso)
}

function jourDeRef(instantIso: string, fuseau: string, heureBascule: number): string {
  const instant = instantEnMsRef(instantIso)
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const champs = Object.fromEntries(parties.map(({ type, value }) => [type, value]))
  const dateLocale = enJourRef(
    new Date(Date.UTC(Number(champs['year']), Number(champs['month']) - 1, Number(champs['day']))),
  )
  return Number(champs['hour']) < heureBascule
    ? enJourRef(new Date(lireJourRef(dateLocale).getTime() - MS_PAR_JOUR_REF))
    : dateLocale
}

const FUSEAUX = [
  'Europe/Paris',
  'America/New_York',
  'Asia/Kolkata',
  'Australia/Lord_Howe',
  'Pacific/Chatham',
  'America/St_Johns',
  'Africa/Casablanca',
  'Pacific/Apia',
  'UTC',
]

describe('jourDe et instantEnMs : même résultat que l’implémentation sans cache', () => {
  it('rend le même jour, deux fois de suite (calcul puis cache), pour tout fuseau, instant et bascule', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FUSEAUX),
        fc.integer({ min: Date.UTC(1900, 0, 1), max: Date.UTC(2100, 0, 1) }),
        fc.integer({ min: 0, max: 6 }),
        (fuseau, ms, bascule) => {
          const instant = new Date(ms).toISOString()
          const attendu = jourDeRef(instant, fuseau, bascule)
          expect(jourDe(instant, fuseau, bascule)).toBe(attendu)
          expect(jourDe(instant, fuseau, bascule)).toBe(attendu)
        },
      ),
      { seed: 20260101, numRuns: 1500 },
    )
  })

  it('rend le même jour autour des changements d’heure de chaque fuseau', () => {
    const departs = [Date.UTC(2026, 2, 24), Date.UTC(2026, 9, 21), Date.UTC(2026, 3, 1)]
    for (const fuseau of FUSEAUX) {
      for (const depart of departs) {
        // Deux semaines, un instant par heure et par fuseau, décalé de 20 minutes.
        for (let heure = 0; heure < 24 * 14; heure += 1) {
          const instant = new Date(depart + heure * 3_600_000 + 1_200_000).toISOString()
          expect(jourDe(instant, fuseau, 4)).toBe(jourDeRef(instant, fuseau, 4))
        }
      }
    }
  })

  it('accepte et refuse les mêmes instants', () => {
    const chiffres = (n: number, largeur: number) => String(n).padStart(largeur, '0')
    fc.assert(
      fc.property(
        fc.record({
          annee: fc.oneof(fc.integer({ min: 0, max: 120 }), fc.integer({ min: 1890, max: 2110 })),
          mois: fc.integer({ min: 0, max: 14 }),
          jour: fc.integer({ min: 0, max: 33 }),
          heure: fc.integer({ min: 0, max: 25 }),
          minute: fc.integer({ min: 0, max: 61 }),
          fin: fc.constantFrom('Z', '.5Z', '.123456Z', '', '+02:00'),
        }),
        ({ annee, mois, jour, heure, minute, fin }) => {
          const instant = `${chiffres(annee, 4)}-${chiffres(mois, 2)}-${chiffres(jour, 2)}T${chiffres(heure, 2)}:${chiffres(minute, 2)}:00${fin}`
          let attendu: number | Error
          try {
            attendu = instantEnMsRef(instant)
          } catch (erreur) {
            attendu = erreur instanceof Error ? erreur : new Error('inattendu')
          }
          if (attendu instanceof Error) {
            expect(() => instantEnMs(instant)).toThrow(attendu.message)
          } else {
            expect(instantEnMs(instant)).toBe(attendu)
          }
        },
      ),
      { seed: 20260102, numRuns: 4000 },
    )
  })

  it('refuse un fuseau inconnu, avant comme après un instant déjà vu', () => {
    expect(() => jourDe('2026-07-15T02:01:00Z', 'Mars/Olympus', 4)).toThrow(RangeError)
    expect(() => jourDe('2026-07-15T02:01:00Z', 'Mars/Olympus', 4)).toThrow(RangeError)
  })
})
