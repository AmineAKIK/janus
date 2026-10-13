import { z } from 'zod'

interface Bornes {
  readonly libelle: string
  readonly min: number
  readonly max: number
  readonly entier: boolean
}

/** Format français d'un nombre dans un message : 0,5 et non 0.5. */
function enFrancais(valeur: number): string {
  return String(valeur).replace('.', ',')
}

function nombreBorne({ libelle, min, max, entier }: Bornes, defaut: number) {
  const attendu = entier ? 'un entier' : 'un nombre'
  const message = `${libelle} doit être ${attendu} entre ${enFrancais(min)} et ${enFrancais(max)}.`
  const base = z
    .number({ error: message })
    .min(min, { error: message })
    .max(max, { error: message })
  return (entier ? base.int({ error: message }) : base).default(defaut)
}

function entierBorne(libelle: string, min: number, max: number, defaut: number) {
  return nombreBorne({ libelle, min, max, entier: true }, defaut)
}

function reelBorne(libelle: string, min: number, max: number, defaut: number) {
  return nombreBorne({ libelle, min, max, entier: false }, defaut)
}

/** Les fuseaux déjà reconnus : construire un `Intl.DateTimeFormat` coûte ~15 µs, et chaque lecture des réglages valide le fuseau. */
const FUSEAUX_CONNUS = new Set<string>()
const FUSEAUX_RETENUS_AU_PLUS = 512

function fuseauConnu(nom: string): boolean {
  if (FUSEAUX_CONNUS.has(nom)) return true
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: nom })
  } catch {
    return false
  }
  // Borné : le nom vient d'une saisie, la mémoire ne doit pas croître avec elle.
  if (FUSEAUX_CONNUS.size < FUSEAUX_RETENUS_AU_PLUS) FUSEAUX_CONNUS.add(nom)
  return true
}

const HEURE_RAPPEL = /^([01]\d|2[0-3]):[0-5]\d$/

/** Les mois de retest d'entretien : des entiers positifs, strictement croissants, de 1 à 120. */
const EntretienMois = z
  .array(
    z.number().int({ error: 'Les mois d’entretien doivent être des entiers.' }).min(1).max(120),
  )
  .min(1, { error: 'Il faut au moins un mois d’entretien.' })
  .max(12)
  .refine((mois) => mois.every((valeur, rang) => rang === 0 || valeur > (mois[rang - 1] ?? 0)), {
    error: 'Les mois d’entretien doivent être croissants.',
  })

/** Réglages modifiables, avec les valeurs par défaut du cadrage. `Reglages.parse({})` les rend toutes. */
export const Reglages = z.object({
  fuseau: z
    .string()
    .refine(fuseauConnu, { error: 'Ce fuseau horaire n’existe pas.' })
    .default('Europe/Paris'),
  heureBascule: entierBorne('L’heure de bascule du jour', 0, 6, 4),
  delaiConsolidationMinutes: entierBorne('Le délai de consolidation (en minutes)', 30, 1440, 60),
  delaiVerificationJours: entierBorne('Le délai de vérification (en jours)', 1, 14, 3),
  delaiRetestJours: entierBorne('Le délai de nouveau test (en jours)', 14, 90, 30),
  entretienMois: EntretienMois.default([3, 6, 12]),
  delaiNouvelEssaiJours: entierBorne('Le délai avant un nouvel essai (en jours)', 1, 7, 2),
  echecsAvantDescente: entierBorne('Le nombre d’échecs avant descente', 1, 5, 2),
  seuilConsolidation: reelBorne('Le seuil de consolidation', 0.5, 1, 0.8),
  questionsDebut: entierBorne('Le nombre de questions de début de séance', 5, 10, 6),
  nouvellesCartesParJour: entierBorne('Le nombre de nouvelles cartes par jour', 0, 100, 20),
  retentionVisee: reelBorne('La rétention visée', 0.8, 0.97, 0.9),
  heuresSansPageAvantVerification: reelBorne(
    'Le délai sans page avant une vérification (en heures)',
    0,
    168,
    24,
  ),
  joursAvantReutilisation: entierBorne(
    'Le délai avant de réutiliser une question (en jours)',
    1,
    365,
    60,
  ),
  seuilRecopie: reelBorne('Le seuil de recopie', 0.1, 1, 0.5),
  relancesMax: entierBorne('Le nombre maximal de relances', 0, 4, 4),
  echantillonControle: entierBorne('Le rythme du contrôle (une correction sur…)', 1, 100, 10),
  seuilDesaccord: reelBorne('Le seuil de désaccord', 0.01, 1, 0.15),
  plafondIaMillioniemes: entierBorne(
    'Le plafond mensuel de l’IA (en millionièmes d’euro)',
    0,
    100_000_000,
    10_000_000,
  ),
  appelsIaParHeure: entierBorne('Le nombre d’appels à l’IA par heure', 1, 120, 60),
  heureRappel: z
    .string()
    .regex(HEURE_RAPPEL, { error: 'L’heure du rappel doit être au format HH:MM.' })
    .default('19:00'),
  rappelsEnPauseJusquAu: z.iso.date().nullable().default(null),
  /** La formation affichée partout (Aujourd'hui, Suivi, révisions) ; `null` : la première formation importée. */
  formationActive: z.string().min(1).nullable().default(null),
  blocsEntreRevues: entierBorne('Le nombre de blocs entre deux revues', 3, 4, 3),
})
export type Reglages = z.infer<typeof Reglages>
