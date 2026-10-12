# Janus

Janus est une appli d'apprentissage : chaque bloc d'une formation se travaille avec une fiche, des questions de restitution et des preuves qui font évoluer son statut. Elle programme ensuite les vérifications, les révisions et les rappels au bon moment. Le code est écrit entièrement par des IA, ticket après ticket, et relu par Amine.

## Documents

- [Cadrage de l'appli](https://claude.ai/code/artifact/5409816a-406a-4d96-81a2-ae8461b6ad31)
- [Architecture technique](https://claude.ai/code/artifact/7fbc288e-336f-4729-b554-4e5158fe7c83)
- [Backlog](https://claude.ai/code/artifact/c5ceabc7-e9dd-452d-b48d-bb9ac0f1f021) et [tickets Linear](https://linear.app/amineakik/project/janus-bebc61cb3a5c)
- [Maquettes Figma](https://www.figma.com/design/VhGXcHKlzhx9GYEmu2eVWg/Janus)
- Règles pour les IA : [AGENTS.md](AGENTS.md)

## Travailler sur le code

Prérequis : Node 24, pnpm 10, PostgreSQL pour les tests de l'API (`DATABASE_URL`).

```sh
pnpm install
pnpm typecheck && pnpm lint && pnpm test   # contrôles de la CI
pnpm --filter @janus/web dev               # appli web (Vite)
pnpm --filter @janus/web e2e               # parcours Playwright et captures
```

Le moteur (`packages/moteur`) tient 100 % de couverture. Les scripts `compte:creer`, `catalogue:importer`, `fiche:importer` et `ia:evaluer` s'exécutent depuis la racine.

## Déploiement

Chaque push sur `main` avec une CI verte est déployé sur le VPS par `deploy/vps` : voir [deploy/vps/README.md](deploy/vps/README.md) (installation, sauvegarde, restauration, retour arrière).

## Démo

https://amineakik.github.io/janus/ (en ligne dès la PR-003)
