import type { Statut } from '@janus/contrats'
import { ErreurApi, ROUTES } from '@janus/contrats'
import {
  catalogueGraine,
  formationsSupplementairesGraine,
  MANIFESTES_GRAINE,
  PLAN,
} from '../graine.ts'
import { accesDuBloc, preuvesDuBlocApi, resultatDuBloc, statutBloc } from './calculs.ts'
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

/** Ce que rend l'interrupteur « Fiche refusée ». */
const PROBLEMES_DEMO = [
  'Il manque la question de rappel R2.',
  'L’étape ET4 n’a pas de titre.',
  'Deux erreurs critiques portent le même identifiant.',
]

/** Seul le module 1 est importé dans la démo. */
const MODULE_DEMO = 'M1'

/**
 * Les séries que la page propose. Règle de la démo (à confirmer dans la PR) : la restitution tant
 * qu'elle n'est pas faite, la consolidation une fois le bloc vu.
 */
function serieOuverte(statut: Statut) {
  return {
    restitution: statut === 'non_commence' || statut === 'en_cours' || statut === 'a_reprendre',
    consolidation: statut === 'vu',
  }
}

export function routesCatalogueDemo({ racineFiches }: OptionsCatalogue) {
  const catalogue = catalogueGraine()
  const formationsVisibles = (supplementaires: boolean) => [
    catalogue,
    ...(supplementaires ? formationsSupplementairesGraine() : []),
  ]

  return [
    definir(ROUTES['GET /formations'], ({ magasin }) => ({
      formations: formationsVisibles(magasin.lire().interrupteurs.deuxFormations).map(
        ({ formation }) => ({
          id: formation.code,
          titre: formation.titre,
          description: formation.description,
        }),
      ),
    })),

    definir(ROUTES['GET /formations/:id/modules'], ({ magasin, params }) => {
      const trouvee = formationsVisibles(magasin.lire().interrupteurs.deuxFormations).find(
        ({ formation }) => formation.code === params.id,
      )
      if (trouvee === undefined) throw introuvable('La formation', params.id)
      return {
        modules: trouvee.modules.map(({ code, titre, description, ordre, importe }) => ({
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
                partie: `${partie.code} ${partie.titre}`,
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
        module: MODULE_DEMO,
        version: manifeste.version,
        manifeste,
        problemes: etat.interrupteurs.ficheRefusee ? PROBLEMES_DEMO : [],
        serie_ouverte: serieOuverte(resultat.statut),
        force: resultat.force,
        acces: accesDuBloc(etat, params.id, maintenant),
        preuves: preuvesDuBlocApi(resultat, etat.reglages),
        fiche_url: `${racineFiches}${FICHE_DEMO}`,
        etat_page: page === undefined ? null : { version: 1, etat: page },
      }
    }),
  ]
}
