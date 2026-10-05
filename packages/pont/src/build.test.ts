import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const LIMITE_GZIP_OCTETS = 15 * 1024

/** Construit pont.js comme `pnpm build`, sans rien écrire sur le disque. */
async function construire() {
  const resultat = await build({ logLevel: 'silent', build: { write: false } })
  const sorties = (Array.isArray(resultat) ? resultat : [resultat]).flatMap((r) =>
    'output' in r ? r.output : [],
  )
  const [fichier] = sorties
  if (sorties.length !== 1 || fichier?.type !== 'chunk') throw new Error('Un seul fichier attendu')
  return fichier
}

describe('pont.js', () => {
  it('est un seul fichier, sans import, de moins de 15 ko en gzip', async () => {
    const fichier = await construire()

    expect(fichier.fileName).toBe('pont.js')
    expect(fichier.imports).toEqual([])
    expect(fichier.dynamicImports).toEqual([])
    expect(gzipSync(fichier.code).length).toBeLessThan(LIMITE_GZIP_OCTETS)
  }, 30_000)

  it('pose window.JanusPont quand une fiche le charge', async () => {
    const fichier = await construire()
    const fenetre = document.defaultView
    if (fenetre === null) throw new Error('Pas de fenêtre')
    fenetre.eval(fichier.code)

    // Le script s'exécute dans la fenêtre de jsdom, pas dans l'objet global de vitest.
    const pont: unknown = document.defaultView?.JanusPont

    expect(Object.keys(pont as object).sort()).toEqual([
      'demanderCorrection',
      'demarrer',
      'envoyer',
      'renvoyer',
      'sauver',
      'surErreur',
      'surEtape',
      'surStatut',
    ])
  }, 30_000)
})
