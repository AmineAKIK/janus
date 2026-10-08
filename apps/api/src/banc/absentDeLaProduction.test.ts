import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = new URL('..', import.meta.url).pathname

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) =>
    entree.isDirectory() ? fichiers(join(dossier, entree.name)) : [join(dossier, entree.name)],
  )
}

describe('le banc de la CI', () => {
  it('n’est importé par aucun fichier de production : ses routes n’existent pas en production', () => {
    const importeurs = fichiers(SRC)
      .filter((chemin) => chemin.endsWith('.ts') && !chemin.endsWith('.test.ts'))
      .filter((chemin) => !relative(SRC, chemin).startsWith('banc'))
      .filter((chemin) => /from\s+['"][^'"]*\/banc\//.test(readFileSync(chemin, 'utf8')))

    expect(importeurs).toEqual([])
  })

  it('n’est pas lancé par le script de démarrage', () => {
    const paquet: unknown = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    )
    const demarrage =
      typeof paquet === 'object' && paquet !== null && 'scripts' in paquet
        ? JSON.stringify(paquet.scripts)
        : ''
    expect(demarrage).toContain('"start":"node src/demarrer.ts"')
  })
})
