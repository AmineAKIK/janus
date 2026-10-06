import { ErreurApi, ROUTES } from '@janus/contrats'
import type { SortieRoute } from '@janus/contrats'
import { apercuCarte, carteNeuve, noterCarte } from '@janus/moteur'
import { MANIFESTES_GRAINE } from '../graine.ts'
import { cartesDuJourDemo } from './aujourdhui.ts'
import { dejaRecu, enregistrer } from './calculs.ts'
import { definir } from './definir.ts'

/** Le recto et le verso d'une carte du manifeste, retrouvés par son identifiant `<bloc>:<carte>`. */
function texteDeLaCarte(id: string): { bloc: string; recto: string; verso: string } | null {
  const [bloc = '', carte = ''] = id.split(':')
  const trouvee = MANIFESTES_GRAINE[bloc]?.cartes.find((autre) => autre.id === carte)
  return trouvee === undefined ? null : { bloc, recto: trouvee.recto, verso: trouvee.verso }
}

export const ROUTES_CARTES_DEMO = [
  definir(ROUTES['GET /cartes/dues'], ({ magasin, horloge }) => {
    const etat = magasin.lire()
    const maintenant = horloge.maintenant()
    const { dues, nouvelles } = cartesDuJourDemo(etat, maintenant)
    type Carte = SortieRoute<(typeof ROUTES)['GET /cartes/dues']>['dues'][number]
    const carte = (id: string, nouvelle: boolean): Carte[] => {
      const texte = texteDeLaCarte(id)
      if (texte === null) return []
      return [
        {
          id,
          bloc: texte.bloc,
          recto: texte.recto,
          verso: texte.verso,
          nouvelle,
          apercu: apercuCarte(etat.cartes[id] ?? null, maintenant, etat.reglages),
        },
      ]
    }
    const prochaines = Object.values(etat.cartes)
      .map(({ echeance }) => echeance)
      .filter((echeance) => echeance > maintenant)
      .sort()
    return {
      dues: dues.flatMap((id) => carte(id, false)),
      nouvelles: nouvelles.flatMap((id) => carte(id, true)),
      prochaine: prochaines[0] ?? null,
    }
  }),

  definir(ROUTES['POST /cartes/:id/note'], ({ magasin, horloge, params, corps }) => {
    const maintenant = horloge.maintenant()
    if (texteDeLaCarte(params.id) === null) {
      throw new ErreurApi({
        status: 404,
        code: 'introuvable',
        titre: 'Introuvable',
        detail: `La carte « ${params.id} » n’existe pas.`,
      })
    }
    if (!dejaRecu(magasin.lire(), corps.id)) {
      enregistrer(magasin, corps.id, [])
      magasin.ecrire((etat) => ({
        ...etat,
        cartes: {
          ...etat.cartes,
          [params.id]: noterCarte(
            etat.cartes[params.id] ?? carteNeuve(maintenant),
            corps.note,
            maintenant,
            etat.reglages,
          ),
        },
      }))
    }
    return { echeance: magasin.lire().cartes[params.id]?.echeance ?? maintenant }
  }),
]
