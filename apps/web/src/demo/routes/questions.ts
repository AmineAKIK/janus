import { ROUTES } from '@janus/contrats'
import { MANIFESTES_GRAINE } from '../graine.ts'
import type { Magasin } from '../store.ts'
import { contexteDuJour, serieDuJour } from './aujourdhui.ts'
import { definir } from './definir.ts'

interface QuestionTiree {
  readonly bloc: string
  readonly question: string
}

/** La série du jour avec ce qui est déjà répondu. */
function vue(magasin: Magasin, questions: readonly QuestionTiree[], jour: string) {
  const etat = magasin.lire()
  return {
    gardee: true,
    questions: questions.flatMap(({ bloc, question: id }) => {
      const texte = MANIFESTES_GRAINE[bloc]?.rappel.find((question) => question.id === id)
      if (texte === undefined) return []
      const donnee = etat.rappels[id]
      const reponse = donnee?.jour === jour ? donnee : undefined
      return [
        {
          id,
          question: texte.question,
          deja:
            reponse === undefined
              ? null
              : {
                  bloc: reponse.bloc,
                  confiance: reponse.confiance,
                  reponse: reponse.reponse,
                  correction: reponse.correction,
                },
        },
      ]
    }),
  }
}

export const ROUTES_QUESTIONS_DEMO = [
  // Une lecture : rien n'est tiré tant que `POST /questions-debut` n'a pas gardé la série.
  definir(ROUTES['GET /questions-debut'], ({ magasin, horloge }) => {
    const maintenant = horloge.maintenant()
    const jour = contexteDuJour(magasin.lire(), maintenant).jourDu(maintenant)
    const gardee = magasin.lire().serieDuJour
    return gardee?.jour === jour
      ? vue(magasin, gardee.questions, jour)
      : { questions: [], gardee: false }
  }),
  definir(ROUTES['POST /questions-debut'], ({ magasin, horloge }) => {
    const { questions, jour } = serieDuJour(magasin, horloge.maintenant())
    return vue(magasin, questions, jour)
  }),
]
