import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validerManifeste } from '@janus/contrats'
import { beforeAll, describe, expect, it } from 'vitest'
import { extraireManifeste } from './domaines/catalogue/adaptateur.ts'
import { texteDeLaFiche } from './texteFiche.ts'

const GABARIT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../contenu/dwwm/gabarit/fiche.html',
)

/** La fiche du gabarit, avec une explication et un item remplis, et des réponses qui ne doivent pas fuiter. */
async function ficheRemplie(): Promise<string> {
  const html = (await readFile(GABARIT, 'utf8'))
    .replace(
      "<p>À REMPLACER : l'explication du bloc.</p>",
      [
        '<div data-ecran="Les poids">',
        '  <div role="img" aria-label="La suite 01001101"><span>128</span><span>0</span></div>',
        '  <p>Une phrase\n     coupée par le formatage.<span aria-hidden="true">✓</span></p>',
        '  <p>Un octet a <strong>8&nbsp;bits</strong> &amp; 256 valeurs.</p>',
        '  <svg viewBox="0 0 10 10"><text>8</text></svg><img src="data:," alt="Huit lampes">',
        '  <div data-widget="octet" data-cible="150"></div>',
        '  <ul><li>128</li><li>64</li></ul>',
        '  <details><summary>Un coup de pouce</summary><p>150 − 128 = 22</p></details>',
        '</div>',
      ].join('\n'),
    )
    .replace(
      "<p>À REMPLACER : énoncé de l'item PR1-1.</p>",
      '<p>Convertis <code>150</code> en binaire.</p><div data-widget="convertir" data-reponse="10010110" data-succes="Bravo, 10010110."></div>',
    )
  const texte = extraireManifeste(html) ?? ''
  const manifeste = JSON.parse(texte) as {
    restitution: { attendu: string }[]
    cartes: { verso: string }[]
  }
  const [r1] = manifeste.restitution
  const [k1] = manifeste.cartes
  if (r1 === undefined || k1 === undefined) throw new Error('gabarit')
  r1.attendu = 'Attendu secret de R1.'
  k1.verso = 'Verso secret de K1.'
  return html.replace(texte, () => JSON.stringify(manifeste))
}

describe('texteDeLaFiche : ce que lit l’apprenant neuf', () => {
  let html: string
  let texte: string
  beforeAll(async () => {
    html = await ficheRemplie()
    const resultat = validerManifeste(JSON.parse(extraireManifeste(html) ?? 'null'))
    if (!resultat.ok) throw new Error('Le gabarit rempli doit rester valide.')
    texte = texteDeLaFiche(html, resultat.manifeste)
  })

  it('donne l’objectif, puis chaque explication, écran par écran, en texte simple', () => {
    expect(texte).toContain('Objectif : À REMPLACER : ce que tu sauras faire à la fin')
    expect(texte).toContain('### ET2 : Explication')
    expect(texte).toContain('#### Les poids')
    expect(texte).toContain('Un octet a 8 bits & 256 valeurs.')
    expect(texte).toContain('- 128\n- 64')
    expect(texte).toContain('Un coup de pouce')
    expect(texte).toContain('150 − 128 = 22')
  })

  it('garde les phrases entières, même coupées par le formatage du fichier', () => {
    expect(texte).toContain('Une phrase coupée par le formatage.\n')
  })

  it('signale un outil interactif sans en donner le fonctionnement', () => {
    expect(texte).toContain('[outil interactif : octet]')
  })

  it('remplace une image par sa description, et tait ce qui est décoratif', () => {
    expect(texte).toContain('[image : La suite 01001101]')
    expect(texte).toContain('[image : sans description] [image : Huit lampes]')
    expect(texte).not.toContain('1280')
    expect(texte).not.toContain('✓')
  })

  it('pose ensuite la pratique, les questions, les tâches différées et les cartes, sans réponse', () => {
    expect(texte).toContain('- PR1-1 : Convertis 150 en binaire. [outil interactif : convertir]')
    expect(texte).toMatch(/- R1 : .+/)
    expect(texte).toMatch(/- DE1 : .+/)
    expect(texte).toMatch(/- K1 : .+/)
    for (const reponse of ['10010110', 'Bravo', 'Attendu secret', 'Verso secret', 'correcteur']) {
      expect(texte).not.toContain(reponse)
    }
  })

  it('lit aussi la perception, le pré-test et l’ensemble, dans l’ordre du manifeste', () => {
    const texteManifeste = extraireManifeste(html) ?? ''
    const manifeste = JSON.parse(texteManifeste) as {
      etapes: { id: string; titre: string; type: string }[]
    }
    const [carte, explication, ...suite] = manifeste.etapes
    if (carte === undefined || explication === undefined) throw new Error('gabarit')
    manifeste.etapes = [
      carte,
      { id: 'ET7', titre: 'Perception', type: 'perception' },
      { id: 'ET8', titre: 'Pré-test', type: 'pretest' },
      explication,
      { id: 'ET9', titre: 'L’ensemble', type: 'ensemble' },
      ...suite,
    ]
    const page = html
      .replace(texteManifeste, () => JSON.stringify(manifeste))
      .replace(
        '</body>',
        [
          '<template data-etape="ET7"><p>Regarde les huit lampes s’allumer.</p></template>',
          '<template data-etape="ET8"><p>Parie : combien de valeurs ?</p></template>',
          '<template data-etape="ET9"><p>Le tout : les poids font le nombre.</p></template>',
          '</body>',
        ].join(''),
      )
    const resultat = validerManifeste(JSON.parse(extraireManifeste(page) ?? 'null'))
    if (!resultat.ok) throw new Error(resultat.problemes.map(({ message }) => message).join(' ; '))

    const lu = texteDeLaFiche(page, resultat.manifeste)

    // Le gabarit n'a pas de template ET1 : la carte ne donne rien à lire ici.
    const positions = [
      '### ET7 : Perception',
      'Regarde les huit lampes s’allumer.',
      '### ET8 : Pré-test',
      'Parie : combien de valeurs ?',
      '### ET2 : Explication',
      '### ET9 : L’ensemble',
      'Le tout : les poids font le nombre.',
      '## Ce qu’on te demande',
    ].map((titre) => lu.indexOf(titre))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('ne prend pas pour un template ce que la plomberie en dit dans un commentaire', () => {
    // La plomberie cite `<template data-etape="ET1">` : ce n'est pas la carte.
    expect(texte).not.toContain('afficherCarte')
    expect(texte).not.toContain('etapes[0].id')
  })

  it('met tout l’enseignement avant la première question', () => {
    const positions = [
      '## Ce que la fiche enseigne',
      '### ET2 : Explication',
      '## Ce qu’on te demande',
      '### Pratique',
      '### Restitution',
      '### Consolidation',
      '### Rappel',
      '### Tâches différées',
      '### Cartes',
    ].map((titre) => texte.indexOf(titre))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})
