import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const DOMAINES = 'apps/api/src/domaines'

/**
 * Lint d'un fichier exemple : `code` est lu comme s'il était dans `chemin`, qui peut ne pas exister.
 * Sans typage : seules les règles de couches nous intéressent.
 */
async function regles(chemin: string, code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: RACINE, overrideConfig: tseslint.configs.disableTypeChecked })
  const [resultat] = await eslint.lintText(code, { filePath: `${RACINE}${chemin}` })
  return (resultat?.messages ?? []).flatMap(({ ruleId }) => (ruleId === null ? [] : [ruleId]))
}

describe('les couches de l’API (eslint-plugin-boundaries)', () => {
  it('un contrôleur qui importe un dépôt fait échouer le lint', async () => {
    const code = `import { creerDepotSante } from './depot.ts'\nexport const depot = creerDepotSante\n`

    expect(await regles(`${DOMAINES}/sante/controleur.ts`, code)).toContain(
      'boundaries/dependencies',
    )
  })

  it('un contrôleur qui importe un service reste permis', async () => {
    const code = `import { creerServiceSante } from './service.ts'\nexport const service = creerServiceSante\n`

    expect(await regles(`${DOMAINES}/sante/controleur.ts`, code)).not.toContain(
      'boundaries/dependencies',
    )
  })

  it('une route ne saute pas le contrôleur pour le service', async () => {
    const code = `import { creerServiceSante } from './service.ts'\nexport const service = creerServiceSante\n`

    expect(await regles(`${DOMAINES}/sante/routes.ts`, code)).toContain('boundaries/dependencies')
  })

  it('un service peut importer un dépôt, mais pas remonter au contrôleur', async () => {
    const bas = `import { creerDepotSante } from './depot.ts'\nexport const depot = creerDepotSante\n`
    const haut = `import { creerControleurSante } from './controleur.ts'\nexport const c = creerControleurSante\n`

    expect(await regles(`${DOMAINES}/sante/service.ts`, bas)).not.toContain(
      'boundaries/dependencies',
    )
    expect(await regles(`${DOMAINES}/sante/service.ts`, haut)).toContain('boundaries/dependencies')
  })

  it('un domaine n’importe pas l’intérieur d’un autre', async () => {
    const code = `import { creerDepotSante } from '../sante/depot.ts'\nexport const depot = creerDepotSante\n`

    expect(await regles(`${DOMAINES}/suivi/service.ts`, code)).toContain('boundaries/dependencies')
  })

  it('un dépôt n’importe pas le moteur : les règles restent dans le moteur, via le service', async () => {
    const code = `import { lundiDe } from '@janus/moteur'\nexport const f = lundiDe\n`

    expect(await regles(`${DOMAINES}/sante/depot.ts`, code)).toContain('boundaries/dependencies')
    expect(await regles(`${DOMAINES}/sante/service.ts`, code)).not.toContain(
      'boundaries/dependencies',
    )
  })

  it('db.transaction est interdit hors de base/transaction.ts', async () => {
    const code = `export const f = (db: { transaction: (fn: () => void) => void }) => db.transaction(() => undefined)\n`

    expect(await regles(`${DOMAINES}/sante/depot.ts`, code)).toContain('no-restricted-syntax')
    expect(await regles('apps/api/src/base/transaction.ts', code)).not.toContain(
      'no-restricted-syntax',
    )
  })
})
