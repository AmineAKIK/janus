import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const eslint = new ESLint({ cwd: RACINE, overrideConfigFile: `${RACINE}eslint.config.js` })

/** Les frontières violées par ce code, s'il était écrit dans ce fichier. */
async function frontieres(fichier: string, code: string): Promise<string[]> {
  const [resultat] = await eslint.lintText(code, { filePath: `${RACINE}${fichier}` })
  return (resultat?.messages ?? [])
    .filter(({ ruleId }) => ruleId?.startsWith('boundaries/') === true)
    .map(({ message }) => message)
}

const SUIVI = 'apps/api/src/domaines/suivi'

// Les règles de couches vivent dans `eslint.config.js` : ce test prouve qu'elles s'appliquent encore
// (une migration du plugin les a déjà désactivées sans rien dire).
// ESLint charge tout le typage du dépôt : la première analyse est lente.
const DELAI_MS = 180_000

describe('frontières entre les couches', () => {
  it(
    'refuse ce qui n’est pas permis',
    async () => {
      const refus: [string, string, string][] = [
        ['une policy lit le dépôt', `${SUIVI}/policy.ts`, "import './depot.ts'"],
        ['un dépôt importe le moteur', `${SUIVI}/depot.ts`, "import '@janus/moteur'"],
        ['une route saute le contrôleur', `${SUIVI}/routes.ts`, "import './service.ts'"],
        ['un contrôleur lit le dépôt', `${SUIVI}/controleur.ts`, "import './depot.ts'"],
        [
          'un service importe un autre domaine',
          `${SUIVI}/service.ts`,
          "import '../auth/service.ts'",
        ],
        [
          'l’API importe le contenu d’un domaine',
          'apps/api/src/serveur.ts',
          "import './domaines/suivi/service.ts'",
        ],
        ['l’appli web importe l’API', 'apps/web/src/main.tsx', "import '../../api/src/serveur.ts'"],
        [
          'un paquet importe l’appli',
          'packages/ui/src/index.ts',
          "import '../../../apps/web/src/main.tsx'",
        ],
      ]
      for (const [cas, fichier, code] of refus) {
        expect(await frontieres(fichier, code), cas).not.toEqual([])
      }
    },
    DELAI_MS,
  )

  it(
    'laisse passer ce qui est permis',
    async () => {
      const permis: [string, string, string][] = [
        [
          'un service lit le dépôt et la policy',
          `${SUIVI}/service.ts`,
          "import './depot.ts'\nimport './policy.ts'",
        ],
        ['un service importe le moteur', `${SUIVI}/service.ts`, "import '@janus/moteur'"],
        ['une route importe son contrôleur', `${SUIVI}/routes.ts`, "import './controleur.ts'"],
        ['une composition branche les couches', `${SUIVI}/composition.ts`, "import './service.ts'"],
        [
          'l’API importe une composition',
          'apps/api/src/serveur.ts',
          "import './domaines/suivi/composition.ts'",
        ],
        ['l’appli web importe un paquet', 'apps/web/src/main.tsx', "import '@janus/contrats'"],
      ]
      for (const [cas, fichier, code] of permis) {
        expect(await frontieres(fichier, code), cas).toEqual([])
      }
    },
    DELAI_MS,
  )
})
