import type { Manifeste, Reglages, Statut } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { calculerBloc } from '../statut.ts'
import { instantEnMs } from '../temps.ts'

/** Les types de ligne du journal, dans l'ordre des filtres de Figma. */
export const TYPES_JOURNAL = [
  'seance',
  'restitution',
  'consolidation',
  'verification',
  'carte',
  'changement_statut',
  'erreur_critique',
  'contestation',
  'statut_force',
] as const
export type TypeJournal = (typeof TYPES_JOURNAL)[number]

export const LIBELLES_FILTRE_JOURNAL: Readonly<Record<TypeJournal, string>> = {
  seance: 'Séances',
  restitution: 'Restitutions',
  consolidation: 'Consolidations',
  verification: 'Vérifications',
  carte: 'Cartes',
  changement_statut: 'Changements de statut',
  erreur_critique: 'Erreurs critiques',
  contestation: 'Contestations',
  statut_force: 'Statuts forcés',
}

export const LIBELLES_TYPE_JOURNAL: Readonly<Record<TypeJournal, string>> = {
  seance: 'Séance',
  restitution: 'Restitution',
  consolidation: 'Consolidation',
  verification: 'Vérification',
  carte: 'Cartes',
  changement_statut: 'Changement de statut',
  erreur_critique: 'Erreur critique',
  contestation: 'Contestation',
  statut_force: 'Statut forcé',
}

const LIBELLES_STATUT: Readonly<Record<Statut, string>> = {
  non_commence: 'Non commencé',
  en_cours: 'En cours',
  vu: 'Vu',
  acquis_provisoirement: 'Acquis provisoirement',
  acquis: 'Acquis',
  maitrise: 'Maîtrisé',
  a_reprendre: 'À reprendre',
}

const LIBELLES_NON_COMPTE = {
  relance: 'relancée',
  avec_support: 'avec support',
  recopiee: 'collé',
  non_verifiee: 'non vérifiée',
} as const

const TYPES_VERIFICATION = {
  verification: 'Vérification',
  retest: 'Retest',
  entretien: 'Entretien',
} as const

export interface LigneJournal {
  /** L'identifiant du premier fait de la ligne : il ne change pas quand d'autres faits arrivent. */
  readonly id: string
  readonly date: string
  readonly bloc: string
  readonly type: TypeJournal
  /** La phrase de résumé affichée sous « <heure> · <code> · <type> ». */
  readonly resume: string
  /** Ce que la ligne déplie : une phrase par fait. */
  readonly detail: readonly string[]
  /** Uniquement pour une ligne de contestation encore sans tranchage humain postérieur. */
  readonly contestationEnAttente?: boolean
}

export interface ContexteJournal {
  readonly manifestes: Readonly<Record<string, Manifeste | undefined>>
  readonly reglages: Reglages
}

type FaitDe<T extends Fait['type']> = Extract<Fait, { type: T }>

const TYPES_SEANCE = [
  'bloc_ouvert',
  'etape_vue',
  'pratique_resultat',
  'atelier_resultat',
  'aisance_resultat',
] as const
type FaitSeance = FaitDe<(typeof TYPES_SEANCE)[number]>
const estSeance = (fait: Fait): fait is FaitSeance =>
  (TYPES_SEANCE as readonly string[]).includes(fait.type)

const pluriel = (n: number, singulier: string, plurielTexte: string) =>
  `${String(n)} ${n < 2 ? singulier : plurielTexte}`

const jourUtc = (instant: string) => instant.slice(0, 10)
const parDate = (a: Fait, b: Fait) => instantEnMs(a.date) - instantEnMs(b.date)

/** Le résumé et le détail des faits d'une séance de travail sur un bloc. */
export function ligneSeance(faits: readonly FaitSeance[]): Pick<LigneJournal, 'resume' | 'detail'> {
  const ouvert = faits.find((fait) => fait.type === 'bloc_ouvert')
  const etapes = faits.filter((fait) => fait.type === 'etape_vue').length
  const pratique = faits.filter(
    (fait): fait is FaitDe<'pratique_resultat'> => fait.type === 'pratique_resultat',
  )
  const ateliers = faits.filter(
    (fait): fait is FaitDe<'atelier_resultat'> => fait.type === 'atelier_resultat',
  )
  const aisances = faits.filter(
    (fait): fait is FaitDe<'aisance_resultat'> => fait.type === 'aisance_resultat',
  )
  const parties: string[] = []
  if (ouvert?.type === 'bloc_ouvert') {
    parties.push(ouvert.horsPrerequis ? 'ouvert sans les prérequis' : 'bloc ouvert')
  }
  if (etapes > 0) parties.push(pluriel(etapes, 'étape vue', 'étapes vues'))
  if (pratique.length > 0) {
    const reussis = pratique.filter(({ reussi }) => reussi).length
    parties.push(
      `${String(reussis)} sur ${pluriel(pratique.length, 'exercice réussi', 'exercices réussis')}`,
    )
  }
  for (const atelier of ateliers) {
    parties.push(atelier.reussi ? 'atelier réussi' : 'atelier à reprendre')
  }
  for (const aisance of aisances) {
    parties.push(aisance.reussi ? 'aisance atteinte' : 'aisance pas encore atteinte')
  }
  const detail = faits.map((fait) => {
    switch (fait.type) {
      case 'bloc_ouvert':
        return fait.raison === undefined ? 'Bloc ouvert' : `Bloc ouvert · Raison : ${fait.raison}`
      case 'etape_vue':
        return `Étape ${fait.etape} vue`
      case 'pratique_resultat':
        return `${fait.item} · ${fait.reussi ? 'réussi' : 'raté'} · aide ${String(fait.aide)}`
      case 'atelier_resultat':
        return `Atelier · ${fait.reussi ? 'réussi' : 'à reprendre'} · aide ${String(fait.aide)}`
      case 'aisance_resultat':
        return `Aisance · ${fait.reussi ? 'réussie' : 'pas encore'} · ${String(Math.round(fait.dureeS))} s`
    }
  })
  return { resume: parties.join(' · '), detail }
}

