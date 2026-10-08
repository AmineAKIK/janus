# Image de l'API. Le contexte de construction est la racine du dépôt :
#   docker build -f apps/api/Dockerfile .
#
# L'API tourne sur ses sources TypeScript (Node retire les types). Node refuse de le faire sous
# `node_modules`, or `pnpm deploy` y copie les paquets du dépôt : on garde donc la disposition du
# dépôt, où `node_modules/@janus/*` pointe vers `packages/*`.
FROM node:24-slim AS construction
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contrats/package.json packages/contrats/
COPY packages/moteur/package.json packages/moteur/
RUN pnpm install --frozen-lockfile --prod --filter @janus/api...
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
COPY packages/contrats/src packages/contrats/src
COPY packages/contrats/fixtures packages/contrats/fixtures
COPY packages/moteur/src packages/moteur/src
COPY prompts prompts

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=construction --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node", "src/demarrer.ts"]
