import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Catalogue } from '@janus/contrats'
import { describe, expect, it } from 'vitest'

const racine = join(dirname(fileURLToPath(import.meta.url)), '../../../contenu')
const lire = (chemin: string): unknown => JSON.parse(readFileSync(join(racine, chemin), 'utf8'))

describe('catalogues de contenu', () => {
  it('DWWM : la formation et son premier module sont valides', () => {
    const catalogue = Catalogue.parse(lire('dwwm/catalogue.json'))

    expect(catalogue.formation.code).toBe('DWWM')
    expect(catalogue.modules.map((m) => [m.code, m.titre])).toEqual([
      ['M1', 'Écosystème et outils du développeur'],
    ])
  })

  it('DWWM : le module 1 est importé, avec ses 20 blocs B01 à B20 dans l’ordre, sans doublon', () => {
    const catalogue = Catalogue.parse(lire('dwwm/catalogue.json'))
    const [premier] = catalogue.modules

    expect(premier?.importe).toBe(true)
    if (premier?.importe !== true) return
    const blocs = premier.parties.flatMap((partie) => partie.blocs)
    expect(blocs).toEqual(
      Array.from({ length: 20 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
    )
    expect(premier.parties.map((partie) => partie.code)).toEqual([
      'P1',
      'P2',
      'P3',
      'P4',
      'P5',
      'P6',
    ])
    expect(premier.taches_reservees).toHaveLength(6)
  })
})
