import type { Fait, Statut } from '@janus/contrats'
import type { EtatDemo } from '@janus/contrats/demo'
import { accesBloc, calculerBloc } from '@janus/moteur'
import type { BlocImporte, ResultatBloc } from '@janus/moteur'
import { catalogueGraine, MANIFESTES_GRAINE } from '../graine.ts'
import type { Magasin } from '../store.ts'

/** Les faits d'un bloc, tels que le store les a gardés. */
export const faitsDuBloc = (etat: EtatDemo, bloc: string) =>
  etat.faits.filter((fait) => fait.bloc === bloc)

/** Les modules importés de la graine, comme l'API les liste. */
export const modulesImportesDeLaDemo = () =>
  catalogueGraine().modules.flatMap((module) => (module.importe ? [module] : []))

/** Les blocs des modules importés, avec leur partie et leur manifeste, comme l'API les compose. */
export const blocsImportesDeLaDemo = (): BlocImporte[] =>
  modulesImportesDeLaDemo().flatMap((module) =>
    module.parties.flatMap((partie) =>
      partie.blocs.flatMap((code) => {
        const manifeste = MANIFESTES_GRAINE[code]
        return manifeste === undefined
          ? []
          : [{ code, moduleCode: module.code, partie: `${partie.code} ${partie.titre}`, manifeste }]
      }),
    ),
  )

/** Le statut d'un bloc, toujours recalculé par le moteur depuis ses faits, jamais écrit à la main. */
export function resultatDuBloc(etat: EtatDemo, bloc: string, maintenant: string): ResultatBloc {
  const manifeste = MANIFESTES_GRAINE[bloc]
  if (manifeste === undefined) throw new Error(`Bloc inconnu : ${bloc}`)
  return calculerBloc(faitsDuBloc(etat, bloc), manifeste, etat.reglages, maintenant)
}

/** Libre si tous les prérequis du bloc sont au moins « acquis provisoirement », sinon une raison est exigée. */
export function accesDuBloc(etat: EtatDemo, bloc: string, maintenant: string) {
  const prerequis = MANIFESTES_GRAINE[bloc]?.prerequis ?? []
  const statuts: Statut[] = prerequis.map((code) => resultatDuBloc(etat, code, maintenant).statut)
  return accesBloc(statuts)
}

/** Vrai si le serveur a déjà reçu cet identifiant : rien n'est alors enregistré deux fois. */
export const dejaRecu = (etat: EtatDemo, id: string): boolean => etat.idsRecus.includes(id)

/** Enregistre des faits et retient l'identifiant du message qui les a produits. */
export function enregistrer(magasin: Magasin, id: string, faits: readonly Fait[]): void {
  magasin.ecrire((etat) => ({
    ...etat,
    idsRecus: [...etat.idsRecus, id],
    faits: [...etat.faits, ...faits],
  }))
}
