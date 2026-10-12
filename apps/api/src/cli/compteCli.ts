import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { creerBase } from '../base/base.ts'
import { creerHacheur } from '../domaines/auth/composition.ts'
import { horlogeSysteme } from '../horloge.ts'
import { creerCompte, ErreurCompte, motsDePasseFournis } from './compte.ts'

/** Pose des questions dont la réponse (un mot de passe) ne s'affiche pas à l'écran. */
function ouvrirQuestions() {
  let muet = false
  const sortie = new Writable({
    write(morceau: Buffer | string, _encodage, suite) {
      if (!muet) process.stdout.write(morceau)
      suite()
    },
  })
  const lecteur = createInterface({
    input: process.stdin,
    output: sortie,
    terminal: process.stdin.isTTY,
  })
  return {
    demander: (question: string): Promise<string> =>
      new Promise((resolve) => {
        muet = false
        lecteur.question(question, (reponse) => {
          process.stdout.write('\n')
          resolve(reponse)
        })
        muet = true
      }),
    fermer: () => {
      lecteur.close()
    },
  }
}

/** Tout ce qui arrive sur l'entrée standard, jusqu'à sa fermeture. */
async function lireEntree(): Promise<string> {
  const morceaux: Buffer[] = []
  for await (const morceau of process.stdin) morceaux.push(Buffer.from(morceau as Uint8Array))
  return Buffer.concat(morceaux).toString('utf8')
}

const nom = process.argv[2]
const url = process.env['DATABASE_URL']
if (nom === undefined || url === undefined) {
  process.stderr.write('Usage : DATABASE_URL=… pnpm compte:creer <nom>\n')
  process.exit(1)
}
const base = creerBase(url)
try {
  // Sans terminal (script d'installation, `docker compose exec` sans -t) : variable ou entrée tubée.
  const sansTerminal = !process.stdin.isTTY || process.env['JANUS_MOT_DE_PASSE'] !== undefined
  let saisies: { motDePasse: string; confirmation: string }
  if (sansTerminal) {
    const entree = process.stdin.isTTY ? '' : await lireEntree()
    saisies = motsDePasseFournis(process.env, entree)
  } else {
    const questions = ouvrirQuestions()
    const motDePasse = await questions.demander('Mot de passe : ')
    const confirmation = await questions.demander('Encore une fois : ')
    questions.fermer()
    saisies = { motDePasse, confirmation }
  }
  const { motDePasse, confirmation } = saisies
  if (motDePasse !== confirmation) throw new ErreurCompte('Les deux mots de passe diffèrent.')
  await creerCompte({ base, hacheur: creerHacheur(), horloge: horlogeSysteme }, nom, motDePasse)
  process.stdout.write(`Compte « ${nom} » créé.\n`)
} catch (erreur) {
  if (!(erreur instanceof ErreurCompte)) throw erreur
  process.stderr.write(`${erreur.message}\n`)
  process.exitCode = 1
} finally {
  await base.fermer()
}
