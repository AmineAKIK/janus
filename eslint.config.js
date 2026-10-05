import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

const paquets = ['contrats', 'moteur', 'pont', 'ui']

// Qui peut importer quoi : les applis importent les paquets, jamais l'inverse.
// `moteur` et `contrats` ne dépendent d'aucun autre paquet du dépôt, sauf `moteur` vers `contrats`.
// `ui` et `pont` n'importent que `contrats`.
const autorises = {
  'app-web': ['contrats', 'moteur', 'pont', 'ui'],
  'app-api': ['contrats', 'moteur'],
  contrats: [],
  moteur: ['contrats'],
  pont: ['contrats'],
  ui: ['contrats'],
}

export default defineConfig(
  { ignores: ['**/dist/**', '**/coverage/**', '**/captures/**', '**/node_modules/**'] },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/elements': [
        { type: 'app-web', pattern: 'apps/web' },
        { type: 'app-api', pattern: 'apps/api' },
        ...paquets.map((nom) => ({ type: nom, pattern: `packages/${nom}` })),
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: Object.entries(autorises).map(([depuis, vers]) => ({
            from: { element: { type: depuis } },
            allow: {
              to: { element: { types: { anyOf: [depuis, ...vers] } } },
            },
          })),
        },
      ],
    },
  },
)
