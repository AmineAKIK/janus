import { ROUTES } from '@janus/contrats'
import { composerTableau } from '@janus/moteur'
import { aujourdhuiDemo } from './aujourdhui.ts'
import { blocsImportesDeLaDemo, modulesImportesDeLaDemo } from './calculs.ts'
import { definir } from './definir.ts'

/** Ce que coûte une correction de l'IA dans la démo : un prix de démonstration, pas une règle du cadrage. */
const COUT_CORRECTION_DEMO_MILLIONIEMES = 5_000

export const ROUTES_TABLEAU_DE_BORD_DEMO = [
  definir(ROUTES['GET /tableau-de-bord'], ({ magasin, horloge, requete }) => {
    const etat = magasin.lire()
    const tableau = composerTableau({
      modules: modulesImportesDeLaDemo().map(({ code, titre }) => ({ id: code, titre })),
      module: requete.module,
      periode: requete.periode,
      blocs: blocsImportesDeLaDemo(),
      faits: etat.faits,
      reglages: etat.reglages,
      maintenant: horloge.maintenant(),
      controles: etat.controlesCorrections,
      revuesCartes: etat.revuesCartes,
      mesuresTemps: etat.tempsActif,
      derniereRevue: etat.revuesMethode.at(-1)?.date ?? null,
      couts: etat.faits.flatMap((fait) =>
        fait.type === 'correction'
          ? [{ date: fait.date, millioniemes: COUT_CORRECTION_DEMO_MILLIONIEMES }]
          : [],
      ),
      aujourdhui: aujourdhuiDemo(magasin, horloge),
    })
    // L'interrupteur « plafond atteint » de la démo force la dépense au plafond.
    return etat.interrupteurs.plafondAtteint
      ? {
          ...tableau,
          cout_ia: {
            ...tableau.cout_ia,
            depense_millioniemes: tableau.cout_ia.plafond_millioniemes,
          },
        }
      : tableau
  }),
]
