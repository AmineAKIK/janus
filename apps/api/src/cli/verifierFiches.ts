import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { CHEMIN_PONT } from '../assemblage.ts'
import { DOSSIER_CONTENU } from '../contenu.ts'
import { contenuGit, verifierLesFiches } from '../fiches.ts'

const USAGE = 'pnpm fiches:verifier [--base <révision git>]'
const RACINE_DEPOT = resolve(DOSSIER_CONTENU, '..')

const [option, revision] = process.argv.slice(2)
if (option !== undefined && (option !== '--base' || revision === undefined)) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}

// Le pont embarqué dans chaque fiche est comparé au pont construit : il faut l'avoir construit.
let pont: string
try {
  pont = await readFile(CHEMIN_PONT, 'utf8')
} catch {
  process.stderr.write('Le pont n’est pas construit : lance `pnpm --filter @janus/pont build`.\n')
  process.exit(1)
}

const problemes = await verifierLesFiches({
  dossierContenu: DOSSIER_CONTENU,
  pont,
  ...(revision === undefined
    ? {}
    : {
        contenuDeReference: (nom) =>
          contenuGit(RACINE_DEPOT, revision, join('contenu', nom).replaceAll('\\', '/')),
      }),
})
if (problemes.length > 0) {
  for (const probleme of problemes) process.stderr.write(`- ${probleme}\n`)
  process.exit(1)
}
process.stdout.write('Fiches du dépôt : aucun problème.\n')
