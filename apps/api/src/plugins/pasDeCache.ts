import type { FastifyInstance } from 'fastify'

/**
 * Aucune réponse de l'API ne se garde dans un cache (navigateur, proxy) : elles portent les données
 * d'un utilisateur connecté. Une route qui pose son propre `Cache-Control` garde le sien.
 */
export function pasDeCache(app: FastifyInstance): void {
  app.addHook('onSend', (_requete, reponse, _contenu, fini) => {
    if (!reponse.hasHeader('cache-control')) void reponse.header('cache-control', 'no-store')
    fini()
  })
}
