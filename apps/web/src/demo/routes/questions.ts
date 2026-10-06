import { ROUTES } from '@janus/contrats'
import { MANIFESTES_GRAINE } from '../graine.ts'
import { serieDuJour } from './aujourdhui.ts'
import { definir } from './definir.ts'

export const ROUTES_QUESTIONS_DEMO = [
  definir(ROUTES['GET /questions-debut'], ({ magasin, horloge }) => {
    const etat = magasin.lire()
    const maintenant = horloge.maintenant()
    const { questions, jour } = serieDuJour(magasin, maintenant)
    return {
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
  }),
]
