import { ErreurApi, ROUTES } from '@janus/contrats'
import type { Fait, MessagePage } from '@janus/contrats'
import { MANIFESTES_GRAINE } from '../graine.ts'
import {
  accesDuBloc,
  dejaRecu,
  enregistrer,
  faitsDuBloc,
  resultatDuBloc,
  statutBloc,
} from './calculs.ts'
import { definir } from './definir.ts'

function blocInconnu(bloc: string): ErreurApi {
  return new ErreurApi({
    status: 404,
    code: 'introuvable',
    titre: 'Introuvable',
    detail: `Le bloc « ${bloc} » n’existe pas.`,
  })
}

function verifierBloc(bloc: string): void {
  if (!(bloc in MANIFESTES_GRAINE)) throw blocInconnu(bloc)
}

/** Le fait qu'un message de la page fait naître, ou `null` s'il ne change aucun statut. */
function faitDuMessage(message: MessagePage, date: string): Fait | null {
  const commun = { id: message.id, bloc: message.bloc, date }
  switch (message.type) {
    case 'etape.vue':
      return { ...commun, type: 'etape_vue', etape: message.etape }
    case 'pratique.resultat':
      return {
        ...commun,
        type: 'pratique_resultat',
        exercice: message.exercice,
        item: message.item,
        reussi: message.reussi,
        aide: message.aide,
      }
    case 'atelier.resultat':
      return { ...commun, type: 'atelier_resultat', reussi: message.reussi, aide: message.aide }
    case 'aisance.resultat':
      return {
        ...commun,
        type: 'aisance_resultat',
        reussi: message.reussi,
        dureeS: message.duree_s,
      }
    default:
      // Les corrections, les erreurs, l'état de la page... passent par leurs propres routes.
      return null
  }
}

