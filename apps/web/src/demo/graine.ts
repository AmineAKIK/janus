import {
  ERREUR_COMPILATEUR,
  MANIFESTES_GRAINE,
  PLAN_GRAINE,
  Manifeste,
  Reglages,
  catalogueGraine,
} from '@janus/contrats'
import demo from '@janus/contrats/fixtures/manifeste-demo.json'
import type { Catalogue, EtatDemo, Fait } from '@janus/contrats'
import { ajouterJours, instantEnIso, instantEnMs, jourDe } from '@janus/moteur'
import { etatVide } from './store.ts'

// La graine de la démo : une formation « DWWM » d'exemple et un module 1 de 20 blocs. Ce sont des
// données d'exemple, pas des données du produit. Les statuts ne sont jamais écrits ici : on écrit des
// faits, datés par rapport au premier lancement, et le moteur en tire les statuts.

// Le plan, les manifestes et le catalogue viennent de `@janus/contrats` : l'API de la CI les partage.
export { catalogueGraine, ERREUR_COMPILATEUR, MANIFESTES_GRAINE }
export const PLAN = PLAN_GRAINE

const MODELE = Manifeste.parse(demo)

/** Les formations que l'interrupteur « deuxFormations » ajoute : aucun de leurs modules n'est importé. */
export function formationsSupplementairesGraine(): readonly Pick<
  Catalogue,
  'formation' | 'modules'
>[] {
  const titres = [
    'Analyser les besoins',
    'Concevoir l’architecture',
    'Développer une application',
    'Tester et déployer',
    'Sécuriser les accès',
    'Gérer les données',
    'Collaborer en équipe',
    'Maintenir en production',
  ]
  return [
    {
      formation: {
        code: 'CDA',
        titre: 'Concepteur développeur d’applications',
        description: 'Une seconde formation d’exemple, pas encore importée.',
      },
      modules: titres.map((titre, i) => ({
        code: `CDA-M${String(i + 1)}`,
        titre,
        description: '',
        ordre: i + 1,
        importe: false as const,
      })),
    },
  ]
}

// ---- Les faits, datés par rapport au premier lancement ----

const REGLAGES = Reglages.parse({})
const MINUTE = 60_000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

const plus = (instant: string, ms: number): string => instantEnIso(instantEnMs(instant) + ms)
const jour = (instant: string) => jourDe(instant, REGLAGES.fuseau, REGLAGES.heureBascule)

/** L'instant d'il y a `jours` jours, au même rythme du jour malgré un changement d'heure. */
function ilYa(instant: string, jours: number): string {
  const cible = ajouterJours(jour(instant), -jours)
  const base = instantEnMs(instant) - jours * JOUR
  const trouve = [0, HEURE, -HEURE, 2 * HEURE, -2 * HEURE]
    .map((ecart) => instantEnIso(base + ecart))
    .find((candidat) => jour(candidat) === cible)
  return trouve ?? instantEnIso(base)
}

/** Un instant au moins `jours` jours après `instant`, comptés en jours du calendrier (avec la bascule). */
function apresJours(instant: string, jours: number): string {
  const cible = ajouterJours(jour(instant), jours)
  const base = instantEnMs(instant) + jours * JOUR
  const trouve = [0, HEURE, 2 * HEURE]
    .map((ecart) => instantEnIso(base + ecart))
    .find((candidat) => jour(candidat) >= cible)
  return trouve ?? instantEnIso(base)
}

type Sans<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type DonneesFait = Sans<Fait, 'id' | 'bloc' | 'date'>

const ids = (liste: readonly { readonly id: string }[]) => liste.map(({ id }) => id)
const RESTITUTION = ids(MODELE.restitution)
const CONSOLIDATION = ids(MODELE.consolidation)
const ITEMS = ids(MODELE.pratique.flatMap(({ items }) => items))
const EXERCICE = MODELE.pratique[0]?.id ?? ''

type Niveau = Extract<Fait, { type: 'correction' }>['niveau']

/** Le journal d'un bloc : les identifiants des faits se suivent et ne se recoupent pas d'un bloc à l'autre. */
function journal(bloc: string) {
  const faits: Fait[] = []
  const ajouter = (date: string, donnees: DonneesFait) => {
    faits.push({
      id: `graine-${bloc}-${String(faits.length + 1).padStart(2, '0')}`,
      bloc,
      date,
      ...donnees,
    })
  }
  const corrections = (
    date: string,
    serie: 'restitution' | 'consolidation',
    questions: readonly string[],
    niveaux: readonly Niveau[] = [],
  ) => {
    questions.forEach((question, i) => {
      ajouter(plus(date, i * MINUTE), {
        type: 'correction',
        serie,
        question,
        tour: 1,
        niveau: niveaux[i] ?? 'solide',
        compte: true,
        confiance: 'sur',
        erreursIa: [],
      })
    })
  }
  return {
    faits,
    ajouter,
    ouvrir: (date: string, horsPrerequis: boolean, raison?: string) => {
      ajouter(date, {
        type: 'bloc_ouvert',
        horsPrerequis,
        ...(raison === undefined ? {} : { raison }),
      })
      ajouter(plus(date, MINUTE), { type: 'etape_vue', etape: 'ET1' })
    },
    pratique: (date: string, nombre: number) => {
      ITEMS.slice(0, nombre).forEach((item, i) => {
        ajouter(plus(date, i * MINUTE), {
          type: 'pratique_resultat',
          exercice: EXERCICE,
          item,
          reussi: true,
          aide: 0,
        })
      })
    },
    atelier: (date: string) => {
      ajouter(date, { type: 'atelier_resultat', reussi: true, aide: 0 })
    },
    restitution: (date: string, niveaux?: readonly Niveau[]) => {
      corrections(date, 'restitution', RESTITUTION, niveaux)
    },
    consolidation: (date: string) => {
      corrections(date, 'consolidation', CONSOLIDATION)
    },
    verification: (date: string) => {
      ajouter(date, {
        type: 'verification_terminee',
        verification: 'verification',
        valable: true,
        reponses: [
          { type: 'explication', question: 'DE1', tour: 1, niveau: 'solide', compte: true },
          { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: true },
          { type: 'transfert', question: 'DR1', tour: 1, niveau: 'solide', compte: true },
        ],
      })
    },
  }
}

