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
const PONT = `/*! janus-pont v2 ${EMPREINTE} */\nwindow.JanusPont = {}`

type Manifeste = {
  version: number
  pont: number
  contexte_ia: string
  sources: { id: string; titre: string }[]
  erreurs_critiques: { id: string; libelle: string; etape: string }[]
  restitution: { id: string; question: string; attendu: string }[]
  rappel: { id: string; question: string; attendu: string; erreurs: string[] }[]
  differees: { id: string; consigne: string; attendu: string }[]
}

type Alignement = { notions: { id: string; questions: string[] }[] }

/** La fiche avec son manifeste modifié (le texte JSON est remplacé dans la page). */
function avecManifeste(html: string, modifier: (manifeste: Manifeste) => void): string {
  const texte = extraireManifeste(html) ?? ''
  const manifeste = JSON.parse(texte) as Manifeste
  modifier(manifeste)
  return html.replace(texte, () => JSON.stringify(manifeste, null, 2))
}

const TABLEAU = /(<script id="alignement" type="application\/json">)([\s\S]*?)(<\/script>)/

/** La fiche avec son tableau d'alignement modifié. */
function avecAlignement(html: string, modifier: (alignement: Alignement) => void): string {
  const texte = TABLEAU.exec(html)?.[2]
  if (texte === undefined) throw new Error('Le gabarit n’a pas de tableau d’alignement.')
  const alignement = JSON.parse(texte) as Alignement
  modifier(alignement)
  return html.replace(texte, () => JSON.stringify(alignement, null, 2))
}

