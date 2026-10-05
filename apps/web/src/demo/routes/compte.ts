import { ErreurApi, ROUTES } from '@janus/contrats'
import { instantEnIso, instantEnMs } from '@janus/moteur'
import { definir } from './definir.ts'

/** L'identifiant et le mot de passe de la démo, affichés dans le bandeau « Démo » de la connexion. */
export const IDENTIFIANT_DEMO = 'amine'
export const MOT_DE_PASSE_DEMO = 'demo-janus'

/** Cinq échecs en une minute bloquent la connexion pendant une minute. */
const ECHECS_AVANT_BLOCAGE = 5
const FENETRE_MS = 60_000
const BLOCAGE_MS = 60_000

function tropDEssais(secondes: number): ErreurApi {
  return new ErreurApi({
    status: 429,
    code: 'trop_de_requetes',
    titre: 'Trop d’essais',
    detail: `Trop d’échecs de connexion. Réessaie dans ${String(secondes)} secondes.`,
    retryAfter: secondes,
  })
}

export const ROUTES_COMPTE_DEMO = [
  definir(ROUTES['POST /session'], ({ magasin, horloge, corps }) => {
    const maintenant = horloge.maintenant()
    const ms = instantEnMs(maintenant)
    const bloquee = magasin.lire().connexionBloqueeJusqua
    if (bloquee !== null && instantEnMs(bloquee) > ms) {
      throw tropDEssais(Math.ceil((instantEnMs(bloquee) - ms) / 1000))
    }

    if (corps.nom_utilisateur === IDENTIFIANT_DEMO && corps.mot_de_passe === MOT_DE_PASSE_DEMO) {
      magasin.ecrire((etat) => ({
        ...etat,
        sessionOuverte: true,
        echecsConnexion: [],
        connexionBloqueeJusqua: null,
      }))
      const { id, nom_utilisateur, fuseau } = magasin.lire().utilisateur
      return { id, nom_utilisateur, fuseau }
    }

    const recents = magasin
      .lire()
      .echecsConnexion.filter((date) => ms - instantEnMs(date) < FENETRE_MS)
    const echecs = [...recents, maintenant]
    const bloque = echecs.length >= ECHECS_AVANT_BLOCAGE
    magasin.ecrire((etat) => ({
      ...etat,
      echecsConnexion: bloque ? [] : echecs,
      connexionBloqueeJusqua: bloque ? instantEnIso(ms + BLOCAGE_MS) : null,
    }))
    if (bloque) throw tropDEssais(BLOCAGE_MS / 1000)
    throw new ErreurApi({
      status: 401,
      code: 'non_authentifie',
      titre: 'Identifiants incorrects',
      detail: 'Le nom d’utilisateur ou le mot de passe est incorrect.',
    })
  }),

  definir(ROUTES['DELETE /session'], ({ magasin }) => {
    magasin.ecrire((etat) => ({ ...etat, sessionOuverte: false }))
    return null
  }),

  definir(ROUTES['GET /moi'], ({ magasin }) => {
    const { id, nom_utilisateur, fuseau } = magasin.lire().utilisateur
    return { id, nom_utilisateur, fuseau }
  }),
]