export const ROUTES_BLOCS_DEMO = [
  definir(ROUTES['POST /blocs/:id/ouvrir'], ({ magasin, horloge, params, corps }) => {
    verifierBloc(params.id)
    const maintenant = horloge.maintenant()
    const avant = magasin.lire()
    if (!dejaRecu(avant, corps.id)) {
      const acces = accesDuBloc(avant, params.id, maintenant)
      if (acces === 'raison_requise' && !(corps.hors_prerequis && corps.raison !== undefined)) {
        throw new ErreurApi({
          status: 400,
          code: 'donnees_invalides',
          titre: 'Raison exigée',
          detail: 'Ce bloc a des prérequis pas encore acquis : donne la raison de ton choix.',
        })
      }
      enregistrer(magasin, corps.id, [
        {
          id: corps.id,
          bloc: params.id,
          date: maintenant,
          type: 'bloc_ouvert',
          horsPrerequis: corps.hors_prerequis,
          ...(corps.raison === undefined ? {} : { raison: corps.raison }),
        },
      ])
    }
    const etat = magasin.lire()
    return {
      acces: accesDuBloc(etat, params.id, maintenant),
      ...statutBloc(resultatDuBloc(etat, params.id, maintenant)),
    }
  }),

  definir(ROUTES['POST /blocs/:id/forcer'], ({ magasin, horloge, params, corps }) => {
    verifierBloc(params.id)
    const maintenant = horloge.maintenant()
    if (!dejaRecu(magasin.lire(), corps.id)) {
      const commun = { id: corps.id, bloc: params.id, date: maintenant }
      enregistrer(magasin, corps.id, [
        corps.action === 'forcer'
          ? { ...commun, type: 'statut_force', statut: corps.statut, raison: corps.raison }
          : { ...commun, type: 'force_levee' },
      ])
    }
    const resultat = resultatDuBloc(magasin.lire(), params.id, maintenant)
    return {
      ...statutBloc(resultat),
      force: resultat.force,
      statut_calcule: resultat.statutCalcule,
    }
  }),

  definir(ROUTES['PUT /blocs/:id/etat-page'], ({ magasin, params, corps }) => {
    verifierBloc(params.id)
    // La démo n'a qu'un onglet : l'état n'a qu'une version, 0 tant qu'il n'existe pas, 1 ensuite.
    const actuelle = params.id in magasin.lire().etatsPage ? 1 : 0
    if (corps.version !== actuelle) {
      throw new ErreurApi({
        status: 409,
        code: 'conflit',
        titre: 'Conflit',
        detail: 'L’état de la page a changé depuis ta dernière lecture.',
      })
    }
    magasin.ecrire((etat) => ({
      ...etat,
      etatsPage: { ...etat.etatsPage, [params.id]: corps.etat },
    }))
    return { version: 1 }
  }),

  definir(ROUTES['POST /blocs/:id/erreurs'], ({ magasin, horloge, params, corps }) => {
    verifierBloc(params.id)
    const maintenant = horloge.maintenant()
    const proposition = faitsDuBloc(magasin.lire(), params.id).find(
      (fait) =>
        fait.type === 'correction' &&
        fait.id === corps.correction &&
        fait.erreursIa.includes(corps.erreur),
    )
    if (proposition === undefined) {
      throw new ErreurApi({
        status: 404,
        code: 'introuvable',
        titre: 'Introuvable',
        detail: 'Cette erreur proposée par l’IA n’existe pas.',
      })
    }
    if (!dejaRecu(magasin.lire(), corps.id)) {
      enregistrer(magasin, corps.id, [
        {
          id: corps.id,
          bloc: params.id,
          date: maintenant,
          type: 'erreur_ia_tranchee',
          correction: corps.correction,
          erreur: corps.erreur,
          decision: corps.decision,
        },
      ])
    }
    return statutBloc(resultatDuBloc(magasin.lire(), params.id, maintenant))
  }),

  definir(ROUTES['POST /evenements'], ({ magasin, horloge, corps }) => {
    const maintenant = horloge.maintenant()
    if (corps.type === 'temps.actif') {
      verifierBloc(corps.bloc)
      const doublon = dejaRecu(magasin.lire(), corps.id)
      if (!doublon) {
        enregistrer(magasin, corps.id, [])
        magasin.ecrire((etat) => ({
          ...etat,
          tempsActif: [
            ...etat.tempsActif,
            {
              date: maintenant,
              bloc: corps.bloc,
              secondes: corps.secondes,
              ...(corps.etape === undefined ? {} : { etape: corps.etape }),
            },
          ],
        }))
      }
      return { doublon, statut: null }
    }
    verifierBloc(corps.bloc)
    if (dejaRecu(magasin.lire(), corps.id)) {
      return {
        doublon: true,
        statut: statutBloc(resultatDuBloc(magasin.lire(), corps.bloc, maintenant)),
      }
    }
    let recalcule = false
    if (corps.type === 'bilan.erreurs') {
      const ouvertes = resultatDuBloc(magasin.lire(), corps.bloc, maintenant).erreursOuvertes
      const commun = { bloc: corps.bloc, date: maintenant }
      const cochees: Fait[] = corps.ids
        .filter((erreur) => !ouvertes.includes(erreur))
        .map((erreur) => ({
          ...commun,
          id: `${corps.id}:${erreur}:on`,
          type: 'erreur_cochee',
          erreur,
          source: 'amine',
        }))
      const decochees: Fait[] = ouvertes
        .filter((erreur) => !corps.ids.includes(erreur))
        .map((erreur) => ({
          ...commun,
          id: `${corps.id}:${erreur}:off`,
          type: 'erreur_decochee',
          erreur,
          source: 'amine',
        }))
      enregistrer(magasin, corps.id, [...cochees, ...decochees])
      recalcule = true
    } else {
      const fait = faitDuMessage(corps, maintenant)
      enregistrer(magasin, corps.id, fait === null ? [] : [fait])
      recalcule = fait !== null
    }
    return {
      doublon: false,
      statut: recalcule ? statutBloc(resultatDuBloc(magasin.lire(), corps.bloc, maintenant)) : null,
    }
  }),
]
