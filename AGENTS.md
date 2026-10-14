# AGENTS.md

Instructions pour toute IA qui code sur Janus. À lire en entier avant la première ligne de code.

## Documents de référence

Ils font foi dans cet ordre en cas de désaccord :

1. [Cadrage de l'appli](https://claude.ai/code/artifact/5409816a-406a-4d96-81a2-ae8461b6ad31) : les règles métier.
2. [Janus : architecture technique](https://claude.ai/code/artifact/7fbc288e-336f-4729-b554-4e5158fe7c83) : comment c'est construit.
3. [Janus : backlog](https://claude.ai/code/artifact/c5ceabc7-e9dd-452d-b48d-bb9ac0f1f021) : les PR à coder, avec leurs critères d'acceptation. Les tickets sont dans [Linear](https://linear.app/amineakik/project/janus-bebc61cb3a5c).
4. [Maquettes Figma](https://www.figma.com/design/VhGXcHKlzhx9GYEmu2eVWg/Janus) : référence de parcours. Leurs textes et leurs chiffres sont des exemples.
5. Refonte esthétique de Janus (le calme maîtrisé) : **référence visuelle actuelle**, elle prime sur les couleurs des maquettes Figma. Source de vérité : `packages/ui/src/tokens.css` (palette, rayons, ombres, transitions), accent `#2c5d92`, colonne de lecture `--largeur-lecture` (62ch) sur les écrans d'étude de l'appli. Les fiches gardent un contrat léger (grandes lignes) défini plus tard.

Décisions prises depuis le cadrage, qui s'y ajoutent :

- Les règles de méthode (délais de vérification, seuil de 80 %) sont affichées en lecture seule dans les réglages : aucun écran ne les modifie. Les changer passe par une PR sur le moteur.
- Le référencement compte, même en v1 : la vitrine publique est l’accueil (`/`) et la connexion, indexables, avec leurs balises de partage, leurs données structurées, `robots.txt` et `sitemap.xml` (gardés par `apps/web/src/seo.test.ts`). Tout le reste est derrière un compte et se déclare non indexable (balise `robots` posée par le gabarit, en-tête `X-Robots-Tag` du Caddyfile).
- Correction IA (14 octobre 2026) : Claude Haiku 5.5 est le correcteur principal, DeepSeek le secours (`CORRECTEUR=deepseek` dans l'environnement du serveur), et une correction rendue par le secours se voit dans l'appli. La consigne est le fichier `prompts/correction/v1.md`, seule source (le cadrage n'en garde pas de copie) ; son empreinte est enregistrée avec chaque correction, et on ne la modifie que sur la parole d'Amine. Le jeu de test `prompts/correction/jeu-de-test/B01.json` (40 cas, niveaux d'Amine) se relance à chaque changement de consigne, de modèle ou de paramètre (`pnpm ia:evaluer`, workflow `ia-evaluer.yml`), jamais par bloc ; critère d'acceptation : au moins 70 % d'accord avec les niveaux d'Amine, au plus deux écarts de deux crans sur 40, aucun écart de trois crans. Sans la clé du correcteur désigné par `CORRECTEUR` (`ANTHROPIC_API_KEY` ou `DEEPSEEK_API_KEY`), l'API refuse de démarrer : pas de serveur qui répond sans savoir corriger. La validation de la sortie du correcteur (`apps/api/src/domaines/correction/policy.ts`) applique elle-même la règle « erreur critique → niveau » : une erreur critique du bloc retenue plafonne le niveau à fragile, à pas_encore si l'apprenant s'est dit sûr ; le niveau rendu par l'IA est gardé, et le rapport d'évaluation l'affiche quand il diffère.
- Fiches (14 octobre 2026) : `pnpm fiches:verifier`, lancé en CI, refuse une fiche de plus de 5 Mo (images et sons en `data:` compris : une fiche se conçoit sous cette limite, elle ne se réduit pas après coup), une étape d'explication ou d'aisance sans `<template data-etape>` (la page afficherait « Rien à lire dans cette étape ») et un item de pratique sans `<template data-item>` (pas d'énoncé), toute adresse externe chargée ou liée (`src`, `href`, `url()`, `@import`… vers `http(s)://` ou `//` : une fiche n'a aucun accès réseau, un lien vers un site s'écrit `<a data-lien>`), et une question (restitution, consolidation, rappel, différée) dont le texte change sous le même identifiant, casse et espaces mises à part : une question qui change de sens reçoit un nouvel identifiant, l'ancien reste en base pour l'historique. Il refuse aussi une fiche dont le pont embarqué n'est pas le pont construit du dépôt (en-tête `/*! janus-pont v<version> <empreinte> */`, version égale au champ `pont` du manifeste) ou dont un bloc fixe du gabarit (`<style id="polices">`, `<style id="styles-gabarit">`, `<script id="plomberie">`) diffère du gabarit : ce qui est propre à une fiche va dans `<style id="styles-bloc">` et `<script id="outils-bloc">`, et `pnpm fiches:assembler --forcer` réécrit pont et blocs fixes dans toutes les fiches quand le gabarit ou le pont change (puis chaque fiche augmente sa version). Le validateur de manifeste exige que chaque erreur critique soit touchée par au moins une question différée, seule façon de la refermer une fois cochée au bilan.

## Concevoir une fiche (décision du 14 octobre 2026)

B01 a été écrite à partir d'un cours et vérifiée sur sa forme seulement. En la jouant, Amine a trouvé des questions sur ce qu'elle n'enseignait pas, des renvois au cours, une pratique validée sans réponse et des états faux dans l'appli. Ces règles valent pour toute IA qui écrit ou modifie une fiche, pour que ça ne se reproduise sur aucune.

### Ce qu'est une fiche

- **Elle se suffit à elle-même.** Un cours sert à tracer le chemin et à fixer les objectifs, jamais de lecture obligée. Ni la page ni le manifeste (que lit le correcteur) ne citent, ne corrigent ou ne renvoient à un cours, une page de document ou une partie du plan. Les erreurs d'un cours se notent pour l'auteur, pas pour l'apprenant. Les `sources` du manifeste désignent des étapes de la fiche. `pnpm fiches:verifier` refuse les renvois déjà rencontrés (Studi, « pages 3 », « Solution n°2 », « P1.4 »…).
- **Elle n'interroge que ce qu'elle enseigne, et enseigne tout ce que son objectif promet.** Ce qui dépasse l'objectif va dans `hors_objectif` du tableau d'alignement, jamais dans une question ni dans une carte.
- **Ce qu'il faut savoir est écrit.** Un outil interactif fait manipuler, il ne remplace pas le texte, et une image a sa description (`aria-label`, `alt`).

### Dans quel ordre on l'écrit

1. Partir de l'entrée du bloc dans le plan du module, pas d'un cours, et la passer d'abord au contrôle du plan : un agent neuf reçoit l'entrée, celles de ses prérequis et la consigne `prompts/fiches/controle-plan.md`. Le plan a ses propres fautes : celui du module 1 faisait corriger un cours (B01, B15, B16, B20), demandait en preuve ce que l'objectif n'annonce pas (B01 : décoder #FF8800 sans hexadécimal dans l'objectif) et faisait utiliser la console ou le terminal avant de les présenter. Les dépendances à un cours et les prérequis manquants se corrigent dans le plan ; une exigence qui dépasse l'objectif va à Amine, qui choisit d'élargir l'objectif ou de réduire l'exigence. On n'écrit rien tant que le contrôle n'est pas propre.
2. Recopier l'objectif du plan, mot pour mot, dans le manifeste : s'il doit changer, c'est le plan qui change d'abord, avec l'accord d'Amine. B01 avait réécrit le sien (#RRGGBB ajouté, « pourquoi la base 2 » retiré) : son tableau d'alignement, rempli à partir de cet objectif réécrit, ne pouvait pas voir que la photo, UTF-8 et les préfixes promis par le plan manquaient.
3. Remplir le tableau d'alignement (`<script id="alignement">`, voir le LISEZ-MOI du gabarit) avec la liste des notions que donne le contrôle du plan : pour chaque notion, l'étape qui la montre, ce qui l'entraîne, les questions et les cartes qui l'interrogent. `pnpm fiches:verifier` refuse une question ou une carte sans notion, une explication ou un exercice qui ne sert aucune notion.
4. Écrire les étapes dans l'ordre de la méthode : démonstration, exercice guidé, exercice seul. Une règle montrée sur un seul exemple n'est pas enseignée : on n'interroge pas un cas nouveau sans que la règle soit écrite.
5. Écrire les questions en dernier, à partir du tableau.

### Avant de dire qu'elle est prête

Le vérificateur vert ne dit que la forme. Une fiche n'est prête qu'après deux épreuves, faites dans la PR qui la modifie, jamais « après fusion » :

1. **L'apprenant neuf.** `pnpm fiches:texte <formation> <bloc>` écrit ce que lit l'apprenant, sans aucune réponse. Un agent neuf, sans historique ni autre fichier, reçoit ce texte et la consigne `prompts/fiches/apprenant-neuf.md`, et répond à tout. Il faut zéro élément non déductible ou recopié tel quel de l'explication (hors champ assumé à part) et des réponses conformes aux attendus. Le résultat va dans la description de la PR.
2. **Le parcours dans l'appli.** Sur le banc local, la fiche se joue comme un apprenant, en entier, y compris en se trompant, en laissant un champ vide, en cochant puis en décochant, en revenant en arrière, avec une erreur cochée au bilan puis « à reprendre », une correction échantillonnée (« D'accord avec ce niveau ? ») et l'aisance. Les captures 390 px, en clair et en sombre, de chaque état atteint vont dans la PR.

Un défaut que l'apprenant verrait ne part jamais en « hors périmètre » : il est corrigé dans la PR, ou c'est Amine qui décide de le reporter.

### Quand on trouve un défaut

On corrige la classe, pas seulement le cas : on cherche la règle qui l'a laissé passer, et on l'écrit ici ou dans `pnpm fiches:verifier` dans la même PR. Les agents n'ont pas de mémoire d'une conversation à l'autre : une leçon qui n'est ni écrite ici ni vérifiée par la machine est perdue.

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
| Textes | Tous les textes affichés dans le composant qui les utilise, ou dans le `textes.ts` de sa fonctionnalité, en français, tutoiement, sans tiret cadratin. Pas de bibliothèque de traduction |
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
