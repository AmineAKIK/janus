import { ErreurApi, ROUTES } from '@janus/contrats'
import { definir } from './definir.ts'
import { etatVide } from '../store.ts'

/** Tout ce que la démo garde au nom de l'utilisateur, sans les aides de la démo (série du jour, ids reçus). */
export const ROUTES_DONNEES_DEMO = [
  definir(ROUTES['GET /export.json'], ({ magasin, horloge }) => {
    const { faits, reglages, etatsPage, rappels, cartes, verifications } = magasin.lire()
    return {
      version: 1 as const,
      genere_le: horloge.maintenant(),
      donnees: ROUTES['GET /export.json'].reponse.shape.donnees.parse({
        faits,
        reglages,
        etats_page: etatsPage,
        rappels,
        cartes,
        verifications,
      }),
    }
  }),

  definir(ROUTES['DELETE /compte'], ({ magasin, horloge, corps }) => {
    if (corps.mot_de_passe !== magasin.lire().motDePasse) {
      throw new ErreurApi({
        status: 403,
        code: 'refus',
        titre: 'Mot de passe incorrect',
        detail: 'Le mot de passe est incorrect.',
      })
    }
    // Le compte disparaît avec tout ce qu'il contenait : l'appli repart d'un compte vide, à reconnecter.
    magasin.reinitialiser(etatVide(horloge.reel()))
    return null
  }),
]
