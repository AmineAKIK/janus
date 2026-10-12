import { Reglages } from '@janus/contrats'
import type { ModificationReglages } from '@janus/contrats'
import { changerDeFormation } from '../../base/axeTemps.ts'
import type { Base } from '../../base/base.ts'
import { formationActiveDe } from '../../base/formationActive.ts'
import { ErreurProtocole, Introuvable, PreconditionEchouee, Refus } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import type { DepotReglages } from './depot.ts'
import { etagDe, reglagesDonnes, reglesTouchees, versionDeIfMatch } from './policy.ts'

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotReglages
  readonly horloge: Horloge
}

export function creerServiceReglages({ base, depot, horloge }: DependancesService) {
  return {
    async lire(userId: string) {
      const ligne = await depot.lire(base.db, userId)
      if (ligne === undefined) throw new Introuvable('Ce compte n’existe pas.')
      return { reglages: Reglages.parse(ligne.reglages), etag: etagDe(ligne.version) }
    },

    /**
     * Change les réglages donnés, et eux seuls. `If-Match` porte la version lue : si quelqu'un a écrit
     * entre-temps, ou si l'en-tête manque, rien n'est écrit (412).
     */
    async modifier(
      userId: string,
      ifMatch: string | undefined,
      modification: ModificationReglages,
    ) {
      const protegees = reglesTouchees(modification)
      if (protegees.length > 0) {
        throw new Refus(`Les règles de la méthode sont en lecture seule : ${protegees.join(', ')}.`)
      }
      const version = versionDeIfMatch(ifMatch)
      if (version === undefined) {
        throw new PreconditionEchouee('If-Match est obligatoire : relis les réglages.')
      }
      return base.enTransaction(async (tx) => {
        const ligne = await depot.lire(tx, userId)
        if (ligne === undefined) throw new Introuvable('Ce compte n’existe pas.')
        if (ligne.version !== version) throw new PreconditionEchouee('Les réglages ont changé.')
        const formation = modification.formationActive
        if (typeof formation === 'string' && !(await depot.formationExiste(tx, formation))) {
          throw new ErreurProtocole(
            400,
            'donnees_invalides',
            'Données invalides',
            'Cette formation n’existe pas.',
          )
        }
        const anciens = Reglages.parse(ligne.reglages)
        const reglages = Reglages.parse({ ...anciens, ...reglagesDonnes(modification) })
        const suivante = await depot.ecrire(tx, userId, version, reglages)
        if (suivante === undefined) throw new PreconditionEchouee('Les réglages ont changé.')
        // La formation qu'on quitte se gèle, celle qu'on ouvre reprend là où elle s'était arrêtée.
        await changerDeFormation(
          tx,
          userId,
          {
            avant: await formationActiveDe(tx, anciens.formationActive),
            apres: await formationActiveDe(tx, reglages.formationActive),
          },
          horloge.maintenant(),
        )
        return { reglages, etag: etagDe(suivante) }
      })
    },
  }
}
export type ServiceReglages = ReturnType<typeof creerServiceReglages>