type Journal = ReturnType<typeof journal>

/**
 * Du premier clic à « acquis provisoirement » à l'instant donné : pratique, atelier, restitution,
 * puis consolidation une heure et demie plus tard. Le dernier fait tombe 2 minutes après `debut` + 120.
 */
function jusquaProvisoire(j: Journal, provisoire: string, raison?: string): void {
  const debut = plus(provisoire, -122 * MINUTE)
  j.ouvrir(plus(debut, -10 * MINUTE), raison !== undefined, raison)
  j.pratique(debut, 2)
  j.atelier(plus(debut, 5 * MINUTE))
  j.restitution(plus(debut, 30 * MINUTE))
  j.consolidation(plus(debut, 120 * MINUTE))
}

/** Les faits de chaque bloc commencé, selon `maintenant` (le premier lancement). */
const HISTOIRES: Readonly<Record<string, (j: Journal, maintenant: string) => void>> = {
  // Acquis : vérifié trois jours après avoir été acquis provisoirement.
  B01: (j, maintenant) => {
    const provisoire = ilYa(maintenant, 21)
    jusquaProvisoire(j, provisoire)
    j.verification(apresJours(provisoire, 3))
  },
  // Acquis provisoirement, et sa vérification tombe aujourd'hui.
  B02: (j, maintenant) => {
    jusquaProvisoire(j, ilYa(maintenant, REGLAGES.delaiVerificationJours))
  },
  // En cours : ouvert, un exercice réussi tout à l'heure.
  B03: (j, maintenant) => {
    j.ouvrir(ilYa(maintenant, 5), false)
    j.pratique(plus(maintenant, -3 * HEURE), 1)
  },
  // À reprendre : une erreur cochée par Amine, bloc ouvert avant que B03 soit acquis.
  B04: (j, maintenant) => {
    const debut = ilYa(maintenant, 4)
    j.ouvrir(debut, true, 'Je voulais comprendre les langages avant de finir l’ordinateur.')
    j.restitution(plus(debut, 30 * MINUTE), ['solide', 'partiel', 'fragile', 'solide', 'partiel'])
    j.ajouter(plus(debut, 45 * MINUTE), {
      type: 'erreur_cochee',
      erreur: ERREUR_COMPILATEUR,
      source: 'amine',
    })
  },
  // Vu : la restitution est faite, la consolidation reste à faire.
  B05: (j, maintenant) => {
    const debut = ilYa(maintenant, 6)
    j.ouvrir(debut, false)
    j.pratique(plus(debut, 10 * MINUTE), 2)
    j.atelier(plus(debut, 15 * MINUTE))
    j.restitution(plus(debut, 30 * MINUTE))
  },
  // Acquis, bloc ouvert avant que B05 soit assez avancé.
  B06: (j, maintenant) => {
    const provisoire = ilYa(maintenant, 8)
    jusquaProvisoire(j, provisoire, 'Le réseau local m’intéresse, je ne voulais pas attendre B05.')
    j.verification(apresJours(provisoire, 3))
  },
  // Acquis provisoirement, ouvert sans que B05 soit acquis : une raison est donnée.
  B07: (j, maintenant) => {
    jusquaProvisoire(
      j,
      ilYa(maintenant, 1),
      'Je prépare un projet web et j’ai besoin du DNS dès maintenant.',
    )
  },
}

/** Tous les faits de la graine, du plus ancien au plus récent. */
export function faitsGraine(maintenant: string): Fait[] {
  return PLAN.flatMap(({ code }) => {
    const j = journal(code)
    HISTOIRES[code]?.(j, maintenant)
    return j.faits
  }).sort((a, b) => instantEnMs(a.date) - instantEnMs(b.date) || (a.id < b.id ? -1 : 1))
}

/** L'état de départ de la démo : les faits de la graine, datés par rapport à `maintenant`. */
export function etatGraine(maintenant: string): EtatDemo {
  return { ...etatVide(maintenant), faits: faitsGraine(maintenant) }
}
