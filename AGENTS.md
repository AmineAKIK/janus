# AGENTS.md

Instructions pour toute IA qui code sur Janus. À lire en entier avant la première ligne de code.

## Documents de référence

Ils font foi dans cet ordre en cas de désaccord :

1. [Cadrage de l'appli](https://claude.ai/code/artifact/5409816a-406a-4d96-81a2-ae8461b6ad31) : les règles métier.
2. [Janus : architecture technique](https://claude.ai/code/artifact/7fbc288e-336f-4729-b554-4e5158fe7c83) : comment c'est construit.
3. [Janus : backlog](https://claude.ai/code/artifact/c5ceabc7-e9dd-452d-b48d-bb9ac0f1f021) : les PR à coder, avec leurs critères d'acceptation. Les tickets sont dans [Linear](https://linear.app/amineakik/project/janus-bebc61cb3a5c).
4. [Maquettes Figma](https://www.figma.com/design/VhGXcHKlzhx9GYEmu2eVWg/Janus) : référence visuelle et de parcours. Leurs textes et leurs chiffres sont des exemples.

## Règles permanentes pour l'IA qui code

Ces règles valent pour toutes les PR. La PR-001 les recopie dans `AGENTS.md` à la racine du dépôt (avec un `CLAUDE.md` qui contient seulement `Lire AGENTS.md.`), pour que n'importe quelle IA les trouve.

### Avant de coder

1. Lire le ticket en entier, puis les sections du cadrage et de l'architecture qu'il cite.
2. Ouvrir chaque cadre Figma cité (lien `node-id`) en clair **et** en sombre, en desktop **et** en mobile quand ils existent. Relever les composants utilisés : ils existent déjà dans `packages/ui`, ne jamais en recréer un.
3. Vérifier que toutes les PR listées dans « Dépend de » sont fusionnées. Sinon, ne pas commencer.

### Conventions de code

| Sujet | Règle |
| --- | --- |
| Langue | Code, noms de fichiers et identifiants en français sans accents (`calculerBloc`, `etatsPage`), comme dans l'architecture. Textes affichés en français avec accents. Messages de commit en français |
| TypeScript | `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Interdits : `any`, `as` sauf après une validation Zod, `@ts-ignore`, `!` non nul |
| Données externes | Tout ce qui entre (réponse d'API, message de fiche, `localStorage`, variables d'environnement) passe par un schéma Zod de `packages/contrats` avant usage |
| Dates | Jamais `new Date()` ni `Date.now()` hors du module `horloge`. Les dates circulent en chaînes ISO 8601 UTC. Le jour qui bascule à 4 h se calcule uniquement avec `jourDe()` du moteur |
| Style | CSS Modules + variables de `packages/ui/src/tokens.css`. Interdits : couleur, taille ou espacement en dur, `!important`, styles en ligne sauf valeur calculée |
| Textes | Tous les textes affichés dans le composant qui les utilise, en français, tutoiement, sans tiret cadratin. Pas de bibliothèque de traduction |
| Accessibilité | Chaque élément interactif est atteignable au clavier, a un nom accessible, et montre le focus défini dans les tokens. Zone tactile minimale 44 × 44 px en mobile. Contraste AA |
| Dépendances | Seulement celles nommées dans l'architecture ou dans le ticket. Toute autre dépendance doit être justifiée dans la PR |
| Couches | Respecter les couches de l'architecture. Le lint `eslint-plugin-boundaries` fait foi |

### Branche, commits, PR

- Branche : `ami-<numéro Linear>-<titre-court>`, par exemple `ami-14-tokens`. Linear relie alors la PR au ticket tout seul.
- Titre de PR : `[PR-010] Tokens et thèmes` (l'identifiant du backlog, puis le titre du ticket).
- Taille : viser moins de 400 lignes modifiées hors fichier de verrouillage et fichiers générés. Au-delà, découper et le dire dans la PR.
- Description : le modèle `.github/pull_request_template.md` (créé en PR-001), rempli en entier.

### Définition de « terminé » (pour chaque PR)

- [ ] Tous les critères d'acceptation du ticket sont cochés dans la description, chacun avec sa preuve (test, capture ou lien d'aperçu).
- [ ] La CI est verte : types, lint, format, tests, build.
- [ ] Les tests demandés par le ticket existent et passent. Une règle métier sans test n'est pas terminée.
- [ ] L'aperçu GitHub Pages de la PR fonctionne, et les captures 390 px et 1440 px, en clair et en sombre, sont jointes par la CI pour chaque écran touché.
- [ ] Aucun texte ou chiffre d'exemple de Figma n'est codé en dur : tout vient des données.
- [ ] La PR ne touche aucun fichier hors de son périmètre.

### Interdits absolus

- Modifier `packages/moteur` sans commencer par un test qui échoue.
- Ajouter `allow-same-origin` à l'iframe des fiches.
- Calculer un statut ailleurs que dans le moteur.
- Désactiver, sauter ou affaiblir un test pour obtenir une CI verte.
- Mettre une clé, un mot de passe ou un secret dans le dépôt.
- Inventer une règle métier absente du cadrage. En cas de doute, s'arrêter et poser la question dans la PR.
