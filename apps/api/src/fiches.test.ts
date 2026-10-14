import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extraireManifeste } from './domaines/catalogue/adaptateur.ts'
import { TAILLE_MAX_FICHE, lireLesFiches, verifierLesFiches } from './fiches.ts'

/** Le gabarit des fiches : une fiche complète (bloc X00), telle que `fiches:nouvelle` la copie. */
const GABARIT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../contenu/dwwm/gabarit/fiche.html',
)

function catalogue(blocs: string[]) {
  return {
    formation: { code: 'TEST', titre: 'Essai', description: '' },
    modules: [
      {
        code: 'M1',
        titre: 'Module',
        description: '',
        ordre: 1,
        importe: true,
        parties: [{ code: 'P1', titre: 'Partie', blocs }],
      },
    ],
  }
}

const EMPREINTE = 'a'.repeat(64)
/** Le pont construit, tel que `fiches:assembler` l'écrit : son en-tête puis le code. */
const PONT = `/*! janus-pont v1 ${EMPREINTE} */\nwindow.JanusPont = {}`

type Manifeste = {
  version: number
  pont: number
  restitution: { id: string; question: string; attendu: string }[]
  rappel: { id: string; question: string; attendu: string; erreurs: string[] }[]
  differees: { id: string; consigne: string; attendu: string }[]
}

/** La fiche avec son manifeste modifié (le texte JSON est remplacé dans la page). */
function avecManifeste(html: string, modifier: (manifeste: Manifeste) => void): string {
  const texte = extraireManifeste(html) ?? ''
  const manifeste = JSON.parse(texte) as Manifeste
  modifier(manifeste)
  return html.replace(texte, () => JSON.stringify(manifeste, null, 2))
}

/** Un `<template data-…="id">…</template>` et son contenu, retirés de la page. */
function sansTemplate(html: string, attribut: string, id: string): string {
  const motif = new RegExp(`<template ${attribut}="${id}">[\\s\\S]*?</template>\\s*`)
  expect(html).toMatch(motif)
  return html.replace(motif, '')
}

