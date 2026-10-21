import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Manifeste, validerManifeste } from '@janus/contrats'
import { correcteurDeLaConfig } from '../adaptateurs/correcteur/choix.ts'
import { creerFaux } from '../adaptateurs/correcteur/faux.ts'
import { EMPREINTE_CONSIGNE, VERSION_CONSIGNE } from '../adaptateurs/correcteur/message.ts'
import { SchemaConfigCorrecteur } from '../config.ts'
import { DOSSIER_CONTENU } from '../contenu.ts'
import { extraireManifeste } from '../domaines/catalogue/composition.ts'
import { DOSSIER_FICHES } from '../fiches.ts'
import { horlogeSysteme } from '../horloge.ts'
import { lireLApprenantNeuf } from './apprenantNeuf.ts'
import { evaluer, JeuDeTest, rapport } from './evaluerIa.ts'

// Deux usages. Un jeu de test (niveaux d'Amine) : `pnpm ia:evaluer <jeu.json>`. Les réponses de
// l'agent neuf à l'épreuve 1 d'une fiche, qui doivent toutes sortir Solide :
// `pnpm ia:evaluer --fiche <formation> <bloc> <reponses.md>`. Les deux coûtent un appel par réponse,
// sauf avec `--faux`.

const USAGE = [
  'pnpm ia:evaluer <jeu.json> [--faux]',
  'pnpm ia:evaluer --fiche <formation> <bloc> <reponses.md> [--faux]',
].join('\n        ')
const RACINE = new URL('../../../../', import.meta.url).pathname

const arguments_ = process.argv.slice(2)
const faux = arguments_.includes('--faux')
const parFiche = arguments_.includes('--fiche')
const valeurs = arguments_.filter((argument) => !argument.startsWith('--'))
if ((parFiche && valeurs.length !== 3) || (!parFiche && valeurs.length !== 1)) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}

const config = SchemaConfigCorrecteur.parse(process.env)
const choix = correcteurDeLaConfig(config, { delaiMs: 30_000, jetonsSortieMax: 4000 })
if (!faux && choix.correcteur === undefined) {
  process.stderr.write(
    `La clé du correcteur « ${config.CORRECTEUR} » est exigée (DEEPSEEK_API_KEY ou ANTHROPIC_API_KEY), ou ajoute --faux.\n`,
  )
  process.exit(1)
}
const correcteur = faux || choix.correcteur === undefined ? creerFaux() : choix.correcteur
const modele = faux || choix.correcteur === undefined ? 'faux' : choix.modele

// `pnpm ia:evaluer` s'exécute dans apps/api : les chemins sont relatifs à là où la commande a été lancée.
const depuisLaCommande = (chemin: string) =>
  resolve(process.env['INIT_CWD'] ?? process.cwd(), chemin)
const date = horlogeSysteme.maintenant().slice(0, 10)
const dossier = join(RACINE, 'prompts/correction/rapports')
await mkdir(dossier, { recursive: true })

async function evaluerEtEcrire(jeu: JeuDeTest, manifeste: Manifeste, nom: string, suffixe = '') {
  const evaluation = await evaluer({ jeu, manifeste, correcteur, tarifs: choix.tarifs })
  // Un rapport par modèle et par jour : deux fournisseurs passés le même jour se comparent.
  const sortie = join(dossier, `${date}-${VERSION_CONSIGNE}-${modele}${suffixe}.md`)
  await writeFile(
    sortie,
    rapport(evaluation, {
      date,
      modele,
      versionConsigne: VERSION_CONSIGNE,
      empreinteConsigne: EMPREINTE_CONSIGNE,
      jeu: nom,
    }),
  )
  process.stdout.write(`Rapport écrit : ${sortie}\n`)
  return evaluation
}

if (!parFiche) {
  const [fichier = ''] = valeurs
  const chemin = depuisLaCommande(fichier)
  const jeu = JeuDeTest.parse(JSON.parse(await readFile(chemin, 'utf8')))
  const manifeste = Manifeste.parse(
    JSON.parse(await readFile(resolve(dirname(chemin), jeu.manifeste), 'utf8')),
  )
  await evaluerEtEcrire(jeu, manifeste, fichier)
} else {
  const [formation = '', bloc = '', reponses = ''] = valeurs
  const cheminFiche = join(DOSSIER_CONTENU, formation, DOSSIER_FICHES, `${bloc}.html`)
  let html: string
  try {
    html = await readFile(cheminFiche, 'utf8')
  } catch {
    process.stderr.write(`Pas de fiche ici : ${cheminFiche}\n`)
    process.exit(1)
  }
  const resultat = validerManifeste(JSON.parse(extraireManifeste(html) ?? 'null'))
  if (!resultat.ok) {
    process.stderr.write('Le manifeste n’est pas valide : lance `pnpm fiches:verifier`.\n')
    process.exit(1)
  }
  const lecture = lireLApprenantNeuf(
    await readFile(depuisLaCommande(reponses), 'utf8'),
    resultat.manifeste,
  )
  if (lecture.ignores.length > 0) {
    process.stdout.write(`Ignorés (ni restitution ni rappel) : ${lecture.ignores.join(', ')}\n`)
  }
  if (lecture.sansReponse.length > 0) {
    process.stdout.write(
      `Sans réponse déductible (non déductible, hors champ ou absente) : ${lecture.sansReponse.join(', ')}\n`,
    )
  }
  if (lecture.jeux.length === 0) {
    process.stderr.write(`Aucune réponse déductible pour ${bloc} dans ${reponses}.\n`)
    process.exit(1)
  }
  const pasSolides: string[] = []
  for (const jeu of lecture.jeux) {
    const evaluation = await evaluerEtEcrire(
      jeu,
      resultat.manifeste,
      `${reponses} (${bloc}, ${jeu.serie})`,
      `-${bloc}-${jeu.serie}-apprenant-neuf`,
    )
    for (const r of evaluation.resultats) {
      if (r.niveauIa !== 'solide') pasSolides.push(`${r.id} : ${r.niveauIa ?? 'refusé'}`)
    }
  }
  if (pasSolides.length > 0) {
    process.stdout.write(
      `Réponses de l'apprenant neuf qui ne sortent pas Solide (attendu à réécrire) :\n  ${pasSolides.join('\n  ')}\n`,
    )
    process.exit(1)
  }
  process.stdout.write(`Toutes les réponses déductibles de ${bloc} sortent Solide.\n`)
}
