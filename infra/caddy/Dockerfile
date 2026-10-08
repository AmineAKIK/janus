# Caddy avec le front (transport http, historique par chemins) copié dedans.
#   docker build -f infra/caddy/Dockerfile .   (depuis la racine du dépôt)
FROM node:24-slim AS front
RUN corepack enable
WORKDIR /depot
COPY . .
RUN pnpm install --frozen-lockfile --filter @janus/web...
ENV VITE_BASE=/ VITE_TRANSPORT=http VITE_HISTORIQUE=chemins VITE_API=/api
RUN pnpm --filter @janus/web exec vite build --outDir /front

FROM caddy:2
COPY --from=front /front /srv/app
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
