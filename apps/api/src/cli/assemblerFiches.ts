import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CHEMIN_PONT,
  injecterLePont,
  nouvelleFiche,
  pontEstPresent,
  remplacerLePont,
} from '../assemblage.ts'
import { DOSSIER_CONTENU } from '../contenu.ts'
import { DOSSIER_FICHES, lireLesFiches } from '../fiches.ts'

const USAGE = [
  'pnpm fiches:nouvelle <formation> <bloc>   crée la fiche du bloc depuis le gabarit',
  'pnpm fiches:assembler                     écrit le pont dans les fiches qui ne l’ont pas',
  'pnpm fiches:assembler --forcer            réécrit le pont dans toutes les fiches (puis augmente leur version)',
].join('\n')

async function lirePont(): Promise<string> {
  try {
    return await readFile(CHEMIN_PONT, 'utf8')
  } catch {
    throw new Error('Le pont n’est pas construit : lance `pnpm --filter @janus/pont build`.')
  }
}

const [commande, formation, bloc] = process.argv.slice(2)
const forcer = commande === 'assembler' && formation === '--forcer' && bloc === undefined
try {
  if (commande === 'nouvelle' && formation !== undefined && bloc !== undefined) {
    const chemin = join(DOSSIER_CONTENU, formation, DOSSIER_FICHES, `${bloc}.html`)
    const gabarit = await readFile(
      join(DOSSIER_CONTENU, formation, 'gabarit', 'fiche.html'),
      'utf8',
    )
    const html = nouvelleFiche(gabarit, bloc, await lirePont())
    // `wx` : jamais écraser une fiche qui existe.
    await writeFile(chemin, html, { flag: 'wx' })
    process.stdout.write(`Fiche créée : ${chemin}\n`)
  } else if (commande === 'assembler' && (formation === undefined || forcer)) {
    const pont = await lirePont()
    let nombre = 0
    const formations = (await readdir(DOSSIER_CONTENU, { withFileTypes: true }))
      .filter((entree) => entree.isDirectory())
      .map((entree) => entree.name)
    for (const dossier of formations) {
      for (const fiche of await lireLesFiches(DOSSIER_CONTENU, dossier)) {
        if (pontEstPresent(fiche.html) && !forcer) continue
        const html = forcer ? remplacerLePont(fiche.html, pont) : injecterLePont(fiche.html, pont)
        if (html === fiche.html) continue
        await writeFile(fiche.chemin, html)
        nombre += 1
        process.stdout.write(`Pont ${forcer ? 'réécrit' : 'écrit'} dans ${fiche.nom}\n`)
      }
    }
    if (nombre === 0) process.stdout.write('Toutes les fiches ont déjà leur pont.\n')
  } else {
    process.stderr.write(`Usage :\n${USAGE}\n`)
    process.exit(1)
  }
} catch (cause) {
  process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`)
  process.exit(1)
}
