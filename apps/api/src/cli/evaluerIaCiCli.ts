import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { DOSSIER_CONTENU } from '../contenu.ts'
import {
  choisirLExecution,
  depotDepuisLAdresse,
  texteDesAnnotations,
  type Annotation,
  type Execution,
} from './evaluerIaCi.ts'

// Lance l'évaluation IA de l'épreuve 1 par le workflow `ia-evaluer.yml` (clés dans les secrets du dépôt),
// attend son résultat et l'affiche. Le fichier des réponses doit être poussé sur la branche.
//   pnpm ia:evaluer:ci <formation> <bloc> <reponses.md> [--ref <branche>] [--correcteur claude|deepseek]

const USAGE =
  'pnpm ia:evaluer:ci <formation> <bloc> <reponses.md> [--ref <branche>] [--correcteur claude|deepseek]'
const RACINE_DEPOT = resolve(DOSSIER_CONTENU, '..')
const WORKFLOW = 'ia-evaluer.yml'
const JEU_PAR_DEFAUT = 'prompts/correction/jeu-de-test/exemple.json'
const ATTENTE_MS = 20_000
const LIMITE_MS = 30 * 60_000

const executer = promisify(execFile)

const arguments_ = process.argv.slice(2)
const option = (nom: string): string | undefined => {
  const i = arguments_.indexOf(nom)
  return i === -1 ? undefined : arguments_[i + 1]
}
const valeurs = arguments_.filter(
  (a, i) =>
    !a.startsWith('--') && arguments_[i - 1] !== '--ref' && arguments_[i - 1] !== '--correcteur',
)
const [formation, bloc, reponses] = valeurs
if (formation === undefined || bloc === undefined || reponses === undefined) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}
const correcteur = option('--correcteur') ?? 'claude'

async function git(...args: string[]): Promise<string> {
  const { stdout } = await executer('git', args, { cwd: RACINE_DEPOT })
  return stdout.trim()
}
async function gh(...args: string[]): Promise<string> {
  const { stdout } = await executer('gh', args, { cwd: RACINE_DEPOT, maxBuffer: 16 * 1024 * 1024 })
  return stdout
}

const ref = option('--ref') ?? (await git('rev-parse', '--abbrev-ref', 'HEAD'))
const cheminReponses = reponses.replaceAll('\\', '/')
try {
  await access(resolve(RACINE_DEPOT, cheminReponses))
} catch {
  process.stderr.write(`Pas de fichier de réponses ici : ${cheminReponses}\n`)
  process.exit(1)
}
await git('fetch', '-q', 'origin', ref)
const surLaBranche = await git('ls-tree', '--name-only', `origin/${ref}`, cheminReponses)
if (surLaBranche === '') {
  process.stderr.write(
    `${cheminReponses} n'est pas poussé sur origin/${ref} : commite et pousse d'abord.\n`,
  )
  process.exit(1)
}
const depot = depotDepuisLAdresse(await git('remote', 'get-url', 'origin'))
if (depot === undefined) {
  process.stderr.write(
    'Le dépôt distant `origin` n’est pas sur GitHub : impossible de lancer le workflow.\n',
  )
  process.exit(1)
}

const depuis = new Date()
await gh(
  'api',
  '-X',
  'POST',
  `repos/${depot}/actions/workflows/${WORKFLOW}/dispatches`,
  '-f',
  `ref=${ref}`,
  '-f',
  `inputs[jeu]=${JEU_PAR_DEFAUT}`,
  '-f',
  `inputs[fiche]=${formation} ${bloc} ${cheminReponses}`,
  '-f',
  `inputs[correcteur]=${correcteur}`,
)
process.stdout.write(`Workflow ${WORKFLOW} lancé sur ${ref} pour ${bloc} (${correcteur}).\n`)

const attendre = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
let execution: Execution | undefined
const debut = Date.now()
while (Date.now() - debut < LIMITE_MS) {
  await attendre(execution === undefined ? 8_000 : ATTENTE_MS)
  const json = await gh(
    'api',
    `repos/${depot}/actions/workflows/${WORKFLOW}/runs?branch=${encodeURIComponent(ref)}&event=workflow_dispatch&per_page=10`,
  )
  const { workflow_runs } = JSON.parse(json) as { workflow_runs: Execution[] }
  execution = choisirLExecution(workflow_runs, depuis)
  if (execution?.status === 'completed') break
}
if (execution?.status !== 'completed') {
  process.stderr.write(
    `Pas de résultat après trente minutes${execution === undefined ? '' : ` : ${execution.html_url}`}.\n`,
  )
  process.exit(1)
}
const { jobs } = JSON.parse(
  await gh('api', `repos/${depot}/actions/runs/${String(execution.id)}/jobs`),
) as {
  jobs: { id: number }[]
}
const job = jobs[0]
const annotations =
  job === undefined
    ? []
    : (JSON.parse(
        await gh('api', `repos/${depot}/check-runs/${String(job.id)}/annotations`),
      ) as Annotation[])
process.stdout.write(`${texteDesAnnotations(annotations)}\n\nExécution : ${execution.html_url}\n`)
if (execution.conclusion !== 'success') {
  process.stderr.write(
    'Une réponse ne sort pas Solide, ou le workflow a échoué : lis le résumé de l’exécution.\n',
  )
  process.exit(1)
}
process.stdout.write(`Toutes les réponses déductibles de ${bloc} sortent Solide.\n`)
