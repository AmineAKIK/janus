import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { validerManifeste } from '@janus/contrats'
import { DOSSIER_CONTENU } from '../contenu.ts'
import { extraireManifeste } from '../domaines/catalogue/composition.ts'
import { DOSSIER_FICHES } from '../fiches.ts'
import { texteDeLaFiche } from '../texteFiche.ts'
import {
  COMPTES_PAR_EPREUVE,
  ENTREES_PAR_EPREUVE,
  EPREUVES,
  epreuvesAJouer,
  lireLeCompte,
  mancheSuivante,
  verdict,
  type Compte,
  type Entrees,
  type Epreuve,
} from './epreuves.ts'

// Prépare une manche des quatre épreuves d'une fiche, ou lit ses rapports (mode d'emploi :
// `.claude/skills/fiche/SKILL.md`). Sans option : crée `<dossier>/v<n>/` avec tout ce que lisent les agents,
// y copie les rapports des épreuves qu'il est inutile de rejouer, et écrit dans `consignes-agents.md` la
// consigne exacte de chaque agent à lancer. Avec `--bilan` : lit les rapports de la dernière manche et dit si
// l'on peut arrêter. Les agents, eux, sont lancés par l'IA qui conduit la fiche : ce script ne parle à aucun modèle.

const USAGE = 'pnpm fiches:epreuves <formation> <bloc> <dossier> [--bilan]'
const RACINE_DEPOT = resolve(DOSSIER_CONTENU, '..')
const DEBUT_DES_QUESTIONS = '## Ce qu’on te demande'
const DEBUT_DES_LECONS = '## Concevoir une fiche'
const FIN_DES_LECONS = "## Règles permanentes pour l'IA qui code"

const bilan = process.argv.includes('--bilan')
const [formationDonnee, blocDonne, dossierDonne] = process.argv
  .slice(2)
  .filter((a) => a !== '--bilan')
if (formationDonnee === undefined || blocDonne === undefined || dossierDonne === undefined) {
  process.stderr.write(`Usage : ${USAGE}\n`)
  process.exit(1)
}
const formation: string = formationDonnee
const dossierNom: string = dossierDonne
const bloc: string = blocDonne
const dossier = resolve(process.cwd(), dossierDonne)

const rapport = (epreuve: Epreuve): string => `rapport-${epreuve}.md`
const consigne = (epreuve: Epreuve): string => `consigne-${epreuve}.md`
const FICHIER_DE_CONSIGNE: Readonly<Record<Epreuve, string>> = {
  'apprenant-neuf': 'apprenant-neuf.md',
  parcours: 'parcours-apprenant.md',
  gardien: 'gardien-methode.md',
  relecteur: 'relecteur-lecons.md',
}

async function lireSiPresent(chemin: string): Promise<string | undefined> {
  try {
    return await readFile(chemin, 'utf8')
  } catch {
    return undefined
  }
}

