import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Manifeste } from '@janus/contrats'
import { correcteurDeLaConfig } from '../adaptateurs/correcteur/choix.ts'
import { creerFaux } from '../adaptateurs/correcteur/faux.ts'
import { EMPREINTE_CONSIGNE } from '../adaptateurs/correcteur/message.ts'
import { SchemaConfigCorrecteur } from '../config.ts'
import { horlogeSysteme } from '../horloge.ts'
import { evaluer, JeuDeTest, rapport } from './evaluerIa.ts'

const USAGE = 'pnpm ia:evaluer <jeu.json> [--faux]'
const RACINE = new URL('../../../../', import.meta.url).pathname

const [fichier, option] = process.argv.slice(2)
if (fichier === undefined) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}

const config = SchemaConfigCorrecteur.parse(process.env)
const choix = correcteurDeLaConfig(config, { delaiMs: 30_000, jetonsSortieMax: 1000 })
if (option !== '--faux' && choix.correcteur === undefined) {
  process.stderr.write(
    `La clé du correcteur « ${config.CORRECTEUR} » est exigée (DEEPSEEK_API_KEY ou ANTHROPIC_API_KEY), ou ajoute --faux.\n`,
  )
  process.exit(1)
}

// `pnpm ia:evaluer` s'exécute dans apps/api : le chemin du jeu est relatif à là où la commande a été lancée.
const chemin = resolve(process.env['INIT_CWD'] ?? process.cwd(), fichier)
const jeu = JeuDeTest.parse(JSON.parse(await readFile(chemin, 'utf8')))
const manifeste = Manifeste.parse(
  JSON.parse(await readFile(resolve(dirname(chemin), jeu.manifeste), 'utf8')),
)
const faux = option === '--faux' || choix.correcteur === undefined
const modele = faux ? 'faux' : choix.modele
const evaluation = await evaluer({
  jeu,
  manifeste,
  correcteur: faux ? creerFaux() : choix.correcteur,
  tarifs: choix.tarifs,
})

const date = horlogeSysteme.maintenant().slice(0, 10)
const dossier = join(RACINE, 'prompts/correction/rapports')
await mkdir(dossier, { recursive: true })
// Un rapport par modèle et par jour : deux fournisseurs passés le même jour se comparent.
const sortie = join(dossier, `${date}-v1-${modele}.md`)
await writeFile(
  sortie,
  rapport(evaluation, {
    date,
    modele,
    empreinteConsigne: EMPREINTE_CONSIGNE,
    jeu: fichier,
  }),
)
process.stdout.write(`Rapport écrit : ${sortie}\n`)
