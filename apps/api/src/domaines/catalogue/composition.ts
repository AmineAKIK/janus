import type { FastifyPluginAsync } from 'fastify'
import type { Base } from '../../base/base.ts'
import type { Horloge } from '../../horloge.ts'
import type { Dependances } from '../../types.ts'
import { creerStockage } from './adaptateur.ts'
import { creerControleurCatalogue } from './controleur.ts'
import { creerDepotCatalogue } from './depot.ts'
import { routesCatalogue } from './routes.ts'
import { creerServiceCatalogue, creerServiceLecture } from './service.ts'

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

/** Branche les routes du catalogue : dépôt → service → contrôleur → routes. */
export function monterCatalogue({ base, horloge, config }: Dependances): FastifyPluginAsync {
  const service = creerServiceLecture({
    base,
    depot: creerDepotCatalogue(base),
    horloge,
    fichesUrl: config.FICHES_URL,
  })
  return routesCatalogue(creerControleurCatalogue(service))
}
