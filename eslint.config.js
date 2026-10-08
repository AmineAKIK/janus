import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

const paquets = ['contrats', 'moteur', 'pont', 'ui']

// Qui peut importer quoi : les applis importent les paquets, jamais l'inverse.
// `moteur` et `contrats` ne dépendent d'aucun autre paquet du dépôt, sauf `moteur` vers `contrats`.
// `ui` et `pont` n'importent que `contrats`.
// Les couches de l'API : route → contrôleur → service → (policy, dépôt, moteur, adaptateurs).
// Un fichier par couche dans `apps/api/src/domaines/<domaine>/` ; un domaine n'importe pas l'intérieur d'un autre.
const couchesApi = ['route', 'controleur', 'service', 'policy', 'depot', 'adaptateur']
// `composition.ts` branche les couches d'un domaine entre elles : c'est le seul fichier qui les voit toutes.
const fichierDeCouche = {
  route: 'routes',
  controleur: 'controleur',
  service: 'service',
  policy: 'policy',
  depot: 'depot',
  adaptateur: 'adaptateur',
}
const couchesAutorisees = {
  route: ['controleur'],
  controleur: ['service'],
  service: ['policy', 'depot', 'adaptateur'],
  policy: [],
  depot: [],
  adaptateur: [],
}
// Le moteur n'est ouvert qu'au service et à la policy : les règles métier restent dans `packages/moteur`.
const paquetsDesCouches = { service: ['moteur'], policy: ['moteur'] }

const autorises = {
  'app-web': ['contrats', 'moteur', 'pont', 'ui'],
  'app-api': ['contrats', 'moteur', 'composition'],
  contrats: [],
  moteur: ['contrats'],
  pont: ['contrats'],
  ui: ['contrats'],
}

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/dist-api/**',
      '**/dist-vps/**',
      '**/coverage/**',
      '**/captures/**',
      '**/node_modules/**',
    ],
  },
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
      'boundaries/root-path': import.meta.dirname,
      'boundaries/ignore': ['**/*.test.ts'],
      'boundaries/elements': [
        { type: 'app-web', pattern: 'apps/web' },
        // Les couches d'abord : `app-api` (le reste de l'API : plugins, base, erreurs) vient après.
        ...couchesApi.map((type) => ({
          type,
          pattern: `apps/api/src/domaines/*/${fichierDeCouche[type]}.ts`,
          mode: 'file',
          capture: ['domaine'],
        })),
        {
          type: 'composition',
          pattern: 'apps/api/src/domaines/*/composition.ts',
          mode: 'file',
          capture: ['domaine'],
        },
        { type: 'app-api', pattern: 'apps/api' },
        ...paquets.map((nom) => ({ type: nom, pattern: `packages/${nom}` })),
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            ...Object.entries(autorises).map(([depuis, vers]) => ({
              from: { element: { type: depuis } },
              allow: {
                to: { element: { types: { anyOf: [depuis, ...vers] } } },
              },
            })),
            {
              from: { element: { type: 'composition' } },
              allow: [
                {
                  to: {
                    element: {
                      types: { anyOf: couchesApi },
                      captured: { domaine: '{{ from.captured.domaine }}' },
                    },
                  },
                },
                { to: { element: { types: { anyOf: ['app-api', 'contrats'] } } } },
              ],
            },
            ...couchesApi.map((depuis) => ({
              from: { element: { type: depuis } },
              allow: [
                // Dans le même domaine : seulement la couche du dessous.
                {
                  to: {
                    element: {
                      types: { anyOf: couchesAutorisees[depuis] },
                      captured: { domaine: '{{ from.captured.domaine }}' },
                    },
                  },
                },
                // Hors des domaines : le reste de l'API (erreurs, base, types) et les paquets.
                {
                  to: {
                    element: {
                      types: {
                        anyOf: ['app-api', 'contrats', ...(paquetsDesCouches[depuis] ?? [])],
                      },
                    },
                  },
                },
              ],
            })),
          ],
        },
      ],
    },
  }, // Aucun composant n'appelle `fetch` : tout passe par le `Transport`, dont `transportHttp.ts` est le seul HTTP.
  {
    files: ['**/*.{js,ts,tsx}'],
    // Côté API, seul le client DeepSeek sort sur le réseau.
    ignores: [
      'apps/web/src/api/transportHttp.ts',
      // Le banc de la CI parle à l'API réelle avec un cookie de session, hors navigateur.
      'apps/web/src/api/contratHttp.test.ts',
      'apps/api/src/adaptateurs/correcteur/deepseek.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Passe par le Transport (apps/web/src/api), jamais par fetch.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'fetch',
          message: 'Passe par le Transport (apps/web/src/api), jamais par fetch.',
        },
        {
          object: 'globalThis',
          property: 'fetch',
          message: 'Passe par le Transport (apps/web/src/api), jamais par fetch.',
        },
      ],
    },
  },
  // Une transaction ne s'ouvre qu'à un endroit : `base/transaction.ts` (rejeu, niveau d'isolation).
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/base/transaction.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='transaction']",
          message:
            'Ouvre une transaction avec transaction() de base/transaction.ts, jamais avec db.transaction.',
        },
      ],
    },
  },
  // Les fiches s'ouvrent dans un bac à sable qui ne laisse que les scripts (jamais `allow-same-origin`).
  {
    files: ['apps/web/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='sandbox'][value.value!='allow-scripts']",
          message: 'Le sandbox d’une iframe vaut exactement « allow-scripts ».',
        },
      ],
    },
  },
)
