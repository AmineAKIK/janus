import { NoteCarte, Reglages } from '@janus/contrats'
import type { Periode } from '@janus/moteur'
import { instantEnIso, instantEnMs } from '@janus/moteur'
import type { Base } from '../../base/base.ts'
import { lireFaits } from '../../base/faits.ts'
import type { Horloge } from '../../horloge.ts'
import type { LireAujourdhui } from '../../types.ts'
import type { DepotSuivi } from './depot.ts'
import { composerTableau, controlesDe, mesuresDeTemps } from './policy.ts'

const JOUR_MS = 86_400_000
/** Le mois en cours tient dans les 45 derniers jours, quelle que soit la bascule. */
const HISTORIQUE_DES_COUTS_JOURS = 45

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotSuivi
  readonly horloge: Horloge
  readonly aujourdhui: LireAujourdhui
}

export function creerServiceSuivi({ base, depot, horloge, aujourdhui }: DependancesService) {
  return {
    /** Le tableau de bord, calculé à la lecture : rien n'est gardé. */
    async tableauDeBord(
      userId: string,
      requete: { module?: string | undefined; periode?: Periode | undefined },
    ) {
      const maintenant = horloge.maintenant()
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const [modules, blocs] = await Promise.all([
        depot.modulesImportes(base.db),
        depot.blocsImportes(base.db),
      ])
      const faits = await lireFaits(
        base.db,
        userId,
        blocs.map(({ id, code }) => ({ id, code })),
      )
      const codes = new Map(blocs.map(({ id, code }) => [id, code]))
      const codeDuModule = new Map(modules.map(({ id, code }) => [id, code]))
      const [corrections, avis, revuesCartes, temps, derniereRevue, couts, jour] =
        await Promise.all([
          depot.correctionsRendues(base.db, userId),
          depot.avisSurCorrections(base.db, userId),
          depot.notesDeCartes(base.db, userId),
          depot.tempsActif(
            base.db,
            userId,
            blocs.map(({ id }) => id),
          ),
          depot.derniereRevueDeLaMethode(base.db, userId),
          depot.coutsDepuis(
            base.db,
            userId,
            instantEnIso(instantEnMs(maintenant) - HISTORIQUE_DES_COUTS_JOURS * JOUR_MS),
          ),
          aujourdhui(userId),
        ])
      return composerTableau({
        modules: modules.map(({ code, titre }) => ({ id: code, titre })),
        module: requete.module,
        periode: requete.periode,
        blocs: blocs.map(({ code, moduleId, partieCode, partieTitre, manifeste }) => ({
          code,
          moduleCode: codeDuModule.get(moduleId) ?? moduleId,
          partie: partieCode === null ? '' : `${partieCode} ${partieTitre ?? ''}`.trim(),
          manifeste,
        })),
        faits,
        reglages,
        maintenant,
        controles: controlesDe(corrections, avis),
        revuesCartes: revuesCartes.flatMap(({ date, note }) => {
          const lue = NoteCarte.safeParse(note)
          return lue.success ? [{ date, note: lue.data }] : []
        }),
        mesuresTemps: mesuresDeTemps(temps, codes),
        derniereRevue,
        couts,
        aujourdhui: jour,
      })
    },
  }
}
export type ServiceSuivi = ReturnType<typeof creerServiceSuivi>
