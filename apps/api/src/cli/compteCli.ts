import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { creerBase } from '../base/base.ts'
import { creerHacheur } from '../domaines/auth/composition.ts'
import { horlogeSysteme } from '../horloge.ts'
import { creerCompte, ErreurCompte } from './compte.ts'

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

const nom = process.argv[2]
const url = process.env['DATABASE_URL']
if (nom === undefined || url === undefined) {
  process.stderr.write('Usage : DATABASE_URL=… pnpm compte:creer <nom>\n')
  process.exit(1)
}
const base = creerBase(url)
try {
  const questions = ouvrirQuestions()
  const motDePasse = await questions.demander('Mot de passe : ')
  const confirmation = await questions.demander('Encore une fois : ')
  questions.fermer()
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
