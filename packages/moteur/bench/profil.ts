import { readFileSync } from 'node:fs'
import { argv } from 'node:process'

// Usage : node bench/profil.ts <fichier .cpuprofile> [lignes]
// Temps propre (self) cumulé par fonction, d'après un profil produit avec `node --cpu-prof`.

interface Noeud {
  readonly id: number
  readonly callFrame: {
    readonly functionName: string
    readonly url: string
    readonly lineNumber: number
  }
}
interface Profil {
  readonly nodes: readonly Noeud[]
  readonly samples: readonly number[]
  readonly timeDeltas: readonly number[]
}

const [fichier = '', lignesTexte = '25'] = argv.slice(2)
const lu: unknown = JSON.parse(readFileSync(fichier, 'utf8'))
function estProfil(valeur: unknown): valeur is Profil {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    'nodes' in valeur &&
    'samples' in valeur &&
    'timeDeltas' in valeur
  )
}
if (!estProfil(lu)) throw new Error(`Pas un profil .cpuprofile : ${fichier}`)
const profil = lu
const noeuds = new Map(profil.nodes.map((noeud) => [noeud.id, noeud]))
const parFonction = new Map<string, number>()
let total = 0
profil.samples.forEach((id, i) => {
  const dt = profil.timeDeltas[i] ?? 0
  const trame = noeuds.get(id)?.callFrame
  if (trame === undefined) return
  const fichierCourt = trame.url.split('/').slice(-2).join('/')
  const cle = `${trame.functionName === '' ? '(anonyme)' : trame.functionName} ${fichierCourt}:${String(trame.lineNumber + 1)}`
  parFonction.set(cle, (parFonction.get(cle) ?? 0) + dt)
  total += dt
})
const trie = [...parFonction].sort((a, b) => b[1] - a[1]).slice(0, Number(lignesTexte))
for (const [cle, us] of trie) {
  console.log(
    `${((us / total) * 100).toFixed(1).padStart(5)} %  ${(us / 1000).toFixed(0).padStart(8)} ms  ${cle}`,
  )
}
