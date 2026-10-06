import type { Transport } from '@janus/contrats'
import { ErreurDonnees, ROUTES } from '@janus/contrats'
import type { EntreeEnvoi } from './stockageEnvoi.ts'

/** Lit une partie gardée avec le schéma de sa route ; une entrée abîmée lève `ErreurDonnees`. */
type Problemes = ConstructorParameters<typeof ErreurDonnees>[2]

interface SchemaLu<T> {
  readonly safeParse: (
    valeur: unknown,
  ) =>
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly issues: Problemes } }
}

function lire<T>(schema: SchemaLu<T>, valeur: unknown, route: string): T {
  const lecture = schema.safeParse(valeur)
  if (!lecture.success) throw new ErreurDonnees('entree', route, lecture.error.issues)
  return lecture.data
}

/**
 * Rejoue une entrée de la boîte sur sa route. Le corps et les paramètres gardés sont revalidés par
 * le schéma de la route : une entrée abîmée lève une `ErreurDonnees`, jamais un envoi bancal.
 */
export function appelerEntree(transport: Transport, entree: EntreeEnvoi): Promise<unknown> {
  const { params, corps } = entree
  switch (entree.route) {
    case 'POST /evenements':
      return transport.appeler(ROUTES['POST /evenements'], {
        corps: lire(ROUTES['POST /evenements'].corps, corps, 'POST /evenements'),
      })
    case 'PUT /blocs/:id/etat-page':
      return transport.appeler(ROUTES['PUT /blocs/:id/etat-page'], {
        params: lire(ROUTES['PUT /blocs/:id/etat-page'].params, params, 'PUT /blocs/:id/etat-page'),
        corps: lire(ROUTES['PUT /blocs/:id/etat-page'].corps, corps, 'PUT /blocs/:id/etat-page'),
      })
    case 'POST /corrections':
      return transport.appeler(ROUTES['POST /corrections'], {
        corps: lire(ROUTES['POST /corrections'].corps, corps, 'POST /corrections'),
      })
    case 'POST /blocs/:id/erreurs':
      return transport.appeler(ROUTES['POST /blocs/:id/erreurs'], {
        params: lire(ROUTES['POST /blocs/:id/erreurs'].params, params, 'POST /blocs/:id/erreurs'),
        corps: lire(ROUTES['POST /blocs/:id/erreurs'].corps, corps, 'POST /blocs/:id/erreurs'),
      })
    case 'POST /corrections/:id/accord':
      return transport.appeler(ROUTES['POST /corrections/:id/accord'], {
        params: lire(
          ROUTES['POST /corrections/:id/accord'].params,
          params,
          'POST /corrections/:id/accord',
        ),
        corps: lire(
          ROUTES['POST /corrections/:id/accord'].corps,
          corps,
          'POST /corrections/:id/accord',
        ),
      })
    default:
      return Promise.reject(new Error(`La boîte d'envoi ne sait pas envoyer ${entree.route}.`))
  }
}