/** Les questions d'une notion du tableau, modifiables en place. */
function questionsDe(alignement: Alignement, id: string): string[] {
  const notion = alignement.notions.find((n) => n.id === id)
  if (notion === undefined) throw new Error(`Pas de notion ${id} dans le gabarit.`)
  return notion.questions
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
        expect.stringContaining('l’erreur critique E2 n’a aucun item de pratique qui la révèle'),
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

  describe('les leçons du B01 : explications, erreurs critiques, restitution', () => {
    it('refuse plus d’un tiers d’items qui demandent une explication', async () => {
      await poser(
        'X00.html',
        fiche
          .replace(
            '<p data-erreur="E1">',
            '<p data-erreur="E1" data-justifier="Explique." data-fiche="Parce que.">',
          )
          .replace(
            '<p data-erreur="E2">',
            '<p data-erreur="E2" data-justifier="Explique." data-fiche="Parce que.">',
          ),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'pratique : 2 items sur 3 demandent une explication (data-justifier : PR1-1, PR1-2), au plus un tiers (1)',
        ),
      ])
    })

    it('accepte un tiers d’items avec explication, arrondi au-dessus', async () => {
      await poser(
        'X00.html',
        fiche.replace(
          '<p data-erreur="E1">',
          '<p data-erreur="E1" data-justifier="Explique." data-fiche="Parce que.">',
        ),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    })

    it('refuse une explication sans texte à comparer, accepte data-solution', async () => {
      await poser(
        'X00.html',
        fiche.replace('<p data-erreur="E1">', '<p data-erreur="E1" data-justifier="Pourquoi ?">'),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'pratique : l’item PR1-1 demande une explication (data-justifier) sans texte à comparer (data-fiche)',
        ),
      ])

      await poser(
        'X00.html',
        fiche.replace(
          '<p data-erreur="E1">',
          '<p data-erreur="E1" data-justifier="Pourquoi ?" data-solution="Parce que.">',
        ),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    })

    it('refuse une erreur critique qu’aucun item de pratique ne révèle', async () => {
      await poser('X00.html', fiche.replace('<p data-erreur="E2">', '<p>'))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'l’erreur critique E2 n’a aucun item de pratique qui la révèle (data-erreur="E2"',
        ),
      ])
    })

    it('ne lit pas un data-erreur écrit dans un commentaire ou hors des items', async () => {
      await poser(
        'X00.html',
        fiche
          .replace('<p data-erreur="E2">', '<p>')
          .replace(
            '<div id="contenu"></div>',
            '<div id="contenu" data-erreur="E2"></div><!-- data-erreur="E2" -->',
          ),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('l’erreur critique E2 n’a aucun item'),
      ])
    })

    it('refuse une erreur critique rattachée à une étape qui n’explique pas', async () => {
      await poser(
        'X00.html',
        avecManifeste(fiche, (m) => {
          m.erreurs_critiques = m.erreurs_critiques.map((e, i) =>
            i === 0 ? { ...e, etape: 'ET3' } : e,
          )
        }),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('l’erreur critique E1 est rattachée à ET3 (pratique)'),
      ])
    })

    it('refuse une question de restitution qui demande plus de deux choses', async () => {
      await poser(
        'X00.html',
        avecManifeste(fiche, (m) => {
          const questions = [
            'Écris 128 en binaire. Puis donne la valeur de 01010101. Pourquoi 255 s’écrit-il avec huit 1 ?',
            'Voici un octet, 10010110, lu par le Bloc-notes. Quel caractère affiche-t-il ? Explique avec quel codage.',
          ]
          m.restitution = m.restitution.map((q, i) => ({
            ...q,
            question: questions[i] ?? q.question,
          }))
        }),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'restitution R1 : la question demande 3 choses ; une question de restitution, une tâche, deux sous-questions au plus',
        ),
      ])
    })
  })

  describe('ce que la fiche enseigne et ce qu’elle interroge', () => {
    it('refuse une fiche sans tableau d’alignement', async () => {
      await poser('X00.html', fiche.replace(TABLEAU, ''))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('test/fiches/X00.html : pas de tableau d’alignement'),
      ])
    })

    it('refuse un tableau qui n’est pas du JSON', async () => {
      await poser('X00.html', fiche.replace(TABLEAU, '$1{ "bloc": "X00", }$3'))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('le tableau d’alignement n’est pas du JSON valide'),
      ])
    })

    it('refuse une question que le tableau ne rattache à aucune notion, avec le champ en cause', async () => {
      await poser(
        'X00.html',
        avecAlignement(fiche, (alignement) => {
          const questions = questionsDe(alignement, 'N2')
          questions.splice(questions.indexOf('R5'), 1)
          questionsDe(alignement, 'N1').push('R9')
        }),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        'test/fiches/X00.html : alignement.notions[0].questions : R9 n’est ni une question ni une carte du manifeste.',
        expect.stringContaining(
          'test/fiches/X00.html : alignement : R5 (restitution) n’est rattachée à aucune notion',
        ),
      ])
    })
  })

  describe('une fiche qui se suffit à elle-même', () => {
    it('refuse tout renvoi à un cours, dans la page comme dans le manifeste', async () => {
      await poser(
        'X00.html',
        avecManifeste(
          fiche.replace(
            "<p>À REMPLACER : l'explication du bloc.</p>",
            '<details><summary>Ce que Studi écrit</summary><p>Relis les pages 3 à 5.</p></details>',
          ),
          (manifeste) => {
            manifeste.contexte_ia =
              'Erreur de la Solution n°2 à ne pas répéter ; on y revient en P1.4.'
            manifeste.sources = [{ id: 'S1', titre: 'Jeux de logique, p. 3' }]
          },
        ),
      )

      const problemes = await verifierLesFiches({ dossierContenu: contenu })

      expect(problemes).toEqual([
        expect.stringContaining('« Studi » dans le texte affiché'),
        expect.stringContaining('« pages 3 » dans le texte affiché'),
        expect.stringContaining('« Solution n°2 » dans contexte_ia'),
        expect.stringContaining('« P1.4 » dans contexte_ia'),
        expect.stringContaining('« p. 3 » dans sources[0].titre'),
      ])
      expect(problemes[0]).toContain('se suffit à elle-même')
    })

    it('ne prend pas les mots du métier pour un renvoi', async () => {
      await poser(
        'X00.html',
        fiche.replace(
          "<p>À REMPLACER : l'explication du bloc.</p>",
          '<p>Une page 404, un fichier PDF, HTTP/1.1, la page 3 de ton carnet : rien de tout ça ne renvoie à un cours.</p>',
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
          manifeste.pont = 3
        }),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu, pont: PONT })).toEqual([
        expect.stringContaining(
          'le manifeste déclare pont 3 mais le pont embarqué est en version 2',
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
        avecAlignement(
          avecManifeste(fiche, (manifeste) => {
            manifeste.version = 2
            const [premiere] = manifeste.restitution
            const [q1] = manifeste.rappel
            if (premiere === undefined || q1 === undefined) throw new Error('gabarit')
            premiere.question = `  ${premiere.question.toUpperCase()}  `
            manifeste.rappel.push({ ...q1, id: 'Q7' })
          }),
          (alignement) => questionsDe(alignement, 'N1').push('Q7'),
        ),
      )

      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])
    })
  })

  describe('la grille de la méthode', () => {
    /** Un petit jeu de règles, du même format que `methode/regles.json`, avec un statut de chaque sorte. */
    const REGLES = {
      version: 'test',
      statuts: { noyau: 'toujours', 'par défaut': 'sauf raison', réglage: 'à ajuster' },
      regles: [
        { id: 'C01', section: 'Boucle', statut: 'noyau', titre: 'Le cycle', texte: 'Le cycle.' },
        { id: 'C02', section: 'Boucle', statut: 'par défaut', titre: 'Percevoir', texte: 'Voir.' },
        { id: 'C11', section: 'Boucle', statut: 'par défaut', titre: 'À retenir', texte: 'Peu.' },
        { id: 'A01', section: 'Aisance', statut: 'réglage', titre: 'Aisance', texte: 'Vite.' },
      ],
    }
    const EN_TETE = '# Grille de la méthode : X00, version 1'
    /** Les lignes du tableau d'une grille complète ; dans `grille()`, la première est la ligne 7 du fichier. */
    const LIGNES = [
      '| C01 | appliquée | ET1 à ET6 : le cycle entier, pari repris en ET6 |',
      '| C02 | appliquée | ET2 : la démonstration, pari à la fin |',
      '| C11 | écartée | rien à mettre en répétition espacée dans ce bloc |',
      '| A01 | appliquée | PR1-2, et le manifeste fixe la réussite |',
    ]
    /** Une grille telle qu'on l'écrit : l'en-tête, un texte libre, le tableau. */
    const grille = (lignes: readonly string[], enTete = EN_TETE) =>
      [
        enTete,
        '',
        'Une phrase libre.',
        '',
        '| Règle | Statut | Où, ou pourquoi pas |',
        '| --- | --- | --- |',
        ...lignes,
        '',
      ].join('\n')
    /** La fiche du gabarit, modifiée (un titre change, sa version monte) : la grille est exigée quand il y a une référence. */
    let modifiee: string
    const poserGrille = (texte: string) =>
      writeFile(join(contenu, 'test', 'fiches', 'X00.grille.md'), texte)
    const poserRegles = async (regles: unknown) => {
      await mkdir(join(contenu, 'test', 'methode'), { recursive: true })
      await writeFile(join(contenu, 'test', 'methode', 'regles.json'), JSON.stringify(regles))
    }

    beforeEach(async () => {
      modifiee = fiche
        .replace('"version": 1', '"version": 2')
        .replace('À REMPLACER : titre du bloc', 'Titre du bloc')
      await poserRegles(REGLES)
    })

    it('refuse une fiche modifiée ou nouvelle sans grille, quand il y a une référence', async () => {
      await poser('X00.html', modifiee)

      const message = 'test/fiches/X00.html : pas de grille de la méthode (X00.grille.md)'
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([expect.stringContaining(message)])
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => undefined }),
      ).toEqual([expect.stringContaining(message)])
    })

    it('accepte une fiche inchangée sans grille, et ne réclame rien sans référence', async () => {
      await poser('X00.html', fiche)
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])

      await poser('X00.html', modifiee)
      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    })

    it('n’exige pas de grille d’une fiche seulement réassemblée : blocs fixes, pont, version', async () => {
      // Hier : une autre plomberie, un autre pont, version 1. Aujourd'hui : ceux du dépôt, version 2.
      const hier = fiche
        .replace('<script id="plomberie">', '<script id="plomberie">/* plomberie d’hier */')
        .replace(PONT, `/*! janus-pont v2 ${'b'.repeat(64)} */\nwindow.JanusPont = { hier: true }`)
      await poser('X00.html', fiche.replace('"version": 1', '"version": 2'))
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => hier }),
      ).toEqual([])

      await poser('X00.html', modifiee)
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => hier }),
      ).toEqual([expect.stringContaining('pas de grille de la méthode')])
    })

    it('ne contrôle rien quand la formation n’a pas de methode/regles.json', async () => {
      await rm(join(contenu, 'test', 'methode'), { recursive: true })
      await poser('X00.html', modifiee)
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])

      await poserGrille('n’importe quoi')
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])
    })

    it('signale une seule fois un regles.json illisible, et ne contrôle alors aucune grille', async () => {
      await poser('X00.html', modifiee)
      await poserGrille('n’importe quoi')

      await poserRegles({ ...REGLES, regles: [...REGLES.regles, { ...REGLES.regles[0] }] })
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([
        expect.stringContaining('test/methode/regles.json : le fichier ne se lit pas (regles : '),
      ])

      await writeFile(join(contenu, 'test', 'methode', 'regles.json'), '{ "version": ')
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([
        expect.stringContaining('test/methode/regles.json : le fichier n’est pas du JSON valide'),
      ])
    })

    it('accepte une grille complète, le statut écrit avec une autre casse ou des espaces', async () => {
      await poser('X00.html', modifiee)
      await poserGrille(
        grille(
          [
            '|C01|  Appliquée  |ET1 à ET6 : le cycle entier|',
            '| C02 | appliquée | ET2 : la démonstration, pari à la fin |',
            '| C11 | ÉCARTÉE | rien à mettre en répétition espacée dans ce bloc |',
            '| A01 | appliquée | PR1 : les trois items, et l’alignement |',
          ],
          '# Grille de la méthode : X00, version 2',
        ),
      )

      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => fiche }),
      ).toEqual([])
    })

    it('vérifie une grille présente même sans référence', async () => {
      await poser('X00.html', fiche)
      await poserGrille(grille(LIGNES.slice(0, 3)))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('test/fiches/X00.html : grille : il manque les règles A01'),
      ])
    })

    it('refuse un en-tête qui ne dit pas le bloc et la version du manifeste', async () => {
      await poser('X00.html', modifiee)
      const message =
        'grille : la première ligne doit être « # Grille de la méthode : X00, version 2 »'

      await poserGrille(grille(LIGNES, '# Grille de la méthode : X00, version 1'))
      const problemes = await verifierLesFiches({ dossierContenu: contenu })
      expect(problemes).toEqual([expect.stringContaining(message)])
      expect(problemes[0]).toContain('et non « # Grille de la méthode : X00, version 1 »')

      await poserGrille(grille(LIGNES, '# Grille de la méthode : B01, version 2'))
      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(message),
      ])

      await poserGrille('')
      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('et non rien.'),
        expect.stringContaining('il manque les règles C01, C02, C11, A01'),
      ])
    })

    it('refuse une grille où des règles manquent, en les listant toutes dans un message', async () => {
      await poser('X00.html', fiche)
      await poserGrille(grille([LIGNES[0] ?? '', LIGNES[2] ?? '']))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining('grille : il manque les règles C02, A01 : une ligne par règle'),
      ])
    })

    it('refuse une règle inconnue et une règle en double, avec les lignes', async () => {
      await poser('X00.html', fiche)
      await poserGrille(grille([...LIGNES, '| Z99 | appliquée | ET2 |', LIGNES[0] ?? '']))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'grille : ligne 11 : la règle « Z99 » n’est pas dans methode/regles.json',
        ),
        expect.stringContaining('grille : la règle C01 figure deux fois (lignes 7 et 12)'),
      ])
    })

    it('refuse un statut qui n’est ni « appliquée » ni « écartée »', async () => {
      await poser('X00.html', fiche)
      await poserGrille(grille([...LIGNES.slice(0, 3), '| A01 | appliqué | PR1-2 |']))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'grille : ligne 10 (A01) : le statut « appliqué » n’est ni « appliquée » ni « écartée »',
        ),
      ])
    })

    it('refuse d’écarter une règle du noyau, en la nommant', async () => {
      await poser('X00.html', fiche)
      await poserGrille(
        grille(['| C01 | écartée | pas de cycle dans ce bloc |', ...LIGNES.slice(1)]),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'grille : la règle C01 (Le cycle) est du noyau de la méthode : elle ne s’écarte pas',
        ),
      ])
    })

    it('refuse une troisième colonne vide, pour une règle écartée comme appliquée', async () => {
      await poser('X00.html', fiche)
      await poserGrille(
        grille([...LIGNES.slice(0, 2), '| C11 | écartée |  |', '| A01 | appliquée ||']),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'grille : ligne 9 (C11) : la troisième colonne est vide : dis pourquoi la règle est écartée',
        ),
        expect.stringContaining(
          'grille : ligne 10 (A01) : la troisième colonne est vide : dis où la règle est appliquée',
        ),
      ])
    })

    it('refuse une règle appliquée qui ne dit pas où, et une étape citée que le manifeste n’a pas', async () => {
      await poser('X00.html', fiche)
      await poserGrille(
        grille([
          '| C01 | appliquée | ET1 à ET7, PR1-1 et PR9-1 : le cycle entier |',
          '| C02 | appliquée | partout dans la fiche |',
          ...LIGNES.slice(2),
        ]),
      )

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'grille : ligne 7 (C01) cite ET7, qui n’est pas une étape du manifeste',
        ),
        expect.stringContaining(
          'grille : ligne 7 (C01) cite PR9-1, qui n’est ni un exercice ni un item de pratique du manifeste',
        ),
        expect.stringContaining(
          'grille : ligne 8 (C02, appliquée) : la colonne ne dit pas où : cite une étape (ET2), un item de pratique (PR1-2), le manifeste ou l’alignement',
        ),
      ])
    })

    it('refuse une ligne du tableau qui ne se lit pas, avec son numéro', async () => {
      await poser('X00.html', fiche)
      await poserGrille(grille([LIGNES[0] ?? '', '| C02 appliquée ET2 |', ...LIGNES.slice(2)]))

      expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
        expect.stringContaining(
          'grille : la ligne 8 du tableau ne se lit pas : attendu « | <règle> |',
        ),
        expect.stringContaining('grille : il manque les règles C02'),
      ])
    })
  })
})
