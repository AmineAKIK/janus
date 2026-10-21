import type { CinqPreuves } from '@janus/contrats'
import { formaterDate } from '../format.ts'

export interface LignePreuve {
  readonly cle: 'comprendre' | 'faire_seul' | 'transferer' | 'retenir' | 'aisance'
  readonly libelle: string
  readonly etat: 'prouvee' | 'a_faire' | 'non_requise'
  readonly texte: string
}

const LIBELLES = {
  comprendre: 'Comprendre',
  faire_seul: 'Faire seul',
  transferer: 'Transférer',
  retenir: 'Retenir',
  aisance: 'Aisance',
} as const

const PROCHAINES = {
  verification: 'vérification',
  retest: 'retest',
  entretien: 'entretien',
} as const

const PAS_ENCORE = 'Pas encore'
const DANS_LA_FICHE = 'dans la fiche, à l’étape d’aisance'

function prouvee(date: string, aujourdhui: string): string {
  const texte = formaterDate(date, aujourdhui)
  return texte === 'aujourd’hui' || texte === 'demain' ? `Prouvé ${texte}` : `Prouvé le ${texte}`
}

/**
 * Les cinq lignes du panneau « Cinq preuves ». `enJour` convertit une date du serveur (jour ou
 * instant) en jour « AAAA-MM-JJ » dans le fuseau d'Amine.
 */
export function lignesPreuves(
  preuves: CinqPreuves,
  aujourdhui: string,
  enJour: (date: string) => string,
): readonly LignePreuve[] {
  const simple = (cle: 'comprendre' | 'faire_seul' | 'transferer'): LignePreuve => {
    const preuve = preuves[cle]
    return preuve === null
      ? { cle, libelle: LIBELLES[cle], etat: 'a_faire', texte: PAS_ENCORE }
      : {
          cle,
          libelle: LIBELLES[cle],
          etat: 'prouvee',
          texte: prouvee(enJour(preuve.date), aujourdhui),
        }
  }

  const { retenir, aisance } = preuves
  // Tant que rien n'est prouvé, la ligne dit quand la vérification se présentera dans Aujourd'hui.
  const prochaine = retenir.prochaine
  let suite = ''
  if (prochaine !== null) {
    const quand = formaterDate(enJour(prochaine.apres), aujourdhui)
    const mot = PROCHAINES[prochaine.type]
    suite =
      quand === 'aujourd’hui' || quand === 'demain' ? ` · ${mot} ${quand}` : ` · ${mot} le ${quand}`
  }
  const ligneRetenir: LignePreuve =
    retenir.date === null
      ? { cle: 'retenir', libelle: LIBELLES.retenir, etat: 'a_faire', texte: PAS_ENCORE + suite }
      : {
          cle: 'retenir',
          libelle: LIBELLES.retenir,
          etat: 'prouvee',
          texte: prouvee(enJour(retenir.date), aujourdhui) + suite,
        }

  let ligneAisance: LignePreuve
  if (aisance === 'non_requis') {
    ligneAisance = {
      cle: 'aisance',
      libelle: LIBELLES.aisance,
      etat: 'non_requise',
      texte: 'Non requis',
    }
  } else if (aisance === null) {
    ligneAisance = {
      cle: 'aisance',
      libelle: LIBELLES.aisance,
      etat: 'a_faire',
      texte: `${PAS_ENCORE} · ${DANS_LA_FICHE}`,
    }
  } else {
    ligneAisance = {
      cle: 'aisance',
      libelle: LIBELLES.aisance,
      etat: 'prouvee',
      texte: prouvee(enJour(aisance.date), aujourdhui),
    }
  }

  return [
    simple('comprendre'),
    simple('faire_seul'),
    simple('transferer'),
    ligneRetenir,
    ligneAisance,
  ]
}
