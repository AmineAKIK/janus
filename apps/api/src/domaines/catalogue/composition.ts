import type { Base } from '../../base/base.ts'
import type { Horloge } from '../../horloge.ts'
import { creerStockage } from './adaptateur.ts'
import { creerDepotCatalogue } from './depot.ts'
import { creerServiceCatalogue } from './service.ts'

export { ErreurImport } from './service.ts'
export type { FicheImportee } from './service.ts'

/** Branche l'import du catalogue : dépôt et stockage dans le service. */
export function monterImportation(base: Base, horloge: Horloge, dossierFiches: string) {
  return creerServiceCatalogue({
    depot: creerDepotCatalogue(base),
    stockage: creerStockage(dossierFiches),
    horloge,
  })
}
