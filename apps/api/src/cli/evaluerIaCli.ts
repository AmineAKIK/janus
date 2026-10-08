import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Manifeste } from '@janus/contrats'
import { creerDeepseek } from '../adaptateurs/correcteur/deepseek.ts'
import { creerFaux } from '../adaptateurs/correcteur/faux.ts'
import { EMPREINTE_CONSIGNE } from '../adaptateurs/correcteur/message.ts'
import { SchemaConfig } from '../config.ts'
import { horlogeSysteme } from '../horloge.ts'
import { evaluer, JeuDeTest, rapport } from './evaluerIa.ts'

const USAGE = 'pnpm ia:evaluer <jeu.json> [--faux]'
const RACINE = new URL('../../../../', import.meta.url).pathname

const [fichier, option] = process.argv.slice(2)
if (fichier === undefined) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}

const config = SchemaConfig.pick({
  DEEPSEEK_API_KEY: true,
  DEEPSEEK_MODELE: true,
  DEEPSEEK_URL: true,
  DEEPSEEK_TEMPERATURE: true,
  DEEPSEEK_PRIX_ENTREE_CACHE: true,
  DEEPSEEK_PRIX_ENTREE: true,
  DEEPSEEK_PRIX_SORTIE: true,
}).parse(process.env)
if (option !== '--faux' && config.DEEPSEEK_API_KEY === undefined) {
  process.stderr.write('DEEPSEEK_API_KEY est exigée (ou ajoute --faux).\n')
  process.exit(1)
}

const chemin = resolve(fichier)
const jeu = JeuDeTest.parse(JSON.parse(await readFile(chemin, 'utf8')))
const manifeste = Manifeste.parse(
  JSON.parse(await readFile(resolve(dirname(chemin), jeu.manifeste), 'utf8')),
)
const correcteur =
  option === '--faux' || config.DEEPSEEK_API_KEY === undefined
    ? creerFaux()
    : creerDeepseek({
        cle: config.DEEPSEEK_API_KEY,
        url: config.DEEPSEEK_URL,
        modele: config.DEEPSEEK_MODELE,
        temperature: config.DEEPSEEK_TEMPERATURE,
        delaiMs: 30_000,
        jetonsSortieMax: 1000,
      })
const evaluation = await evaluer({
  jeu,
  manifeste,
  correcteur,
  tarifs: {
    entreeCache: config.DEEPSEEK_PRIX_ENTREE_CACHE,
    entree: config.DEEPSEEK_PRIX_ENTREE,
    sortie: config.DEEPSEEK_PRIX_SORTIE,
  },
})

const date = horlogeSysteme.maintenant().slice(0, 10)
const dossier = join(RACINE, 'prompts/correction/rapports')
await mkdir(dossier, { recursive: true })
const sortie = join(dossier, `${date}-v1.md`)
await writeFile(
  sortie,
  rapport(evaluation, {
    date,
    modele: option === '--faux' ? 'faux' : config.DEEPSEEK_MODELE,
    empreinteConsigne: EMPREINTE_CONSIGNE,
    jeu: fichier,
  }),
)
process.stdout.write(`Rapport écrit : ${sortie}\n`)
