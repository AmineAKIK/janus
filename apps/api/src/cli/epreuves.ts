import { createHash } from 'node:crypto'

// Les quatre épreuves d'une fiche (AGENTS.md, « Avant de dire qu'elle est prête »), jouées par des agents
// neufs sur des entrées préparées par `pnpm fiches:epreuves`. Ce module ne lance aucun agent : il décide
// quelles épreuves une manche doit rejouer (celles dont les entrées ont changé), lit les rapports rendus et
// dit si la manche permet d'arrêter. Il existe parce que B06 a demandé treize manches préparées à la main,
// rejouées en entier, et arrêtées à l'appréciation de l'IA (leçons du B06).

export const EPREUVES = ['apprenant-neuf', 'parcours', 'gardien', 'relecteur'] as const
export type Epreuve = (typeof EPREUVES)[number]

/** Ce que lit chaque épreuve, dans le dossier de la manche. */
export const ENTREES_PAR_EPREUVE: Readonly<Record<Epreuve, readonly string[]>> = {
  'apprenant-neuf': ['texte.txt'],
  parcours: ['texte-cours.txt'],
  gardien: ['texte-conception.txt', 'grille.md', 'manifeste.json', 'regles.json', 'plan.md'],
  relecteur: ['texte-conception.txt', 'grille.md', 'regles.json', 'AGENTS.md'],
}

/** Les entrées d'une manche : nom du fichier → contenu. */
export type Entrees = ReadonlyMap<string, string>

function empreinte(entrees: Entrees, noms: readonly string[]): string {
  const h = createHash('sha256')
  for (const nom of noms)
    h.update(nom)
      .update('\0')
      .update(entrees.get(nom) ?? '')
      .update('\0')
  return h.digest('hex')
}

/**
 * Les épreuves à rejouer : celles dont une entrée a changé depuis la manche précédente (décision d'Amine du
 * 5 novembre 2026 : on ne rejoue que les épreuves que la correction touche). Sans manche précédente, les quatre.
 */
export function epreuvesAJouer(
  precedente: Entrees | undefined,
  courante: Entrees,
): readonly Epreuve[] {
  if (precedente === undefined) return [...EPREUVES]
  return EPREUVES.filter(
    (epreuve) =>
      empreinte(precedente, ENTREES_PAR_EPREUVE[epreuve]) !==
      empreinte(courante, ENTREES_PAR_EPREUVE[epreuve]),
  )
}

/** Les comptes qu'un rapport doit donner, par épreuve, dans son bloc final `## Compte`. */
export const COMPTES_PAR_EPREUVE: Readonly<Record<Epreuve, readonly string[]>> = {
  'apprenant-neuf': ['déductibles', 'recopiées', 'non déductibles', 'hors champ'],
  parcours: ['décrochages', 'îles', 'abstraits d’affilée'],
  gardien: ['contestées', 'écarts contestés', 'violées hors grille'],
  relecteur: ['bloquants', 'gênants', 'mineurs'],
}

export type Compte = ReadonlyMap<string, number>

const LIGNE_DE_COMPTE = /^\s*(?:[-*]\s+)?([^:]+?)\s*:\s*(\d+)\s*$/u
const VERDICT_APPRENANT =
  /^\s*(?:[-*]\s+)?`?[A-Za-z][\w-]*`?\s*:\s*(déductible|non déductible|recopiée|hors champ assumé)(?![\p{L}\p{N}_])/iu

function normaliser(texte: string): string {
  return texte.toLowerCase().replaceAll('’', '’').replaceAll("'", '’').trim()
}

/**
 * Lit le bloc `## Compte` d'un rapport : une ligne `- nom : nombre` par compte attendu. Pour l'apprenant neuf,
 * les comptes se calculent sur ses lignes `ID : verdict …` : l'agent ne se compte pas lui-même.
 * Rend les comptes, ou la liste de ce qui manque.
 */