describe('vérification des fiches du dépôt', () => {
  let contenu: string
  let fiche: string
  beforeEach(async () => {
    contenu = await mkdtemp(join(tmpdir(), 'janus-fiches-'))
    // Comme une fiche assemblée : la bibliothèque du pont est écrite dans la page.
    fiche = (await readFile(GABARIT, 'utf8')).replace(
      '<script id="pont"></script>',
      `<script id="pont">${PONT}</script>`,
    )
    await mkdir(join(contenu, 'test', 'fiches'), { recursive: true })
    await writeFile(join(contenu, 'test', 'catalogue.json'), JSON.stringify(catalogue(['X00'])))
  })
  afterEach(async () => {
    await rm(contenu, { recursive: true, force: true })
  })

  const poser = (nom: string, html: string) => writeFile(join(contenu, 'test', 'fiches', nom), html)

  it('accepte une fiche valide, nommée d’après son bloc et présente au catalogue', async () => {
    await poser('X00.html', fiche)

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
  })

  it('refuse une fiche dont le pont n’est pas écrit dans la page', async () => {
    await poser(
      'X00.html',
      fiche.replace(`<script id="pont">${PONT}</script>`, '<script id="pont"></script>'),
    )

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
      expect.stringContaining('test/fiches/X00.html : le pont de l’appli n’est pas dans la fiche'),
    ])
  })

  it('ne dit rien d’une formation sans fiche', async () => {
    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    expect(await lireLesFiches(contenu, 'test')).toEqual([])
    expect(await lireLesFiches(contenu, 'absente')).toEqual([])
  })

  it('refuse une fiche sans manifeste', async () => {
    await poser('X00.html', '<html><body><script id="pont">x</script></body></html>')

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
      expect.stringContaining('test/fiches/X00.html : aucun manifeste'),
    ])
  })

  it('refuse un manifeste qui ne passe pas le validateur, avec le chemin du champ', async () => {
    await poser('X00.html', fiche.replace('"rappel"', '"rappel_perdu"'))

    const problemes = await verifierLesFiches({ dossierContenu: contenu })

    expect(problemes.length).toBeGreaterThan(0)
    expect(problemes.every((probleme) => probleme.startsWith('test/fiches/X00.html : '))).toBe(true)
  })

  it('refuse un fichier qui ne porte pas le nom de son bloc', async () => {
    await poser('autre.html', fiche)

    expect(await verifierLesFiches({ dossierContenu: contenu })).toContainEqual(
      expect.stringContaining('le fichier doit s’appeler X00.html'),
    )
  })

  it('refuse un bloc absent du catalogue', async () => {
    await writeFile(join(contenu, 'test', 'catalogue.json'), JSON.stringify(catalogue(['B01'])))
    await poser('X00.html', fiche)

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
      expect.stringContaining('le bloc X00 n’est pas dans le catalogue de test'),
    ])
  })

  it('refuse une fiche de plus de 5 Mo, et accepte une fiche juste en dessous', async () => {
    const place = Buffer.byteLength(fiche, 'utf8')
    const rembourrer = (octets: number) =>
      fiche.replace(
        '<div id="contenu"></div>',
        `<div id="contenu"></div><!--${'x'.repeat(octets - 7)}-->`,
      )
    await poser('X00.html', rembourrer(TAILLE_MAX_FICHE - place + 1))

    const problemes = await verifierLesFiches({ dossierContenu: contenu })

    expect(problemes).toEqual([expect.stringContaining('plus que les 5 Mo autorisés')])
    expect(problemes[0]).toContain('pèse 5.0 Mo')

    await poser('X00.html', rembourrer(TAILLE_MAX_FICHE - place))
    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
  })

  describe('ce que la page doit contenir', () => {
    it('refuse une étape à lire sans son template, même si un commentaire le cite', async () => {
      const sans = sansTemplate(fiche, 'data-etape', 'ET2').replace(
        '<div id="contenu"></div>',
        '<div id="contenu"></div><!-- <template data-etape="ET2"></template> -->',
      )
      await poser('X00.html', sans)

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('l’étape ET2 (explication) n’a pas de <template data-etape="ET2">'),
      ])
    })

    it('refuse un item de pratique sans son énoncé', async () => {
      await poser('X00.html', sansTemplate(fiche, 'data-item', 'PR1-2'))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('l’item PR1-2 n’a pas de <template data-item="PR1-2">'),
      ])
    })

    it('refuse chaque adresse externe chargée ou liée, et accepte data: et data-lien', async () => {
      await poser(
        'X00.html',
        fiche.replace(
          "<p>À REMPLACER : l'explication du bloc.</p>",
          [
            '<img src="data:image/png;base64,AAAA" alt="">',
            '<img src="https://exemple.test/schema.png" alt="">',
            '<a href="//exemple.test/page">lien</a>',
            '<style>.fond { background: url( "http://exemple.test/fond.png" ) }</style>',
          ].join('\n'),
        ),
      )

      const problemes = await verifierLesFiches({ dossierContenu: contenu })

      expect(problemes).toEqual([
        expect.stringContaining('https://exemple.test/schema.png'),
        expect.stringContaining('//exemple.test/page'),
        expect.stringContaining('http://exemple.test/fond.png'),
      ])
      expect(problemes[0]).toContain('aucun accès réseau')
      expect(problemes[0]).toContain('data-lien')
    })

    it('ne compte pas les adresses du pont de l’appli', async () => {
      await poser(
        'X00.html',
        fiche.replace(
          'window.JanusPont = {}',
          'window.JanusPont = { exemple: "https://exemple.test" }; x.src = "https://exemple.test/x.js"',
        ),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    })
  })

  describe('le pont embarqué, comparé au pont construit', () => {
    it('accepte une fiche dont le pont est celui du dépôt, même indenté par un reformatage', async () => {
      await poser(
        'X00.html',
        fiche.replace(PONT, `\n      ${PONT.replace('\n', '\n      ')}\n    `),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu, pont: PONT })).toEqual([])
    })

    it('refuse un pont embarqué sans en-tête', async () => {
      await poser('X00.html', fiche.replace(PONT, 'window.JanusPont = {}'))

      expect(await verifierLesFiches({ dossierContenu: contenu, pont: PONT })).toEqual([
        expect.stringContaining('le pont embarqué n’a pas d’en-tête'),
      ])
    })

    it('refuse un pont embarqué qui n’est pas celui du dépôt', async () => {
      await poser('X00.html', fiche.replace(EMPREINTE, 'b'.repeat(64)))

      expect(await verifierLesFiches({ dossierContenu: contenu, pont: PONT })).toEqual([
        expect.stringContaining(
          'le pont embarqué (bbbbbbbb…) n’est pas celui du dépôt (aaaaaaaa…)',
        ),
      ])
    })

    it('refuse un manifeste dont le champ pont ne dit pas la version du pont embarqué', async () => {
      await poser(
        'X00.html',
        avecManifeste(fiche, (manifeste) => {
          manifeste.pont = 2
        }),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu, pont: PONT })).toEqual([
        expect.stringContaining(
          'le manifeste déclare pont 2 mais le pont embarqué est en version 1',
        ),
      ])
    })

    it('refuse de comparer à un pont construit sans en-tête', async () => {
      await poser('X00.html', fiche)

      await expect(
        verifierLesFiches({ dossierContenu: contenu, pont: 'window.JanusPont = {}' }),
      ).rejects.toThrow(/en-tête/)
    })
  })

  describe('les blocs fixes, comparés au gabarit de la formation', () => {
    beforeEach(async () => {
      await mkdir(join(contenu, 'test', 'gabarit'), { recursive: true })
      await writeFile(
        join(contenu, 'test', 'gabarit', 'fiche.html'),
        await readFile(GABARIT, 'utf8'),
      )
    })

    it('accepte une fiche qui reprend les blocs fixes et remplit ses blocs libres', async () => {
      await poser(
        'X00.html',
        fiche
          .replace(
            '<style id="styles-bloc"></style>',
            '<style id="styles-bloc">.bloc { color: red }</style>',
          )
          .replace(
            '<script id="outils-bloc"></script>',
            '<script id="outils-bloc">console.log(1)</script>',
          ),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    })

    it('refuse un bloc fixe modifié, et un bloc fixe disparu', async () => {
      await poser(
        'X00.html',
        fiche
          .replace('<style id="styles-gabarit">', '<style id="styles-gabarit">.x { color: red }')
          .replace('<script id="plomberie">', '<script>'),
      )

      const problemes = await verifierLesFiches({ dossierContenu: contenu })

      expect(problemes).toEqual([
        expect.stringContaining('le bloc fixe id="styles-gabarit" n’est pas celui du gabarit'),
        expect.stringContaining('le bloc fixe id="plomberie" du gabarit manque'),
      ])
      expect(problemes[0]).toContain('styles-bloc')
    })

    it('ne compare rien quand la formation n’a pas de gabarit', async () => {
      await rm(join(contenu, 'test', 'gabarit'), { recursive: true })
      await poser('X00.html', fiche.replace('<script id="plomberie">', '<script>'))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    })
  })

  describe('contre la révision de référence', () => {
    it('refuse un contenu changé sans que la version change', async () => {
      await poser('X00.html', fiche.replace('À REMPLACER : titre du bloc', 'Titre du bloc'))

      const problemes = await verifierLesFiches({
        dossierContenu: contenu,
        contenuDeReference: () => fiche,
      })

      expect(problemes).toEqual([expect.stringContaining('incrémente-la')])
    })

    it('accepte un contenu changé avec une version plus haute', async () => {
      await poser('X00.html', fiche.replace('"version": 1', '"version": 2'))

      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])
    })

    it('accepte une fiche inchangée, et une fiche nouvelle', async () => {
      await poser('X00.html', fiche)

      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => undefined }),
      ).toEqual([])
    })

    it('refuse une question ou une différée dont le texte change sous le même identifiant', async () => {
      await poser(
        'X00.html',
        avecManifeste(fiche, (manifeste) => {
          manifeste.version = 2
          const [r1] = manifeste.restitution
          const [, q2] = manifeste.rappel
          const [de1] = manifeste.differees
          if (r1 === undefined || q2 === undefined || de1 === undefined) throw new Error('gabarit')
          r1.question = 'Une tout autre question ?'
          q2.attendu = 'Une tout autre réponse attendue.'
          de1.consigne = 'Une tout autre consigne.'
        }),
      )

      const problemes = await verifierLesFiches({
        dossierContenu: contenu,
        contenuDeReference: () => fiche,
      })

      expect(problemes).toEqual([
        expect.stringContaining('la question R1 (restitution) a changé'),
        expect.stringContaining('la question Q2 (rappel) a changé'),
        expect.stringContaining('la question DE1 (differees) a changé'),
      ])
      expect(problemes[0]).toContain('nouvel identifiant')
    })

    it('accepte une question ajoutée, et un texte qui ne change que d’espaces ou de casse', async () => {
      await poser(
        'X00.html',
        avecManifeste(fiche, (manifeste) => {
          manifeste.version = 2
          const [premiere] = manifeste.restitution
          const [q1] = manifeste.rappel
          if (premiere === undefined || q1 === undefined) throw new Error('gabarit')
          premiere.question = `  ${premiere.question.toUpperCase()}  `
          manifeste.rappel.push({ ...q1, id: 'Q7' })
        }),
      )

      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])
    })
  })
})
