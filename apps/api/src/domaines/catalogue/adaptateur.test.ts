import { describe, expect, it } from 'vitest'
import {
  SEUIL_MEDIAS_OCTETS,
  empreinteDuTexte,
  extraireManifeste,
  extraireSons,
} from './adaptateur.ts'

describe('extraireManifeste', () => {
  const page = (attributs: string) =>
    `<html><script>var a = 1</script><script ${attributs}>{"bloc":"D01"}</script></html>`

  it.each(['bloc-manifest', 'manifeste'])('lit le manifeste rangé sous l’id %s', (id) => {
    expect(extraireManifeste(page(`type="application/json" id="${id}"`))).toBe('{"bloc":"D01"}')
    expect(extraireManifeste(page(`id='${id}' type='application/json'`))).toBe('{"bloc":"D01"}')
  })

  it('ignore un script qui n’est pas du JSON ou qui porte un autre id', () => {
    expect(extraireManifeste(page('type="text/javascript" id="bloc-manifest"'))).toBeUndefined()
    expect(extraireManifeste(page('type="application/json" id="autre"'))).toBeUndefined()
    expect(extraireManifeste('<p>rien</p>')).toBeUndefined()
  })
})

describe('extraireSons', () => {
  const son = (octets: number, remplissage = 'A') =>
    `data:audio/mpeg;base64,${remplissage.repeat(octets)}`

  it('laisse la fiche telle quelle sous 2 Mo de médias', () => {
    const html = `<audio src="${son(1000)}"></audio>`

    const resultat = extraireSons(html)

    expect(resultat.html).toBe(html)
    expect(resultat.fichiers).toEqual([])
  })

  it('extrait les sons au-delà de 2 Mo et réécrit leurs adresses', () => {
    const html = `<audio src="${son(SEUIL_MEDIAS_OCTETS)}"></audio><audio src="${son(400, 'B')}"></audio>`

    const resultat = extraireSons(html)

    expect(resultat.fichiers).toHaveLength(2)
    const [premier] = resultat.fichiers
    expect(premier?.nom).toMatch(/^[0-9a-f]{16}\.mp3$/)
    expect(resultat.html).toBe(
      `<audio src="${premier?.nom ?? ''}"></audio><audio src="${resultat.fichiers[1]?.nom ?? ''}"></audio>`,
    )
    expect(resultat.octetsMedias).toBeGreaterThan(SEUIL_MEDIAS_OCTETS)
  })

  it('range une seule fois un son répété, et laisse les images en place', () => {
    const image = 'data:image/png;base64,iVBORw0KGgo='
    const html = `<audio src="${son(SEUIL_MEDIAS_OCTETS)}"></audio><audio src="${son(SEUIL_MEDIAS_OCTETS)}"></audio><img src="${image}">`

    const resultat = extraireSons(html)

    expect(resultat.fichiers).toHaveLength(1)
    expect(resultat.html).toContain(image)
  })

  it('laisse en place un son d’un format inconnu', () => {
    const inconnu = `data:audio/x-inconnu;base64,${'A'.repeat(SEUIL_MEDIAS_OCTETS)}`

    expect(extraireSons(`<audio src="${inconnu}">`).html).toContain(inconnu)
  })
})

describe('empreinteDuTexte', () => {
  it('rend le SHA-256 en hexadécimal', () => {
    expect(empreinteDuTexte('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
