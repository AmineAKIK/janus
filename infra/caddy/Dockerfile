# L'image web de l'hébergement du VPS : Caddy, sa configuration et le front (transport http, historique par chemins).
#   docker build -f infra/caddy/Dockerfile .   (depuis la racine du dépôt)
FROM node:24-slim AS front
RUN corepack enable
WORKDIR /depot
COPY . .
RUN pnpm install --frozen-lockfile --filter @janus/web...
ARG VITE_SENTRY_DSN=
ARG VITE_COMMIT=
ENV VITE_BASE=/ VITE_TRANSPORT=http VITE_HISTORIQUE=chemins VITE_API=/api
RUN pnpm --filter @janus/web exec vite build --outDir /front
# Chaque fichier texte est aussi gardé en brotli : Caddy le sert tel quel (`precompressed br`), sans recompresser.
RUN node infra/caddy/precompresser.js /front

FROM caddy:2
COPY --from=front /front /srv/app
# La configuration de Caddy vit avec l'hebergement et part dans l'image : elle suit le SHA deploye.
COPY deploy/vps/Caddyfile /etc/caddy/Caddyfile
