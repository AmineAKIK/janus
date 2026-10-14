import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validerManifeste } from '@janus/contrats'
import { DOSSIER_CONTENU } from '../contenu.ts'
import { extraireManifeste } from '../domaines/catalogue/composition.ts'
import { DOSSIER_FICHES } from '../fiches.ts'
import { texteDeLaFiche } from '../texteFiche.ts'

// Écrit sur la sortie le texte d'une fiche pour l'épreuve de l'apprenant neuf (LISEZ-MOI du gabarit).

const USAGE = 'pnpm fiches:texte <formation> <bloc>'

const [formation, bloc] = process.argv.slice(2)
if (formation === undefined || bloc === undefined) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}

const chemin = join(DOSSIER_CONTENU, formation, DOSSIER_FICHES, `${bloc}.html`)
let html: string
try {
  html = await readFile(chemin, 'utf8')
} catch {
  process.stderr.write(`Pas de fiche ici : ${chemin}\n`)
  process.exit(1)
}
const resultat = validerManifeste(JSON.parse(extraireManifeste(html) ?? 'null'))
if (!resultat.ok) {
  process.stderr.write('Le manifeste n’est pas valide : lance `pnpm fiches:verifier`.\n')
  process.exit(1)
}
process.stdout.write(texteDeLaFiche(html, resultat.manifeste))
