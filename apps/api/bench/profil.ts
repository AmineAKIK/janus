// Résume un profil CPU V8 (`node --cpu-prof`) : temps propre par fonction et par fichier.
//
//   node apps/api/bench/profil.ts chemin/vers/profil.cpuprofile [nombre de lignes]
import { readFileSync } from 'node:fs'
import { z } from 'zod'

const Noeud = z.object({
  id: z.number(),
  callFrame: z.object({ functionName: z.string(), url: z.string(), lineNumber: z.number() }),
  children: z.array(z.number()).optional(),
})
const Profil = z.object({
  nodes: z.array(Noeud),
  samples: z.array(z.number()),
  timeDeltas: z.array(z.number()),
})

const profil = Profil.parse(JSON.parse(readFileSync(process.argv[2] ?? '', 'utf8')))
const limite = Number(process.argv[3] ?? '25')
const parId = new Map(profil.nodes.map((n) => [n.id, n]))
const propre = new Map<number, number>()
profil.samples.forEach((id, i) => {
  propre.set(id, (propre.get(id) ?? 0) + (profil.timeDeltas[i] ?? 0))
})
const total = [...propre.values()].reduce((a, b) => a + b, 0)
const parFonction = new Map<string, number>()
const parFichier = new Map<string, number>()
for (const [id, us] of propre) {
  const n = parId.get(id)
  if (n === undefined) continue
  const fichier = n.callFrame.url
    .replace(/^.*node_modules\/\.pnpm\//, '')
    .replace(/^file:\/\/.*\/janus\/\.claude\/worktrees\/[^/]+\//, '')
  const cle = `${n.callFrame.functionName || '(anonyme)'} ${fichier}:${String(n.callFrame.lineNumber)}`
  parFonction.set(cle, (parFonction.get(cle) ?? 0) + us)
  parFichier.set(fichier, (parFichier.get(fichier) ?? 0) + us)
}
const afficher = (titre: string, m: Map<string, number>) => {
  process.stdout.write(`\n${titre} (total ${(total / 1000).toFixed(0)} ms)\n`)
  for (const [cle, us] of [...m].sort((a, b) => b[1] - a[1]).slice(0, limite)) {
    process.stdout.write(
      `${((us / total) * 100).toFixed(1).padStart(5)} %  ${(us / 1000).toFixed(0).padStart(7)} ms  ${cle.slice(0, 150)}\n`,
    )
  }
}
// Temps inclus (la fonction et tout ce qu'elle appelle) des fonctions dont le nom est donné en 4e argument.
const noms = (process.argv[4] ?? '').split(',').filter((nom) => nom !== '')
if (noms.length > 0) {
  const inclus = new Map<string, number>()
  const parcourir = (id: number, pile: ReadonlySet<string>): number => {
    const n = parId.get(id)
    if (n === undefined) return 0
    const nom = n.callFrame.functionName
    const dedans = pile.has(nom)
    const pileSuivante = dedans ? pile : new Set([...pile, nom])
    let somme = propre.get(id) ?? 0
    for (const enfant of n.children ?? []) somme += parcourir(enfant, pileSuivante)
    if (noms.includes(nom) && !dedans) inclus.set(nom, (inclus.get(nom) ?? 0) + somme)
    return somme
  }
  parcourir(profil.nodes[0]?.id ?? 1, new Set())
  process.stdout.write('\nTemps inclus\n')
  for (const [nom, us] of [...inclus].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`${(us / 1000).toFixed(0).padStart(8)} ms  ${nom}\n`)
  }
}
afficher('Par fonction', parFonction)
afficher('Par fichier', parFichier)
