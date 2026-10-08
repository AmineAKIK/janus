import { nouvelId, Reglages } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import type { Base } from '../base/base.ts'
import * as t from '../base/schema/index.ts'
import type { Hacheur } from '../domaines/auth/composition.ts'
import type { Horloge } from '../horloge.ts'

const LONGUEUR_MIN = 12
const OCTETS_MAX = 72

export class ErreurCompte extends Error {}

/** Crée un compte : il n'y a pas d'inscription par le web, seulement cette commande sur le serveur. */
export async function creerCompte(
  { base, hacheur, horloge }: { base: Base; hacheur: Hacheur; horloge: Horloge },
  nomUtilisateur: string,
  motDePasse: string,
): Promise<string> {
  const nom = nomUtilisateur.trim()
  if (nom === '') throw new ErreurCompte('Le nom d’utilisateur est vide.')
  if (motDePasse.length < LONGUEUR_MIN) {
    throw new ErreurCompte(
      `Le mot de passe doit faire au moins ${String(LONGUEUR_MIN)} caractères.`,
    )
  }
  if (new TextEncoder().encode(motDePasse).length > OCTETS_MAX) {
    throw new ErreurCompte(`Le mot de passe doit faire ${String(OCTETS_MAX)} octets au plus.`)
  }
  const maintenant = horloge.maintenant()
  const id = nouvelId(instantEnMs(maintenant))
  try {
    await base.db.insert(t.users).values({
      id,
      nomUtilisateur: nom,
      motDePasseHash: await hacheur.hacher(motDePasse),
      reglages: Reglages.parse({}),
      creeLe: maintenant,
    })
  } catch (erreur) {
    const cause = erreur instanceof Error ? erreur.cause : undefined
    if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') {
      throw new ErreurCompte(`Le nom « ${nom} » est déjà pris.`)
    }
    throw erreur
  }
  return id
}