/** Le résumé d'une série de corrections : combien comptent, pourquoi les autres non, et le statut. */
export function ligneSerie(
  corrections: readonly FaitDe<'correction'>[],
  statutAvant: Statut,
  statutApres: Statut,
): Pick<LigneJournal, 'resume' | 'detail'> {
  const comptees = corrections.filter(({ compte }) => compte).length
  const autres = corrections.filter(({ compte }) => !compte)
  const parties = [`${String(comptees)} sur ${String(corrections.length)} comptées`]
  const raisons = [
    ...new Set(
      autres.flatMap(({ raisonNonCompte }) =>
        raisonNonCompte === undefined ? [] : [LIBELLES_NON_COMPTE[raisonNonCompte]],
      ),
    ),
  ]
  if (autres.length > 0) {
    const suite = raisons.length > 0 ? ` (${raisons.join(', ')})` : ''
    parties.push(`${String(autres.length)} ne compte pas${suite}`)
  }
  if (statutAvant === statutApres) parties.push('statut inchangé')
  return {
    resume: parties.join(' · '),
    detail: corrections.map(
      (correction) =>
        `${correction.question} · ${correction.niveau}${correction.compte ? '' : ' · ne compte pas'}`,
    ),
  }
}

function ligneVerification(
  fait: FaitDe<'verification_terminee'>,
): Pick<LigneJournal, 'resume' | 'detail'> {
  const comptees = fait.reponses.filter(({ compte }) => compte).length
  const parties = [
    TYPES_VERIFICATION[fait.verification],
    fait.valable
      ? `${String(comptees)} sur ${String(fait.reponses.length)} comptées`
      : 'non valable',
  ]
  if (fait.raisonInvalide !== undefined) parties.push(fait.raisonInvalide)
  return {
    resume: parties.join(' · '),
    detail: fait.reponses.map(
      (reponse) =>
        `${reponse.question} · ${reponse.type}${reponse.compte ? '' : ' · ne compte pas'}`,
    ),
  }
}

interface Groupe {
  readonly type: 'seance' | 'restitution' | 'consolidation'
  readonly id: string
  readonly avant: Statut
  apres: Statut
  date: string
  readonly faits: Fait[]
}

/** Le type de ligne qui regroupe ce fait avec ceux du même jour, `null` s'il a sa propre ligne. */
function typeDeGroupe(fait: Fait): Groupe['type'] | null {
  if (estSeance(fait)) return 'seance'
  if (
    fait.type === 'correction' &&
    (fait.serie === 'restitution' || fait.serie === 'consolidation')
  ) {
    return fait.serie
  }
  return null
}

/**
 * Toutes les lignes du journal depuis les faits, les plus récentes d'abord. Le type « Cartes »
 * n'a pas encore de fait qui le porte : il existe comme filtre, sans ligne.
 */
