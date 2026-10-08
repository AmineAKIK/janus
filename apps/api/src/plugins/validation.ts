import { IdUuid } from '@janus/contrats'
import type { FastifyInstance } from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { ErreurProtocole } from '../erreurs.ts'
import type { Dependances } from '../types.ts'

const METHODES_D_ECRITURE = ['POST', 'PUT', 'PATCH', 'DELETE']

/** Entrée et sortie passent par les schémas Zod de `packages/contrats` (fastify-type-provider-zod). */
export function validation(app: FastifyInstance, { observer }: Dependances): void {
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  // Atteint seulement quand l'entrée a passé la validation du schéma de la route.
  app.addHook('preHandler', (_requete, _reponse, fini) => {
    observer?.('validation')
    fini()
  })
}

/** Une route d'écriture doit dire si son corps porte l'identifiant tiré par le client. */
export function exigerDeclarationIdentifiant(app: FastifyInstance): void {
  app.addHook('onRoute', (route) => {
    const ecriture = [route.method].flat().some((methode) => METHODES_D_ECRITURE.includes(methode))
    if (ecriture && route.config?.identifiant === undefined) {
      throw new Error(
        `${String(route.method)} ${route.url} : une route d’écriture déclare config.identifiant (true si son corps porte l’identifiant du client).`,
      )
    }
  })
}

/** Les écritures qui l'ont déclaré portent leur identifiant UUID (idempotence : un doublon est ignoré). */
export function identifiantEcriture(app: FastifyInstance, { observer }: Dependances): void {
  app.addHook('preHandler', (requete, _reponse, fini) => {
    observer?.('identifiant_ecriture')
    if (requete.routeOptions.config.identifiant === true) {
      const corps: unknown = requete.body
      const id = typeof corps === 'object' && corps !== null && 'id' in corps ? corps.id : undefined
      if (!IdUuid.safeParse(id).success) {
        fini(
          new ErreurProtocole(
            400,
            'donnees_invalides',
            'Identifiant manquant',
            'Une écriture porte l’identifiant que le client a tiré (champ id).',
          ),
        )
        return
      }
    }
    fini()
  })
}