async function dossiersDeManche(): Promise<string[]> {
  try {
    return (await readdir(dossier, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
}

async function lireLesEntrees(chemin: string): Promise<Entrees> {
  const noms = [...new Set(Object.values(ENTREES_PAR_EPREUVE).flat())]
  const paires = await Promise.all(
    noms.map(async (nom): Promise<[string, string]> => [
      nom,
      (await lireSiPresent(join(chemin, nom))) ?? '',
    ]),
  )
  return new Map(paires)
}

/** Les entrées de la fiche telle qu'elle est maintenant dans le dépôt. */
async function construireLesEntrees(): Promise<Map<string, string>> {
  const cheminFiche = join(DOSSIER_CONTENU, formation, DOSSIER_FICHES, `${bloc}.html`)
  const html = await lireSiPresent(cheminFiche)
  if (html === undefined) {
    process.stderr.write(`Pas de fiche ici : ${cheminFiche}\n`)
    process.exit(1)
  }
  const manifeste = validerManifeste(JSON.parse(extraireManifeste(html) ?? 'null'))
  if (!manifeste.ok) {
    process.stderr.write('Le manifeste n’est pas valide : lance `pnpm fiches:verifier`.\n')
    process.exit(1)
  }
  const texte = texteDeLaFiche(html, manifeste.manifeste, { conception: false })
  const grille = await lireSiPresent(
    join(DOSSIER_CONTENU, formation, DOSSIER_FICHES, `${bloc}.grille.md`),
  )
  const regles = await lireSiPresent(join(DOSSIER_CONTENU, formation, 'methode', 'regles.json'))
  const agents = (await lireSiPresent(join(RACINE_DEPOT, 'AGENTS.md'))) ?? ''
  const debut = agents.indexOf(DEBUT_DES_LECONS)
  const fin = agents.indexOf(FIN_DES_LECONS)
  const plan = await lireSiPresent(join(dossier, 'plan.md'))
  if (plan === undefined) {
    process.stderr.write(
      `Il manque ${join(dossier, 'plan.md')} : la ligne du bloc dans le plan de référence (objectif, type, prérequis, erreurs critiques, TP, automatisme, preuve), que lit le gardien pour la règle F06.\n`,
    )
    process.exit(1)
  }
  return new Map([
    ['texte.txt', texte],
    ['texte-cours.txt', texte.split(DEBUT_DES_QUESTIONS)[0] ?? texte],
    ['texte-conception.txt', texteDeLaFiche(html, manifeste.manifeste, { conception: true })],
    ['grille.md', grille ?? ''],
    ['manifeste.json', extraireManifeste(html) ?? ''],
    ['regles.json', regles ?? ''],
    ['AGENTS.md', debut === -1 || fin === -1 ? agents : agents.slice(debut, fin)],
    ['plan.md', plan],
  ])
}

function consignePourLAgent(epreuve: Epreuve, chemin: string): string {
  const lit = (noms: readonly string[]): string =>
    noms.map((nom) => `\`${join(chemin, nom)}\``).join(', ')
  const entrees = ENTREES_PAR_EPREUVE[epreuve]
  const sortie = join(chemin, rapport(epreuve))
  const fin = `Écris ton rapport complet dans \`${sortie}\` (crée le fichier ; rien d'autre n'est lu). ${
    epreuve === 'apprenant-neuf'
      ? 'Chaque réponse tient sur une ligne qui commence par l’identifiant, au format de la consigne.'
      : `Il finit par le bloc « ## Compte » que la consigne demande (${COMPTES_PAR_EPREUVE[epreuve].join(', ')}).`
  } Tu ne lis rien d'autre que les fichiers nommés ici : pas le dépôt, pas d'autre fiche, pas de note.`
  switch (epreuve) {
    case 'apprenant-neuf':
      return `Tu es un agent neuf, sans historique. Lis d'abord ta consigne ${lit([consigne(epreuve)])}, puis le texte de la fiche ${lit(entrees)} en entier, et applique la consigne. ${fin}`
    case 'parcours':
      return `Tu es un agent neuf, sans historique. Lis d'abord ta consigne ${lit([consigne(epreuve)])}, puis le cours ${lit(entrees)} écran par écran, dans l'ordre, et applique la consigne. ${fin}`
    case 'gardien':
      return `Tu es un agent neuf, sans historique. Lis d'abord ta consigne ${lit([consigne(epreuve)])}, puis la grille, les règles, le texte avec ce que la page montre sur demande, le manifeste et la ligne du bloc dans le plan : ${lit(entrees)}. Applique la consigne ligne par ligne. ${fin}`
    case 'relecteur':
      return `Tu es un agent neuf, sans historique. Lis d'abord ta consigne ${lit([consigne(epreuve)])}, puis les leçons, les règles, la grille et le texte avec ce que la page montre sur demande : ${lit(entrees)}. Pour lever un doute, tu peux ouvrir en lecture seule \`contenu/${formation}/fiches/${bloc}.html\` à la racine du dépôt. Applique la consigne écran par écran. ${fin}`
  }
}

async function preparerLaManche(): Promise<void> {
  const presents = await dossiersDeManche()
  const numero = mancheSuivante(presents)
  const chemin = join(dossier, `v${String(numero)}`)
  const precedent = numero === 1 ? undefined : join(dossier, `v${String(numero - 1)}`)
  const courantes = await construireLesEntrees()
  const precedentes = precedent === undefined ? undefined : await lireLesEntrees(precedent)
  await mkdir(chemin, { recursive: true })
  for (const [nom, contenu] of courantes) await writeFile(join(chemin, nom), contenu)
  for (const epreuve of EPREUVES) {
    await copyFile(
      join(RACINE_DEPOT, 'prompts', 'fiches', FICHIER_DE_CONSIGNE[epreuve]),
      join(chemin, consigne(epreuve)),
    )
  }
  const aJouer = epreuvesAJouer(precedentes, courantes)
  const reprises: Epreuve[] = []
  for (const epreuve of EPREUVES) {
    if (aJouer.includes(epreuve) || precedent === undefined) continue
    const ancien = await lireSiPresent(join(precedent, rapport(epreuve)))
    if (ancien === undefined) {
      process.stderr.write(
        `Le rapport ${join(precedent, rapport(epreuve))} manque : l'épreuve ${epreuve} sera rejouée.\n`,
      )
      continue
    }
    await writeFile(join(chemin, rapport(epreuve)), ancien)
    reprises.push(epreuve)
  }
  const manquantes = EPREUVES.filter((e) => !reprises.includes(e))
  const consignes = [
    `# Manche ${String(numero)} : ${manquantes.length === 0 ? 'rien à rejouer' : manquantes.join(', ')}`,
    '',
    reprises.length === 0
      ? ''
      : `Reprises sans rejouer (entrées inchangées depuis la manche ${String(numero - 1)}) : ${reprises.join(', ')}.`,
    '',
    'Un agent neuf par épreuve (général, sans historique), lancés en parallèle, chacun avec sa consigne ci-dessous et rien d’autre.',
    '',
    ...manquantes.flatMap((epreuve) => [
      `## ${epreuve}`,
      '',
      consignePourLAgent(epreuve, chemin),
      '',
    ]),
    `Quand les rapports sont rendus : \`pnpm fiches:epreuves ${formation} ${bloc} ${dossierNom} --bilan\`.`,
    '',
  ].join('\n')
  await writeFile(join(chemin, 'consignes-agents.md'), consignes)
  await writeFile(join(chemin, 'a-jouer.txt'), `${manquantes.join('\n')}\n`)
  process.stdout.write(consignes)
}

async function lireLeBilan(): Promise<void> {
  const presents = await dossiersDeManche()
  const numero = mancheSuivante(presents) - 1
  if (numero < 1) {
    process.stderr.write(
      `Aucune manche dans ${dossier} : lance d'abord la commande sans --bilan.\n`,
    )
    process.exit(1)
  }
  const chemin = join(dossier, `v${String(numero)}`)
  const comptes = {} as Record<Epreuve, Compte>
  const problemes: string[] = []
  const lignes: string[] = [`Manche ${String(numero)} (${chemin})`, '']
  for (const epreuve of EPREUVES) {
    const texte = await lireSiPresent(join(chemin, rapport(epreuve)))
    if (texte === undefined) {
      problemes.push(`${epreuve} : pas de rapport ${rapport(epreuve)}`)
      continue
    }
    const lu = lireLeCompte(texte, epreuve)
    if (!lu.ok) {
      problemes.push(`${epreuve} : il manque ${lu.manque.join(', ')}`)
      continue
    }
    comptes[epreuve] = lu.compte
    lignes.push(
      `- ${epreuve} : ${[...lu.compte].map(([nom, n]) => `${String(n)} ${nom}`).join(', ')}`,
    )
  }
  if (problemes.length > 0) {
    process.stderr.write(
      `${lignes.join('\n')}\n\nRapports incomplets :\n- ${problemes.join('\n- ')}\n`,
    )
    process.exit(1)
  }
  const v = verdict(comptes)
  lignes.push('')
  if (v.arret) {
    lignes.push('Arrêt possible : plus rien ne bloque.')
    if (v.aTrancher.length > 0) {
      lignes.push(
        `À trancher sans nouvelle manche (${v.aTrancher.join(', ')}) : un point qui nomme une règle et un écran, vérifié dans la page, se corrige avant la PR ; les autres vont dans sa section « À toi de trancher ».`,
      )
    }
    process.stdout.write(`${lignes.join('\n')}\n`)
    return
  }
  lignes.push(`Manche suivante : ${v.bloquant.join(' ; ')}.`)
  lignes.push(
    'Corrige la classe, pas seulement le cas (AGENTS.md, « Quand on trouve un défaut »), puis relance la commande sans --bilan : elle ne rejoue que les épreuves dont les entrées ont changé.',
  )
  process.stdout.write(`${lignes.join('\n')}\n`)
  process.exit(2)
}

if (bilan) await lireLeBilan()
else await preparerLaManche()
