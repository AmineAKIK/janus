import type { Transport } from '@janus/contrats'
import { ROUTES } from '@janus/contrats'
import type { EntreeEnvoi } from './stockageEnvoi.ts'

/**
 * Rejoue une entrée de la boîte sur sa route. Le corps et les paramètres gardés sont revalidés par
 * le schéma de la route : une entrée abîmée lève une `ErreurDonnees`, jamais un envoi bancal.
 */
export function appelerEntree(transport: Transport, entree: EntreeEnvoi): Promise<unknown> {
  const { params, corps } = entree
  switch (entree.route) {
    case 'POST /evenements':
      return transport.appeler(ROUTES['POST /evenements'], {
        corps: ROUTES['POST /evenements'].corps.parse(corps),
      })
    case 'PUT /blocs/:id/etat-page':
      return transport.appeler(ROUTES['PUT /blocs/:id/etat-page'], {
        params: ROUTES['PUT /blocs/:id/etat-page'].params.parse(params),
        corps: ROUTES['PUT /blocs/:id/etat-page'].corps.parse(corps),
      })
    case 'POST /blocs/:id/erreurs':
      return transport.appeler(ROUTES['POST /blocs/:id/erreurs'], {
        params: ROUTES['POST /blocs/:id/erreurs'].params.parse(params),
        corps: ROUTES['POST /blocs/:id/erreurs'].corps.parse(corps),
      })
    case 'POST /corrections/:id/accord':
      return transport.appeler(ROUTES['POST /corrections/:id/accord'], {
        params: ROUTES['POST /corrections/:id/accord'].params.parse(params),
        corps: ROUTES['POST /corrections/:id/accord'].corps.parse(corps),
      })
    default:
      return Promise.reject(new Error(`La boîte d'envoi ne sait pas envoyer ${entree.route}.`))
  }
}
