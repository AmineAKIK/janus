import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { lireLesFiches, verifierLesFiches } from './fiches.ts'

const FICHE_DEMO = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/public/fiches/demo/fiche-demo.html',
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

describe('vérification des fiches du dépôt', () => {
  let contenu: string
  let demo: string
  beforeEach(async () => {
    contenu = await mkdtemp(join(tmpdir(), 'janus-fiches-'))
    // Comme une fiche assemblée : la bibliothèque du pont est écrite dans la page.
    demo = (await readFile(FICHE_DEMO, 'utf8')).replace(
      '<script id="pont"></script>',
      '<script id="pont">window.JanusPont = {}</script>',
    )
    await mkdir(join(contenu, 'test', 'fiches'), { recursive: true })
    await writeFile(join(contenu, 'test', 'catalogue.json'), JSON.stringify(catalogue(['D01'])))
  })
  afterEach(async () => {
    await rm(contenu, { recursive: true, force: true })
  })

  const poser = (nom: string, html: string) => writeFile(join(contenu, 'test', 'fiches', nom), html)

  it('accepte une fiche valide, nommée d’après son bloc et présente au catalogue', async () => {
    await poser('D01.html', demo)

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
  })

  it('refuse une fiche dont le pont n’est pas écrit dans la page', async () => {
    await poser(
      'D01.html',
      demo.replace(
        '<script id="pont">window.JanusPont = {}</script>',
        '<script id="pont"></script>',
      ),
    )

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
      expect.stringContaining('test/fiches/D01.html : le pont de l’appli n’est pas dans la fiche'),
    ])
  })

  it('ne dit rien d’une formation sans fiche', async () => {
    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([])
    expect(await lireLesFiches(contenu, 'test')).toEqual([])
    expect(await lireLesFiches(contenu, 'absente')).toEqual([])
  })

  it('refuse une fiche sans manifeste', async () => {
    await poser('D01.html', '<html><body><script id="pont">x</script></body></html>')

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
      expect.stringContaining('test/fiches/D01.html : aucun manifeste'),
    ])
  })

  it('refuse un manifeste qui ne passe pas le validateur, avec le chemin du champ', async () => {
    await poser('D01.html', demo.replace('"rappel"', '"rappel_perdu"'))

    const problemes = await verifierLesFiches({ dossierContenu: contenu })

    expect(problemes.length).toBeGreaterThan(0)
    expect(problemes.every((probleme) => probleme.startsWith('test/fiches/D01.html : '))).toBe(true)
  })

  it('refuse un fichier qui ne porte pas le nom de son bloc', async () => {
    await poser('autre.html', demo)

    expect(await verifierLesFiches({ dossierContenu: contenu })).toContainEqual(
      expect.stringContaining('le fichier doit s’appeler D01.html'),
    )
  })

  it('refuse un bloc absent du catalogue', async () => {
    await writeFile(join(contenu, 'test', 'catalogue.json'), JSON.stringify(catalogue(['B01'])))
    await poser('D01.html', demo)

    expect(await verifierLesFiches({ dossierContenu: contenu })).toEqual([
      expect.stringContaining('le bloc D01 n’est pas dans le catalogue de test'),
    ])
  })

  describe('contre la révision de référence', () => {
    it('refuse un contenu changé sans que la version change', async () => {
      await poser('D01.html', demo.replace('Bloc de démonstration', 'Bloc modifié'))

      const problemes = await verifierLesFiches({
        dossierContenu: contenu,
        contenuDeReference: () => demo,
      })

      expect(problemes).toEqual([expect.stringContaining('incrémente-la')])
    })

    it('accepte un contenu changé avec une version plus haute', async () => {
      await poser('D01.html', demo.replace('"version": 1', '"version": 2'))

      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => demo }),
      ).toEqual([])
    })

    it('accepte une fiche inchangée, et une fiche nouvelle', async () => {
      await poser('D01.html', demo)

      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => demo }),
      ).toEqual([])
      expect(
        await verifierLesFiches({ dossierContenu: contenu, contenuDeReference: () => undefined }),
      ).toEqual([])
    })
  })
})
