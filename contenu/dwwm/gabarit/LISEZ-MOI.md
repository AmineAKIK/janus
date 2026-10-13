# Gabarit de fiche

`fiche.html` est le point de départ de chaque fiche. Il fixe la **plomberie** et laisse le **contenu** libre.

## Ce qui est fixé (ne pas toucher)

- Le pont avec l'appli, la reprise de l'état, le mode autonome (ouvrir le fichier seul dans un navigateur).
- Le fil d'étapes, le masquage du cours pendant la restitution, la note de confiance, les boutons d'aide de la pratique, les messages de résultat.
- Le lien externe : `<a data-lien="https://…">`, ouvert par l'appli dans un nouvel onglet, avec l'adresse écrite à côté.

## Étapes d'aisance, carte et outils interactifs

- Une étape `aisance` est dessinée comme une étape libre : son `<template data-etape="ETx">` porte l'exercice chronométré, qui envoie lui-même `aisance.resultat` au pont. Le manifeste déclare le seuil dans `aisance`.
- La carte affiche l'objectif, puis le `<template data-etape="ET1">` s'il existe. `contexte_ia` (pour le correcteur) n'est jamais affiché.
- Un `<script>` de la fiche peut animer le HTML libre : le gabarit émet l'événement `fiche:rendu` sur `document` après chaque étape dessinée. Les scripts dans un `<template>` ne s'exécutent pas, d'où cet événement.

## Ce qui est libre

- Le HTML de chaque étape, dans un `<template data-etape="ET2">` par étape à lire.
- L'énoncé de chaque item de pratique, dans un `<template data-item="PR1-1">`.
- Le manifeste (`<script id="bloc-manifest">`) : les étapes, les questions, les erreurs critiques, les cartes. Le champ `type` (`systemes`, `procedures`, `regles_cas`, `conventions`) décide des réserves exigées ; sans lui, la composition complète est exigée. Une tâche différée peut se vérifier en `exacte`, en `code` ou en `constat`.

## Créer la fiche d'un bloc

1. `pnpm --filter @janus/pont build` (une fois).
2. `pnpm fiches:nouvelle dwwm B03` crée `contenu/dwwm/fiches/B03.html` avec le pont.
3. Remplacer tout ce qui dit `À REMPLACER`.
4. `pnpm fiches:verifier` doit répondre « aucun problème ». La CI le refait avant la fusion.
5. Modifier une fiche déjà publiée : augmenter `version` dans le manifeste.

Aucun appel réseau dans une fiche, aucun fichier externe : images et audio en `data:`.
