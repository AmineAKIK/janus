/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  readonly __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0]
}

const BASE = import.meta.env.BASE_URL
/** Aujourd'hui : la racine, en adresses à ancre (`#/`) comme en vraies adresses. */
const AUJOURDHUI = import.meta.env.VITE_HISTORIQUE === 'chemins' ? BASE : `${BASE}#/`

// La coque est précachée. Une nouvelle version attend (`waiting`) que l'appli le décide.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

// Les fiches ne changent pas pour une même adresse : la version est dans l'adresse, cache d'abord.
registerRoute(
  ({ url }) => url.pathname.startsWith(`${BASE}fiches/`),
  new CacheFirst({ cacheName: 'fiches' }),
)

// L'API n'a aucune route ici : elle passe toujours par le réseau et n'est jamais mise en cache.
// Hors ligne, toute navigation retombe sur la coque, sauf celle d'un aperçu de PR.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${BASE}index.html`), {
    denylist: [/\/pr-preview\//],
  }),
)

self.addEventListener('message', (evenement) => {
  const donnees: unknown = evenement.data
  if (
    typeof donnees === 'object' &&
    donnees !== null &&
    'type' in donnees &&
    donnees.type === 'SKIP_WAITING'
  ) {
    void self.skipWaiting()
  }
})

// Point d'entrée des notifications (PR-088) : rien n'est encore envoyé.
self.addEventListener('push', () => undefined)

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close()
  evenement.waitUntil(self.clients.openWindow(AUJOURDHUI))
})
