import { StatutBloc } from '@janus/contrats'
import type { CinqPreuves, Manifeste, Reglages } from '@janus/contrats'
import { preuvesDuBloc } from '../cartes.ts'
import type { ResultatBloc } from '../statut.ts'

/** Un bloc d'un module importé, avec le manifeste en service. */
export interface BlocImporte {
  readonly code: string
  readonly moduleCode: string
  /** `<code> <titre>` de la partie, vide pour un bloc hors partie. */
  readonly partie: string
  readonly manifeste: Manifeste
}

/** Ce que l'API rend d'un bloc après un fait : son statut, ce qui manque, les erreurs ouvertes, l'avancement. */
export function statutDuBloc(resultat: ResultatBloc): StatutBloc {
  return StatutBloc.parse({
    statut: resultat.statut,
    avancement: {
      etapes_vues: [...resultat.etapesVues],
      restitution: resultat.dates.vu,
      consolidation: resultat.preuves.consolidation,
      pratique: resultat.preuves.pratique,
      atelier: resultat.preuves.atelier,
      aisance: resultat.preuves.aisance,
    },
    manque: resultat.manque.map((manque) => ({
      code: manque.code,
      ...(manque.questions === undefined ? {} : { questions: [...manque.questions] }),
      ...(manque.exercices === undefined ? {} : { exercices: [...manque.exercices] }),
      ...(manque.erreurs === undefined ? {} : { erreurs: [...manque.erreurs] }),
      ...(manque.apres === undefined ? {} : { apres: manque.apres }),
      ...(manque.points === undefined ? {} : { points: manque.points }),
      ...(manque.requis === undefined ? {} : { requis: manque.requis }),
    })),
    erreurs_ouvertes: [...resultat.erreursOuvertes],
  })
}

/** Le panneau « Cinq preuves » tel que l'API le rend. */
export function cinqPreuvesDuBloc(resultat: ResultatBloc, reglages: Reglages): CinqPreuves {
  const preuves = preuvesDuBloc(resultat, reglages)
  return {
    comprendre: preuves.comprendre,
    faire_seul: preuves.faireSeul,
    transferer: preuves.transferer,
    retenir:
      preuves.retenir === null
        ? null
        : {
            date: preuves.retenir.date,
            prochaine:
              preuves.retenir.prochaine === null
                ? null
                : { type: preuves.retenir.prochaine.type, apres: preuves.retenir.prochaine.apres },
          },
    aisance: preuves.aisance,
  }
}
