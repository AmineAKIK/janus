import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// La vraie configuration du dépôt : la règle qui interdit `fetch` hors de `transportHttp.ts`.
const eslint = new ESLint()

async function erreurs(code: string, fichier: string) {
  const [resultat] = await eslint.lintText(code, { filePath: fichier })
  return (resultat?.messages ?? []).filter((message) => message.severity === 2)
}

describe('interdiction de fetch', () => {
  it.each([
    ["fetch('/api/moi')", 'composant.js'],
    ["window.fetch('/api/moi')", 'composant.js'],
    ["globalThis.fetch('/api/moi')", 'composant.js'],
  ])('refuse %s dans un composant', async (code, nom) => {
    const resultat = await erreurs(code, `src/${nom}`)

    expect(resultat).toHaveLength(1)
    expect(resultat[0]?.message).toContain('Transport')
  })

  it('autorise fetch dans transportHttp.ts', async () => {
    const resultat = await erreurs("void fetch('/api/moi')", 'src/api/transportHttp.ts')

    expect(resultat).toEqual([])
  })
})
