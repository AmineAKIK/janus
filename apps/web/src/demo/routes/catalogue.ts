import { ErreurApi, ROUTES } from '@janus/contrats'
import { catalogueGraine, MANIFESTES_GRAINE, PLAN } from '../graine.ts'
import { accesDuBloc, resultatDuBloc, statutBloc } from './calculs.ts'
import { definir } from './definir.ts'

function introuvable(quoi: string, id: string): ErreurApi {
  return new ErreurApi({
    status: 404,
    code: 'introuvable',
    titre: 'Introuvable',
    detail: `${quoi} « ${id} » n’existe pas.`,
  })
}

export interface OptionsCatalogue {
  /** L'adresse (absolue) du dossier des fiches, avec une barre finale. */
  readonly racineFiches: string
}

/** La fiche de démonstration sert tous les blocs : elle prend le bloc et la version dans `etat.init`. */
const FICHE_DEMO = 'demo/fiche-demo.html'

export function routesCatalogueDemo({ racineFiches }: OptionsCatalogue) {
  const catalogue = catalogueGraine()
  const idFormation = catalogue.formation.code

  return [
    definir(ROUTES['GET /formations'], () => ({
      formations: [
        {
          id: idFormation,
          titre: catalogue.formation.titre,
          description: catalogue.formation.description,
        },
      ],
    })),

    definir(ROUTES['GET /formations/:id/modules'], ({ params }) => {
      if (params.id !== idFormation) throw introuvable('La formation', params.id)
      return {
        modules: catalogue.modules.map(({ code, titre, description, ordre, importe }) => ({
          id: code,
          code,
          titre,
          description,
          ordre,
          importe,
        })),
      }
    }),

    definir(ROUTES['GET /modules/:id/blocs'], ({ magasin, horloge, params }) => {
      const module = catalogue.modules.find(({ code }) => code === params.id)
      if (module === undefined) throw introuvable('Le module', params.id)
      if (!module.importe) return { blocs: [] }
      const etat = magasin.lire()
      const maintenant = horloge.maintenant()
      return {
        blocs: module.parties.flatMap((partie) =>
          partie.blocs.flatMap((code) => {
            const manifeste = MANIFESTES_GRAINE[code]
            if (manifeste === undefined) return []
            return [
              {
                bloc: code,
                titre: manifeste.titre,
                titre_court: manifeste.titre_court,
                partie: partie.titre,
                prerequis: manifeste.prerequis,
                statut: resultatDuBloc(etat, code, maintenant).statut,
              },
            ]
          }),
        ),
      }
    }),

    definir(ROUTES['GET /blocs/:id'], ({ magasin, horloge, params }) => {
      const manifeste = MANIFESTES_GRAINE[params.id]
      if (manifeste === undefined || !PLAN.some(({ code }) => code === params.id)) {
        throw introuvable('Le bloc', params.id)
      }
      const etat = magasin.lire()
      const maintenant = horloge.maintenant()
      const resultat = resultatDuBloc(etat, params.id, maintenant)
      const page = etat.etatsPage[params.id]
      return {
        ...statutBloc(resultat),
        bloc: params.id,
        version: manifeste.version,
        manifeste,
        force: resultat.force,
        acces: accesDuBloc(etat, params.id, maintenant),
        fiche_url: `${racineFiches}${FICHE_DEMO}`,
        etat_page: page === undefined ? null : { version: 1, etat: page },
      }
    }),
  ]
}