export function lireLeCompte(
  rapport: string,
  epreuve: Epreuve,
): { ok: true; compte: Compte } | { ok: false; manque: readonly string[] } {
  if (epreuve === 'apprenant-neuf') {
    const compte = new Map<string, number>([
      ['déductibles', 0],
      ['recopiées', 0],
      ['non déductibles', 0],
      ['hors champ', 0],
    ])
    const cles: Record<string, string> = {
      déductible: 'déductibles',
      'non déductible': 'non déductibles',
      recopiée: 'recopiées',
      'hors champ assumé': 'hors champ',
    }
    for (const ligne of rapport.split('\n')) {
      const lue = VERDICT_APPRENANT.exec(ligne)
      if (lue === null) continue
      const cle = cles[(lue[1] ?? '').toLowerCase()] ?? ''
      compte.set(cle, (compte.get(cle) ?? 0) + 1)
    }
    return compte.get('déductibles') === 0 && compte.get('non déductibles') === 0
      ? { ok: false, manque: ['aucune ligne « ID : verdict : réponse »'] }
      : { ok: true, compte }
  }
  const position = rapport.search(/^##\s+Compte\s*$/imu)
  if (position === -1) return { ok: false, manque: ['le bloc final « ## Compte »'] }
  const compte = new Map<string, number>()
  for (const ligne of rapport.slice(position).split('\n').slice(1)) {
    if (/^#/u.test(ligne)) break
    const lue = LIGNE_DE_COMPTE.exec(ligne)
    if (lue !== null) compte.set(normaliser(lue[1] ?? ''), Number(lue[2]))
  }
  const manque = COMPTES_PAR_EPREUVE[epreuve].filter((nom) => !compte.has(normaliser(nom)))
  if (manque.length > 0) return { ok: false, manque: manque.map((nom) => `le compte « ${nom} »`) }
  return {
    ok: true,
    compte: new Map(
      COMPTES_PAR_EPREUVE[epreuve].map((nom) => [nom, compte.get(normaliser(nom)) ?? 0]),
    ),
  }
}

export interface Verdict {
  /** La manche permet d'arrêter : plus rien de bloquant dans les quatre épreuves. */
  readonly arret: boolean
  /** Ce qui empêche l'arrêt, un point par compte non nul. */
  readonly bloquant: readonly string[]
  /** Ce qui reste à trancher sans nouvelle manche : les gênants et mineurs du relecteur. */
  readonly aTrancher: readonly string[]
}

/**
 * La règle d'arrêt (leçons du B06) : zéro non déductible et zéro recopiée (apprenant neuf), zéro décrochage et
 * zéro île (parcours), zéro ligne contestée, écart contesté ou règle violée hors grille (gardien), zéro bloquant
 * (relecteur). Les gênants et mineurs du relecteur ne relancent pas de manche : ceux qui nomment une règle et
 * un écran se corrigent avant la PR, les autres vont dans sa section « À toi de trancher ».
 */
export function verdict(comptes: Readonly<Record<Epreuve, Compte>>): Verdict {
  const bloquant: string[] = []
  const bloque = (epreuve: Epreuve, nom: string): void => {
    const valeur = comptes[epreuve].get(nom) ?? 0
    if (valeur > 0) bloquant.push(`${epreuve} : ${String(valeur)} ${nom}`)
  }
  bloque('apprenant-neuf', 'non déductibles')
  bloque('apprenant-neuf', 'recopiées')
  bloque('parcours', 'décrochages')
  bloque('parcours', 'îles')
  bloque('gardien', 'contestées')
  bloque('gardien', 'écarts contestés')
  bloque('gardien', 'violées hors grille')
  bloque('relecteur', 'bloquants')
  const aTrancher: string[] = []
  for (const nom of ['gênants', 'mineurs'] as const) {
    const valeur = comptes.relecteur.get(nom) ?? 0
    if (valeur > 0) aTrancher.push(`relecteur : ${String(valeur)} ${nom}`)
  }
  const abstraits = comptes.parcours.get('abstraits d’affilée') ?? 0
  if (abstraits > 4)
    bloquant.push(`parcours : ${String(abstraits)} écrans abstraits d’affilée (quatre au plus)`)
  return { arret: bloquant.length === 0, bloquant, aTrancher }
}

/** Le numéro de la manche suivante, d'après les dossiers `v<n>` déjà présents. */
export function mancheSuivante(dossiers: readonly string[]): number {
  const numeros = dossiers.map((nom) => /^v(\d+)$/u.exec(nom)?.[1]).filter((n) => n !== undefined)
  return numeros.length === 0 ? 1 : Math.max(...numeros.map(Number)) + 1
}
