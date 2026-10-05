import { Manifeste, Reglages } from '@janus/contrats'
import type { Aide, Niveau, Serie, Statut, TypeVerification } from '@janus/contrats'
import demo from '@janus/contrats/fixtures/manifeste-demo.json'
import type { Fait } from './faits.ts'

// Aides à l'écriture des tests et des cas d'acceptation : ce fichier n'est pas du code du moteur.

/** Le manifeste de démonstration D01 : 5 restitution, 3 consolidation, 1 exercice de 3 items (2 à réussir), un atelier, une aisance. */
export const MANIFESTE = Manifeste.parse(demo)
/** Les réglages par défaut du cadrage. */
export const REGLAGES = Reglages.parse({})
/** Un lundi d'été à 12 h à Paris : loin des changements d'heure et de la bascule de 4 h. */
export const DEBUT = '2026-06-01T10:00:00Z'

/** `iso` décalé de `jours` jours et `minutes` minutes. */
export function apres(iso: string, jours: number, minutes = 0): string {
  return new Date(Date.parse(iso) + (jours * 1440 + minutes) * 60_000).toISOString()
}

type Sans<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type DonneesFait = Sans<Fait, 'id' | 'bloc' | 'date'>

/** Fabrique de faits pour un bloc : les identifiants se suivent. */
export function fabrique(bloc: string = MANIFESTE.bloc) {
  let numero = 0
  const fait = (date: string, donnees: DonneesFait): Fait => {
    numero += 1
    return { id: `f${String(numero).padStart(4, '0')}`, bloc, date, ...donnees }
  }

  const correction = (
    date: string,
    serie: Serie,
    question: string,
    options: Partial<{
      tour: number
      niveau: Niveau
      compte: boolean
      raisonNonCompte: 'relance' | 'avec_support' | 'recopiee' | 'non_verifiee'
      erreursIa: string[]
    }> = {},
  ): Fait =>
    fait(date, {
      type: 'correction',
      serie,
      question,
      tour: options.tour ?? 1,
      niveau: options.niveau ?? 'solide',
      compte: options.compte ?? true,
      ...(options.raisonNonCompte === undefined
        ? {}
        : { raisonNonCompte: options.raisonNonCompte }),
      confiance: 'sur',
      erreursIa: options.erreursIa ?? [],
    })

  const reponses = (transfert: Niveau, tache: boolean) =>
    [
      { type: 'explication', question: 'DE1', tour: 1, niveau: 'solide', compte: true },
      { type: 'tache', question: 'DT1', tour: 1, reussi: tache, compte: true },
      { type: 'transfert', question: 'DR1', tour: 1, niveau: transfert, compte: true },
    ] as const

  return {
    fait,
    correction,
    /** Les 5 questions de restitution, une minute entre chacune. */
    restitution: (date: string, niveau: Niveau = 'solide'): Fait[] =>
      MANIFESTE.restitution.map((q, i) =>
        correction(apres(date, 0, i), 'restitution', q.id, { niveau }),
      ),
    /** Les 3 questions de consolidation, une minute entre chacune. */
    consolidation: (
      date: string,
      niveaux: readonly [Niveau, Niveau, Niveau] = ['solide', 'solide', 'solide'],
    ): Fait[] =>
      MANIFESTE.consolidation.map((q, i) =>
        correction(apres(date, 0, i), 'consolidation', q.id, { niveau: niveaux[i] ?? 'solide' }),
      ),
    /** Deux items de l'exercice PR1 réussis, chacun avec l'aide donnée. */
    pratique: (date: string, aides: readonly [Aide, Aide] = [0, 0]): Fait[] =>
      aides.map((aide, i) =>
        fait(apres(date, 0, i), {
          type: 'pratique_resultat',
          exercice: 'PR1',
          item: `PR1-${String(i + 1)}`,
          reussi: true,
          aide,
        }),
      ),
    atelier: (date: string, aide: Aide = 0): Fait =>
      fait(date, { type: 'atelier_resultat', reussi: true, aide }),
    aisance: (date: string, dureeS: number, reussi = true): Fait =>
      fait(date, { type: 'aisance_resultat', reussi, dureeS }),
    etape: (date: string, etape: string): Fait => fait(date, { type: 'etape_vue', etape }),
    ouverture: (date: string): Fait => fait(date, { type: 'bloc_ouvert', horsPrerequis: false }),
    /** Une vérification (ou un retest, ou un entretien) : explication solide, tâche, transfert au niveau donné. */
    verification: (
      date: string,
      options: Partial<{
        verification: TypeVerification
        transfert: Niveau
        tache: boolean
        valable: boolean
        raisonInvalide: string
      }> = {},
    ): Fait =>
      fait(date, {
        type: 'verification_terminee',
        verification: options.verification ?? 'verification',
        valable: options.valable ?? true,
        ...(options.raisonInvalide === undefined ? {} : { raisonInvalide: options.raisonInvalide }),
        reponses: reponses(options.transfert ?? 'solide', options.tache ?? true),
      }),
    cochee: (date: string, erreur: string): Fait =>
      fait(date, { type: 'erreur_cochee', erreur, source: 'amine' }),
    decochee: (date: string, erreur: string): Fait =>
      fait(date, { type: 'erreur_decochee', erreur, source: 'amine' }),
    force: (date: string, statut: Statut, raison: string): Fait =>
      fait(date, { type: 'statut_force', statut, raison }),
    levee: (date: string): Fait => fait(date, { type: 'force_levee' }),
  }
}

/** Fabrique de faits, telle que `fabrique()` la rend. */
export type Fabrique = ReturnType<typeof fabrique>

/** Date d'« acquis provisoirement » de la chronologie type : la fin de la consolidation. */
export const PROVISOIRE = apres(DEBUT, 0, 122)

/**
 * Chronologie type d'un bloc de démonstration jusqu'à « acquis provisoirement » :
 * pratique et atelier à 12 h, restitution à 12 h 30, consolidation 1 h 30 plus tard.
 */
export function jusquaProvisoire(f: Fabrique): Fait[] {
  return [
    ...f.pratique(DEBUT),
    f.atelier(apres(DEBUT, 0, 5)),
    ...f.restitution(apres(DEBUT, 0, 30)),
    ...f.consolidation(apres(DEBUT, 0, 120)),
  ]
}
