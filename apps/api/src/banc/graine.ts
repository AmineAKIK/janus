import { readFile } from 'node:fs/promises'
import {
  catalogueGraine,
  MANIFESTES_GRAINE,
  nouvelId,
  PLAN_GRAINE,
  Reglages,
} from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import { eq } from 'drizzle-orm'
import type { Base } from '../base/base.ts'
import * as t from '../base/schema/index.ts'
import { creerHacheur } from '../domaines/auth/composition.ts'
import { monterImportation } from '../domaines/catalogue/composition.ts'
import type { Horloge } from '../horloge.ts'

/** Le compte de la démo : la suite de contrat s'y connecte comme elle le fait sur le faux serveur. */
export const UTILISATEUR_BANC = 'amine'
export const MOT_DE_PASSE_BANC = 'demo-janus'

const FICHE_MODELE = new URL('../../../web/public/fiches/demo/fiche-demo.html', import.meta.url)

/** La fiche de démonstration, avec le manifeste d'un autre bloc. */
function ficheDuBloc(modele: string, manifeste: unknown): string {
  const json = JSON.stringify(manifeste).replaceAll('<', '\\u003c')
  return modele.replace(
    /(<script\b[^>]*\bid="manifeste"[^>]*>)[\s\S]*?(<\/script>)/,
    (_, ouverture: string, fermeture: string) => `${ouverture}${json}${fermeture}`,
  )
}

/**
 * Remplit une base neuve comme la graine de la démo : la formation et ses 20 blocs, une fiche par
 * bloc, et le compte `amine`. Sans effet si le compte existe déjà.
 */
export async function planterLaGraine(base: Base, horloge: Horloge, dossierFiches: string) {
  const existant = await base.db
    .select({ id: t.users.id })
    .from(t.users)
    .where(eq(t.users.nomUtilisateur, UTILISATEUR_BANC))
  if (existant.length > 0) return
  const maintenant = horloge.maintenant()
  await base.db.insert(t.users).values({
    id: nouvelId(instantEnMs(maintenant)),
    nomUtilisateur: UTILISATEUR_BANC,
    motDePasseHash: await creerHacheur(4).hacher(MOT_DE_PASSE_BANC),
    reglages: Reglages.parse({}),
    creeLe: maintenant,
  })
  const importation = monterImportation(base, horloge, dossierFiches)
  await importation.importerCatalogue(catalogueGraine())
  const modele = await readFile(FICHE_MODELE, 'utf8')
  for (const { code } of PLAN_GRAINE) {
    await importation.importerFiche(ficheDuBloc(modele, MANIFESTES_GRAINE[code]))
  }
}
