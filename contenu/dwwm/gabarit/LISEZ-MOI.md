# Gabarit de fiche

`fiche.html` est le point de départ de chaque fiche. Il fixe la **plomberie** et laisse le **contenu** libre.

## Ce qui est fixé (ne pas toucher)

- Trois blocs repris du gabarit octet pour octet : `<style id="polices">`, `<style id="styles-gabarit">` et `<script id="plomberie">`. `pnpm fiches:verifier` les compare au gabarit et refuse une fiche qui les a modifiés.
- Le pont avec l'appli (`<script id="pont">`, le `pont.js` construit, dont l'en-tête `/*! janus-pont v… */` donne la version du contrat et l'empreinte que `pnpm fiches:verifier` compare), la reprise de l'état, le mode autonome (ouvrir le fichier seul dans un navigateur).
- Le fil d'étapes, le masquage du cours pendant la restitution, la note de confiance, les boutons d'aide de la pratique, les messages de résultat.
- Le lien externe : `<a data-lien="https://…">`, ouvert par l'appli dans un nouvel onglet, avec l'adresse écrite à côté.

## Étapes d'aisance, carte et outils interactifs

- Une étape `aisance` est dessinée comme une étape libre : son `<template data-etape="ETx">` porte l'exercice chronométré, qui envoie lui-même `aisance.resultat` au pont. Le manifeste déclare le seuil dans `aisance`.
- La carte affiche l'objectif, puis le `<template data-etape="ET1">` s'il existe. `contexte_ia` (pour le correcteur) n'est jamais affiché.
- Le `<script id="outils-bloc">` de la fiche peut animer le HTML libre : le gabarit émet l'événement `fiche:rendu` sur `document` après chaque étape dessinée. Les scripts dans un `<template>` ne s'exécutent pas, d'où cet événement.

## Ce qui est libre

- Le CSS propre à la fiche, dans `<style id="styles-bloc">` ; ses outils interactifs, dans `<script id="outils-bloc">`. Rien d'autre ne s'ajoute aux blocs fixes.
- Le HTML de chaque étape, dans un `<template data-etape="ET2">` par étape à lire.
- L'énoncé de chaque item de pratique, dans un `<template data-item="PR1-1">`.
- Le manifeste (`<script id="bloc-manifest">`) : les étapes, les questions, les erreurs critiques, les cartes. Le champ `type` (`systemes`, `procedures`, `regles_cas`, `conventions`) décide des réserves exigées ; sans lui, la composition complète est exigée. Une tâche différée peut se vérifier en `exacte`, en `code` ou en `constat`. Les `sources` désignent des étapes de la fiche (« Étape 3, Les poids et la somme »), jamais un cours : le correcteur s'en sert pour dire à l'apprenant où relire.
- Le tableau d'alignement (`<script id="alignement">`) : une entrée par notion de l'objectif, avec l'étape d'explication qui la montre (`montree`), l'exercice, l'atelier ou l'aisance qui l'entraîne (`pratiquee`, vide si rien) et les questions et cartes qui l'interrogent (`questions`). Ce qui dépasse l'objectif va dans `hors_objectif`, jamais dans une question. L'appli ne le lit pas : il sert à concevoir la fiche et à la vérifier.

## Une fiche se suffit à elle-même

- Elle n'a besoin d'aucun cours : un cours sert à fixer l'objectif et à vérifier les faits. Ni la page ni le manifeste ne citent ou ne corrigent un cours, une page de document ou une partie du plan.
- Elle n'interroge que ce qu'elle enseigne. Une règle montrée sur un seul exemple n'est pas enseignée : pas de question sur un cas nouveau sans que la règle soit écrite.
- Ce qu'il faut savoir est écrit dans le HTML de l'étape : un outil fait manipuler, il ne remplace pas le texte. L'énoncé d'un item s'écrit dans son template. Une image a sa description (`aria-label` sur un `role="img"`, `alt` sur une `<img>`).

## Créer la fiche d'un bloc

1. `pnpm --filter @janus/pont build` (une fois).
2. `pnpm fiches:nouvelle dwwm B03` crée `contenu/dwwm/fiches/B03.html` avec le pont.
3. **Avant tout HTML**, remplir le tableau d'alignement à partir de l'objectif du bloc dans le plan du module. Si la preuve attendue du plan dépasse son objectif, le signaler à Amine avant d'écrire.
4. Écrire les étapes (démonstration, exercice guidé, exercice seul), puis les questions à partir du tableau, et remplacer tout ce qui dit `À REMPLACER`.
5. `pnpm fiches:verifier` doit répondre « aucun problème » : il refuse aussi une question ou une carte sans notion, une explication ou un exercice qui ne sert aucune notion, et les renvois à un cours déjà rencontrés. La CI le refait avant la fusion.
6. Passer les deux épreuves d'AGENTS.md (« Avant de dire qu'elle est prête ») : l'apprenant neuf, avec `pnpm fiches:texte dwwm B03` et la consigne `prompts/fiches/apprenant-neuf.md`, puis le parcours complet dans l'appli. Leurs résultats vont dans la PR.
7. Modifier une fiche déjà publiée : augmenter `version` dans le manifeste et repasser les deux épreuves. Le gabarit ou le pont a changé : `pnpm fiches:assembler --forcer` réécrit le pont et les blocs fixes dans toutes les fiches, puis chacune augmente sa `version`.
8. Une fiche pèse au plus 5 Mo, images et sons compris : `pnpm fiches:verifier` refuse au-delà. Une fiche se conçoit sous cette limite, elle ne se réduit pas après coup.

Aucun appel réseau dans une fiche, aucun fichier externe : images et audio en `data:`, dans la limite des 5 Mo.
