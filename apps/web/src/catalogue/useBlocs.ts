import type { Manque, Statut } from '@janus/contrats'
import { Reglages, ROUTES } from '@janus/contrats'
import { jourDe } from '@janus/moteur'
import { useLecture, useLectures } from '../api/requetes.tsx'
import { instantReel } from '../demo/horlogeDemo.ts'
import { ligneEcheance } from './echeance.ts'
import type { LigneEcheance } from './echeance.ts'

const BASCULE_PAR_DEFAUT = Reglages.parse({}).heureBascule
const ACQUIS_AU_MOINS_PROVISOIRE: readonly Statut[] = [
  'acquis_provisoirement',
  'acquis',
  'maitrise',
]

export interface BlocDeLaListe {
  readonly bloc: string
  readonly titre: string
  readonly partie: string
  readonly statut: Statut
  readonly prerequisManquants: readonly string[]
  /** Les prérequis ne sont pas tous atteints : ouvrir le bloc demandera une raison. */
  readonly grise: boolean
  readonly echeance: LigneEcheance
}

export interface ModuleAffiche {
  readonly formation: { readonly id: string; readonly titre: string }
  readonly module: { readonly id: string; readonly ordre: number; readonly description: string }
}

export type EtatBlocs =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'erreur'; readonly reessayer: () => void }
  | {
      readonly phase: 'pret'
      readonly module: ModuleAffiche | null
      readonly blocs: readonly BlocDeLaListe[]
    }

function enJour(date: string, fuseau: string): string {
  return date.length === 10 ? date : jourDe(date, fuseau, BASCULE_PAR_DEFAUT)
}

function rangEtape(
  etatPage: Readonly<Record<string, unknown>> | undefined,
  etapes: readonly { readonly id: string }[],
) {
  const courante = etatPage?.['etape']
  const index = etapes.findIndex(({ id }) => id === courante)
  return index < 0 ? null : { rang: index + 1, total: etapes.length }
}

/**
 * Les blocs d'un module avec ce que leur carte annonce. La liste donne les statuts ; le détail de
 * chaque bloc donne ce qui manque, les erreurs ouvertes et l'étape où la page s'est arrêtée.
 */
export function useBlocs(moduleId: string): EtatBlocs {
  const moi = useLecture(ROUTES['GET /moi'], {})
  const formations = useLecture(ROUTES['GET /formations'], {})
  const modulesParFormation = useLectures(
    ROUTES['GET /formations/:id/modules'],
    (formations.data?.formations ?? []).map(({ id }) => ({ params: { id } })),
  )
  const liste = useLecture(ROUTES['GET /modules/:id/blocs'], { params: { id: moduleId } })
  const details = useLectures(
    ROUTES['GET /blocs/:id'],
    (liste.data?.blocs ?? []).map(({ bloc }) => ({ params: { id: bloc } })),
  )

  const enErreur = [moi, formations, liste, ...modulesParFormation, ...details].find(
    ({ isError }) => isError,
  )
  if (enErreur !== undefined) return { phase: 'erreur', reessayer: () => void enErreur.refetch() }
  if (
    moi.data === undefined ||
    formations.data === undefined ||
    liste.data === undefined ||
    modulesParFormation.some(({ data }) => data === undefined) ||
    details.some(({ data }) => data === undefined)
  ) {
    return { phase: 'chargement' }
  }

  const fuseau = moi.data.fuseau
  const aujourdhui = jourDe(instantReel(), fuseau, BASCULE_PAR_DEFAUT)
  const statuts = new Map(liste.data.blocs.map(({ bloc, statut }) => [bloc, statut]))

  const formation = formations.data.formations.find((_, index) =>
    modulesParFormation[index]?.data?.modules.some(({ id }) => id === moduleId),
  )
  const module = modulesParFormation
    .flatMap(({ data }) => data?.modules ?? [])
    .find(({ id }) => id === moduleId)

  return {
    phase: 'pret',
    module:
      formation === undefined || module === undefined
        ? null
        : {
            formation: { id: formation.id, titre: formation.titre },
            module: { id: module.id, ordre: module.ordre, description: module.description },
          },
    blocs: liste.data.blocs.map((entree, index) => {
      const detail = details[index]?.data
      const manque: readonly Manque[] = detail?.manque ?? []
      const prerequisManquants = entree.prerequis.filter(
        (code) => !ACQUIS_AU_MOINS_PROVISOIRE.includes(statuts.get(code) ?? 'non_commence'),
      )
      const libelles = new Map(
        (detail?.manifeste.erreurs_critiques ?? []).map(({ id, libelle }) => [id, libelle]),
      )
      return {
        bloc: entree.bloc,
        titre: entree.titre,
        partie: entree.partie,
        statut: entree.statut,
        prerequisManquants,
        grise: detail?.acces === 'raison_requise',
        echeance: ligneEcheance({
          statut: entree.statut,
          manque,
          erreursOuvertes: (detail?.erreurs_ouvertes ?? []).map((id) => libelles.get(id) ?? id),
          etape: rangEtape(detail?.etat_page?.etat, detail?.manifeste.etapes ?? []),
          prerequisManquants,
          aujourdhui,
          enJour: (date) => enJour(date, fuseau),
        }),
      }
    }),
  }
}
