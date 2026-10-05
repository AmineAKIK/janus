import { describe, expect, it } from 'vitest'
import { estRecopiee } from './recopie.ts'

/** `n` mots distincts : `prefixe1 prefixe2 … prefixeN`. */
function mots(prefixe: string, n: number): string {
  return Array.from({ length: n }, (_, i) => `${prefixe}${String(i + 1)}`).join(' ')
}

/**
 * Réponse de 100 suites de 8 mots dont `presentes` sont dans la source :
 * la source tient en `presentes + 7` mots, la réponse la recopie puis ajoute des mots neufs.
 */
function cas(presentes: number): { reponse: string; sources: string[] } {
  const source = mots('s', presentes + 7)
  return { reponse: `${source} ${mots('n', 100 - presentes)}`, sources: [source] }
}

describe('estRecopiee', () => {
  it('ne recopie jamais une réponse de moins de 8 mots', () => {
    expect(
      estRecopiee('un deux trois quatre cinq six sept', ['un deux trois quatre cinq six sept'], 0),
    ).toBe(false)
  })

  it('recopie une réponse de 8 mots présente telle quelle', () => {
    const texte = 'un deux trois quatre cinq six sept huit'
    expect(estRecopiee(texte, [texte], 0.5)).toBe(true)
  })

  it('ne recopie pas une réponse sans suite commune', () => {
    expect(estRecopiee(mots('a', 20), [mots('b', 20)], 0.5)).toBe(false)
  })

  it('reste à 49 % : pas recopiée', () => {
    const { reponse, sources } = cas(49)
    expect(estRecopiee(reponse, sources, 0.5)).toBe(false)
  })

  it('reste à 50 % : pas recopiée, le seuil est strict', () => {
    const { reponse, sources } = cas(50)
    expect(estRecopiee(reponse, sources, 0.5)).toBe(false)
  })

  it('passe à 51 % : recopiée', () => {
    const { reponse, sources } = cas(51)
    expect(estRecopiee(reponse, sources, 0.5)).toBe(true)
  })

  it('ignore la casse, les accents composés, la ponctuation et les espaces en trop', () => {
    const source = 'Le serveur renvoie une réponse au client, puis ferme la connexion.'
    const reponse = '  LE   serveur renvoie, une réponse au client ; puis ferme la connexion ! '
    expect(estRecopiee(reponse, [source], 0.5)).toBe(true)
  })

  it('normalise en NFKC : une ligature ou une largeur pleine valent leur forme simple', () => {
    const source = 'ﬁn de la phase un deux trois quatre cinq'
    const reponse = 'fin de la phase un deux trois quatre cinq'
    expect(estRecopiee(reponse, [source], 0.5)).toBe(true)
  })

  it('cherche dans toutes les sources, sans mélanger deux sources', () => {
    const a = 'un deux trois quatre cinq six sept huit'
    const b = 'neuf dix onze douze treize quatorze quinze seize'
    expect(estRecopiee(a, [b, a], 0.5)).toBe(true)
    // Une suite à cheval sur la fin de a et le début de b n’existe dans aucune source.
    expect(estRecopiee('cinq six sept huit neuf dix onze douze', [a, b], 0.5)).toBe(false)
  })

  it('ne recopie pas sans source', () => {
    expect(estRecopiee(mots('a', 20), [], 0.5)).toBe(false)
  })
})
