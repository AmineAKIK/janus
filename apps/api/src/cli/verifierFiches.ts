import { join, resolve } from 'node:path'
import { DOSSIER_CONTENU } from '../contenu.ts'
import { contenuGit, verifierLesFiches } from '../fiches.ts'

const USAGE = 'pnpm fiches:verifier [--base <révision git>]'
const RACINE_DEPOT = resolve(DOSSIER_CONTENU, '..')

const [option, revision] = process.argv.slice(2)
if (option !== undefined && (option !== '--base' || revision === undefined)) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}

const problemes = await verifierLesFiches({
  dossierContenu: DOSSIER_CONTENU,
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
