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

/** Réglages modifiables, avec les valeurs par défaut du cadrage. `Reglages.parse({})` les rend toutes. */
export const Reglages = z.object({
  fuseau: z.string().default('Europe/Paris'),
  heureBascule: entierBorne('L’heure de bascule du jour', 0, 6, 4),
  delaiConsolidationMinutes: entierBorne('Le délai de consolidation (en minutes)', 30, 1440, 60),
  delaiVerificationJours: entierBorne('Le délai de vérification (en jours)', 1, 14, 3),
  delaiRetestJours: entierBorne('Le délai de nouveau test (en jours)', 14, 90, 30),
  entretienMois: z.array(z.number()).default([3, 6, 12]),
  delaiNouvelEssaiJours: entierBorne('Le délai avant un nouvel essai (en jours)', 1, 7, 2),
  echecsAvantDescente: entierBorne('Le nombre d’échecs avant descente', 1, 5, 2),
  seuilConsolidation: reelBorne('Le seuil de consolidation', 0.5, 1, 0.8),
  questionsDebut: entierBorne('Le nombre de questions de début de séance', 5, 10, 6),
  nouvellesCartesParJour: entierBorne('Le nombre de nouvelles cartes par jour', 0, 100, 20),
  retentionVisee: reelBorne('La rétention visée', 0.8, 0.97, 0.9),
  heuresSansPageAvantVerification: z.number().default(24),
  joursAvantReutilisation: z.number().default(60),
  seuilRecopie: z.number().default(0.5),
  relancesMax: entierBorne('Le nombre maximal de relances', 0, 4, 4),
  caracteresReponseMax: z.number().default(2000),
  echantillonControle: z.number().default(10),
  seuilDesaccord: z.number().default(0.15),
  plafondIaMillioniemes: entierBorne(
    'Le plafond mensuel de l’IA (en millionièmes d’euro)',
    0,
    100_000_000,
    10_000_000,
  ),
  appelsIaParHeure: entierBorne('Le nombre d’appels à l’IA par heure', 1, 120, 60),
  heureRappel: z.string().default('19:00'),
  rappelsEnPauseJusquAu: z.string().nullable().default(null),
  blocsEntreRevues: entierBorne('Le nombre de blocs entre deux revues', 3, 4, 3),
})
export type Reglages = z.infer<typeof Reglages>
