import { CorrectionRecue, Reglages, nouvelId } from '@janus/contrats'
import { instantEnMs, jourDe } from '@janus/moteur'
import { z } from 'zod'
import type { Base } from '../../base/base.ts'
import { lireFaits } from '../../base/faits.ts'
import type { Horloge } from '../../horloge.ts'
import type { DepotRevisions } from './depot.ts'
import { contexteDuJour, tirerQuestionsDuJour } from './policy.ts'

const SerieGardee = z.array(z.strictObject({ bloc: z.string(), question: z.string() }))

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotRevisions
  readonly horloge: Horloge
}

export function creerServiceRevisions({ base, depot, horloge }: DependancesService) {
  return {
    /**
     * La série de début de séance du jour, tirée une seule fois puis gardée : deux appels simultanés
     * rendent la même. Le bloc n'est donné qu'une fois la question corrigée.
     */
    async questionsDebut(userId: string) {
      const maintenant = horloge.maintenant()
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const plan = await depot.blocsDuPlan(base.db)
      const faits = await lireFaits(
        base.db,
        userId,
        plan.map(({ id, code }) => ({ id, code })),
      )
      const contexte = contexteDuJour(plan, faits, reglages, maintenant)

      let gardee: unknown = await depot.serieDuJour(base.db, userId, contexte.jour)
      if (gardee === undefined) {
        const tirees = tirerQuestionsDuJour(contexte, faits, reglages).map(
          ({ bloc, question }) => ({ bloc, question }),
        )
        await base.enTransaction((tx) =>
          depot.garderSerie(tx, {
            id: nouvelId(instantEnMs(maintenant)),
            userId,
            jour: contexte.jour,
            questions: tirees,
            dateServeur: maintenant,
          }),
        )
        // Si une autre requête a gardé sa série avant, c'est la sienne qui fait foi pour tous.
        gardee = await depot.serieDuJour(base.db, userId, contexte.jour)
      }
      const serie = SerieGardee.parse(gardee)

      const blocsDeLaSerie = plan.filter(({ code }) => serie.some(({ bloc }) => bloc === code))
      const rappels = await depot.rappelsDe(
        base.db,
        userId,
        blocsDeLaSerie.map(({ id }) => id),
      )
      const duJour = rappels.filter(
        ({ date }) => jourDe(date, reglages.fuseau, reglages.heureBascule) === contexte.jour,
      )
      return {
        questions: serie.flatMap(({ bloc, question }) => {
          const leBloc = contexte.blocs.find(({ manifeste }) => manifeste.bloc === bloc)
          const texte = leBloc?.manifeste.rappel.find(({ id }) => id === question)
          const idDuBloc = plan.find(({ code }) => code === bloc)?.id
          if (texte === undefined) return []
          const reponses = duJour.filter(
            (ligne) => ligne.blocId === idDuBloc && ligne.questionId === question,
          )
          const premiere = reponses[0]
          const derniere = reponses.at(-1)
          return [
            {
              id: question,
              question: texte.question,
              deja:
                premiere === undefined || derniere === undefined
                  ? null
                  : {
                      bloc,
                      confiance: premiere.confiance,
                      reponse: premiere.reponse,
                      correction: CorrectionRecue.parse({
                        id: derniere.id,
                        echantillon: derniere.echantillon,
                        question,
                        tour: derniere.tour,
                        message: derniere.message,
                        niveau: derniere.niveau,
                        erreurs_critiques: derniere.erreursIds,
                        source: derniere.source,
                        ref: derniere.ref,
                        certitude: derniere.certitude,
                        compte: derniere.compte,
                        ...(derniere.raisonNonCompte === null
                          ? {}
                          : { raison_non_compte: derniere.raisonNonCompte }),
                      }),
                    },
            },
          ]
        }),
      }
    },
  }
}
export type ServiceRevisions = ReturnType<typeof creerServiceRevisions>
