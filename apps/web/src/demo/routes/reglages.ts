import { Reglages, ROUTES } from '@janus/contrats'
import { definir } from './definir.ts'

/** Les réglages : la démo les lit et les modifie, sans toucher à ceux qu'on ne lui envoie pas. */
export const ROUTES_REGLAGES_DEMO = [
  definir(ROUTES['GET /reglages'], ({ magasin }) => magasin.lire().reglages),
  definir(ROUTES['PATCH /reglages'], ({ magasin, corps }) => {
    const reglages = Reglages.parse({ ...magasin.lire().reglages, ...corps })
    magasin.ecrire((etat) => {
      // La série du jour se tire de nouveau avec la nouvelle taille, tant qu'aucune question n'a reçu de réponse.
      const jour = etat.serieDuJour?.jour
      const commencee = Object.values(etat.rappels).some((rappel) => rappel.jour === jour)
      const garder =
        etat.serieDuJour !== null &&
        (commencee || reglages.questionsDebut === etat.reglages.questionsDebut)
      return { ...etat, reglages, serieDuJour: garder ? etat.serieDuJour : null }
    })
    return reglages
  }),
]