export function lignesDuJournal(faits: readonly Fait[], contexte: ContexteJournal): LigneJournal[] {
  const lignes: LigneJournal[] = []
  const blocs = [...new Set(faits.map(({ bloc }) => bloc))]

  for (const bloc of blocs) {
    const faitsDuBloc = faits.filter((fait) => fait.bloc === bloc).sort(parDate)
    const manifeste = contexte.manifestes[bloc]
    const libelleErreur = (id: string) =>
      manifeste?.erreurs_critiques.find((erreur) => erreur.id === id)?.libelle ?? id
    // Le statut calculé avant et après chaque fait : il sert aux séries et aux changements de statut.
    const suivi: { fait: Fait; avant: Statut; apres: Statut }[] = []
    let precedent: Statut = 'non_commence'
    for (const fait of faitsDuBloc) {
      const apres: Statut =
        manifeste === undefined
          ? precedent
          : calculerBloc(
              faitsDuBloc.slice(0, suivi.length + 1),
              manifeste,
              contexte.reglages,
              fait.date,
            ).statutCalcule
      suivi.push({ fait, avant: precedent, apres })
      if (apres !== precedent) {
        lignes.push({
          id: `statut-${fait.id}`,
          date: fait.date,
          bloc,
          type: 'changement_statut',
          resume: `${LIBELLES_STATUT[precedent]} → ${LIBELLES_STATUT[apres]}`,
          detail: [],
        })
      }
      precedent = apres
    }

    const groupes = new Map<string, Groupe>()
    for (const { fait, avant, apres } of suivi) {
      const type = typeDeGroupe(fait)
      if (type === null) continue
      const cle = `${type}|${jourUtc(fait.date)}`
      const groupe = groupes.get(cle)
      if (groupe === undefined) {
        groupes.set(cle, { type, id: fait.id, avant, apres, date: fait.date, faits: [fait] })
      } else {
        groupe.apres = apres
        groupe.date = fait.date
        groupe.faits.push(fait)
      }
    }
    for (const { type, id, avant, apres, date, faits: membres } of groupes.values()) {
      const corps =
        type === 'seance'
          ? ligneSeance(membres.filter(estSeance))
          : ligneSerie(
              membres.filter((fait): fait is FaitDe<'correction'> => fait.type === 'correction'),
              avant,
              apres,
            )
      lignes.push({ id, date, bloc, type, ...corps })
    }

    for (const fait of faitsDuBloc) {
      const commun = { id: fait.id, date: fait.date, bloc }
      switch (fait.type) {
        case 'verification_terminee':
          lignes.push({ ...commun, type: 'verification', ...ligneVerification(fait) })
          break
        case 'erreur_cochee':
        case 'erreur_decochee': {
          const source = fait.source === 'amine' ? 'par toi' : 'repérée par l’IA, confirmée'
          lignes.push({
            ...commun,
            type: 'erreur_critique',
            resume: `${libelleErreur(fait.erreur)} · ${fait.type === 'erreur_cochee' ? 'cochée' : 'décochée'} ${source}`,
            detail: [],
          })
          break
        }
        case 'correction_contestee': {
          const correction = faitsDuBloc.find(
            (candidat): candidat is FaitDe<'correction'> =>
              candidat.type === 'correction' && candidat.id === fait.correction,
          )
          const position = faitsDuBloc.indexOf(fait)
          const trancheeApres = faitsDuBloc
            .slice(position + 1)
            .some(
              (candidat) =>
                candidat.type === 'correction_tranchee' && candidat.correction === fait.correction,
            )
          lignes.push({
            ...commun,
            type: 'contestation',
            resume:
              correction === undefined
                ? 'Correction contestée'
                : `${correction.question} · correction contestée`,
            detail:
              correction === undefined
                ? []
                : [
                    `${correction.question} · ${correction.niveau}`,
                    'Une contestation ne change jamais le niveau, elle part en revue humaine.',
                  ],
            contestationEnAttente: !trancheeApres,
          })
          break
        }
        case 'statut_force':
          lignes.push({
            ...commun,
            type: 'statut_force',
            resume: `Forcé à ${LIBELLES_STATUT[fait.statut]} · Raison : ${fait.raison}`,
            detail: [],
          })
          break
        case 'force_levee':
          lignes.push({
            ...commun,
            type: 'statut_force',
            resume: 'Retour au statut calculé',
            detail: [],
          })
          break
        default:
          break
      }
    }
  }
  return lignes.sort((a, b) => instantEnMs(b.date) - instantEnMs(a.date) || (a.id < b.id ? -1 : 1))
}

export interface FiltreJournal {
  readonly bloc?: string
  readonly type?: TypeJournal
  /** Seules les lignes strictement avant cet instant. */
  readonly avant?: string
}

export const TAILLE_PAGE_JOURNAL = 50

export interface PageJournal {
  readonly lignes: readonly LigneJournal[]
  /** L'instant à passer en `avant` pour la page suivante, `null` à la fin. */
  readonly suivant: string | null
}

/**
 * Filtre puis coupe en pages de 50. La page ne s'arrête jamais au milieu de lignes de même
 * instant : celles qui suivent la 50e et partagent son instant sont gardées, sinon la page
 * suivante, qui commence strictement avant, les perdrait.
 */
export function pageDuJournal(lignes: readonly LigneJournal[], filtre: FiltreJournal): PageJournal {
  const retenues = lignes.filter(
    (ligne) =>
      (filtre.bloc === undefined || ligne.bloc === filtre.bloc) &&
      (filtre.type === undefined || ligne.type === filtre.type) &&
      (filtre.avant === undefined || instantEnMs(ligne.date) < instantEnMs(filtre.avant)),
  )
  if (retenues.length <= TAILLE_PAGE_JOURNAL) return { lignes: retenues, suivant: null }
  const limite = retenues
    .slice(0, TAILLE_PAGE_JOURNAL)
    .reduce((_, ligne) => instantEnMs(ligne.date), 0)
  const page = retenues.filter(
    (ligne, rang) => rang < TAILLE_PAGE_JOURNAL || instantEnMs(ligne.date) === limite,
  )
  const suivantes = retenues.length > page.length
  return {
    lignes: page,
    suivant: suivantes ? page.reduce<string | null>((_, ligne) => ligne.date, null) : null,
  }
}
