# Gabarit de fiche

`fiche.html` est le point de départ de chaque fiche. Il fixe la **plomberie** et laisse le **contenu** libre.

## Ce qui est fixé (ne pas toucher)

- Trois blocs repris du gabarit octet pour octet : `<style id="polices">`, `<style id="styles-gabarit">` et `<script id="plomberie">`. `pnpm fiches:verifier` les compare au gabarit et refuse une fiche qui les a modifiés.
- Le pont avec l'appli (`<script id="pont">`, le `pont.js` construit, dont l'en-tête `/*! janus-pont v… */` donne la version du contrat et l'empreinte que `pnpm fiches:verifier` compare), la reprise de l'état, le mode autonome (ouvrir le fichier seul dans un navigateur).
- Le fil d'étapes, le masquage du cours pendant la restitution, la note de confiance, les boutons d'aide de la pratique, les messages de résultat.
- Le lien externe : `<a data-lien="https://…">`, ouvert par l'appli dans un nouvel onglet, avec l'adresse écrite à côté.

## Étapes d'aisance, carte et outils interactifs

- Une étape `aisance` est dessinée comme une étape libre : son `<template data-etape="ETx">` porte l'exercice chronométré, qui envoie lui-même `aisance.resultat` au pont. Le manifeste déclare le seuil dans `aisance`.
- La carte affiche d'abord le `<template data-etape="ET1">` s'il existe (c'est là que la fiche dit où tu es, à quoi ça sert, ce que tu sauras faire), puis l'objectif replié sous « Ce qui sera vérifié », puis Commencer ; sans template, l'objectif puis la liste des étapes. Le même objectif replié revient à l'entrée de la pratique. `contexte_ia` (pour le correcteur) n'est jamais affiché.
- Le fil groupe les étapes en quatre moments du cycle de la méthode : Découvrir (carte, perception), Comprendre (pretest, explication, ensemble), S’entraîner (pratique, atelier, aisance), Prouver (restitution, consolidation, bilan) ; il dit « Moment · titre de l'étape ». Les types `perception`, `pretest` et `ensemble` se dessinent comme une explication, depuis leur `<template data-etape>` ; le contrat des fiches les ajoute au manifeste dans une PR séparée.
- Le bouton Écouter (synthèse vocale, voix française, Charline d'abord) est sur la carte et sur chaque écran d'une étape à lire, qu'elle tienne en un écran ou en plusieurs. Il lit `data-lecture` s'il est posé (sur l'écran `data-ecran`, ou sur le `<template>` quand l'étape tient en un écran), sinon les h3, p et li de premier niveau de l'écran.
- Le `<script id="outils-bloc">` de la fiche peut animer le HTML libre : le gabarit émet l'événement `fiche:rendu` sur `document` après chaque étape dessinée. Les scripts dans un `<template>` ne s'exécutent pas, d'où cet événement.
- Un item de pratique dont l'outil contrôle la réponse porte `data-verifie` sur l'élément de l'outil, dans son `<template data-item>`. Le gabarit n'y montre ni « J’ai réussi » ni « Pas réussi ». À chaque réponse vérifiée, l'outil émet sur son élément l'événement `fiche:verification` (avec `bubbles: true`) et `detail: { juste, aide }`, où `aide` va de 0 à 4 (4 quand l'outil a montré la réponse). Le gabarit note le résultat sans redessiner l'item : la réponse et le message de l'outil restent à l'écran. Sauf avec `aide` 4 (l'outil a montré la réponse) : l'item ne passe pas réussi, il se note « solution vue », se redessine à neuf (l'outil se remonte sur `fiche:rendu`, son aide repart de zéro) et l'apprenant le refait sans regarder ; la réussite qui suit compte, avec `aide` 4 envoyé au pont. Un champ vide n'est pas une réponse : l'outil le refuse sans rien émettre.

## Ce qui est libre

- Le CSS propre à la fiche, dans `<style id="styles-bloc">` ; ses outils interactifs, dans `<script id="outils-bloc">`. Rien d'autre ne s'ajoute aux blocs fixes.
- Le HTML de chaque étape, dans un `<template data-etape="ET2">` par étape à lire.
- L'énoncé de chaque item de pratique, dans un `<template data-item="PR1-1">`.
- Le manifeste (`<script id="bloc-manifest">`) : les étapes, les questions, les erreurs critiques, les cartes. Le champ `type` (`systemes`, `procedures`, `regles_cas`, `conventions`) décide des réserves exigées ; sans lui, la composition complète est exigée. Une tâche différée peut se vérifier en `exacte`, en `code` ou en `constat`. Les `sources` désignent des étapes de la fiche (« Étape 3, Les poids et la somme »), jamais un cours : le correcteur s'en sert pour dire à l'apprenant où relire.
- Le tableau d'alignement (`<script id="alignement">`) : une entrée par notion de l'objectif, avec l'étape d'explication qui la montre (`montree`), l'exercice, l'atelier ou l'aisance qui l'entraîne (`pratiquee`, vide si rien) et les questions et cartes qui l'interrogent (`questions`). Deux champs facultatifs décrivent ce qui relie les notions : `relations`, une entrée par relation entre deux notions du tableau (`de`, `vers`), avec sa nature (`type` : `cause`, `composition`, `categorie`, `condition`, `equivalence`, `opposition` ou `sequence`), l'étape qui la montre (`montree`) et les questions qui l'interrogent ; et `ensemble`, le tout montré au début (`montree`) puis refait de mémoire (`rappelee` : l'étape « ensemble » ou la restitution), avec ses `questions`. Une question rattachée à une relation ou à l'ensemble compte comme rattachée. Ce qui dépasse l'objectif va dans `hors_objectif`, jamais dans une question. L'appli ne le lit pas : il sert à concevoir la fiche et à la vérifier.

## Une fiche se suffit à elle-même

- Elle n'a besoin d'aucun cours : un cours sert à fixer l'objectif et à vérifier les faits. Ni la page ni le manifeste ne citent ou ne corrigent un cours, une page de document ou une partie du plan.
- Elle n'interroge que ce qu'elle enseigne. Une règle montrée sur un seul exemple n'est pas enseignée : pas de question sur un cas nouveau sans que la règle soit écrite.
- Ce qu'il faut savoir est écrit dans le HTML de l'étape : un outil fait manipuler, il ne remplace pas le texte. L'énoncé d'un item s'écrit dans son template. Une image a sa description (`aria-label` sur un `role="img"`, `alt` sur une `<img>`).

## Créer la fiche d'un bloc

1. `pnpm --filter @janus/pont build` (une fois).
2. `pnpm fiches:nouvelle dwwm B03` crée `contenu/dwwm/fiches/B03.html` avec le pont.
3. **Avant tout HTML**, passer la ligne du bloc dans le plan de référence du module au contrôle du plan (consigne `prompts/fiches/controle-plan.md`, agent neuf), et corriger le plan jusqu'à un contrôle propre : une exigence qui dépasse l'objectif va à Amine. Recopier ensuite l'objectif du plan, mot pour mot, dans le manifeste.
4. Écrire le modèle du bloc avant tout le reste (ses éléments, ses relations typées, la relation centrale, ses frontières, à quoi il sert : « Concevoir une fiche » dans AGENTS.md), puis remplir le tableau d'alignement : une ligne par notion, par relation centrale et pour le tout.
5. Écrire le parcours dans l'ordre du cycle de la méthode (percevoir, tenter, modéliser, faire, recevoir un retour, ajuster), puis les questions à partir du tableau, et remplacer tout ce qui dit `À REMPLACER`. Écrire la grille de la méthode `contenu/dwwm/fiches/B03.grille.md` (format dans `contenu/dwwm/methode/LISEZ-MOI.md`) : une ligne par règle de `contenu/dwwm/methode/regles.json`.
6. `pnpm fiches:verifier --base origin/main` doit répondre « aucun problème » : il refuse aussi une question ou une carte sans notion, une explication ou un exercice qui ne sert aucune notion, les renvois à un cours déjà rencontrés, et une fiche nouvelle ou modifiée sans grille complète. La CI le refait avant la fusion.
7. Passer les quatre épreuves d'AGENTS.md (« Avant de dire qu'elle est prête ») : l'apprenant neuf et le parcours de l'apprenant, avec `pnpm fiches:texte dwwm B03` et les consignes `prompts/fiches/apprenant-neuf.md` et `prompts/fiches/parcours-apprenant.md` ; le gardien de la méthode, avec la grille et `prompts/fiches/gardien-methode.md` ; puis le parcours complet dans l'appli. Leurs résultats vont dans la PR, section « Épreuves ». Modifier une fiche déjà publiée : augmenter `version` dans le manifeste, refaire la grille et repasser les épreuves. Le gabarit ou le pont a changé : `pnpm fiches:assembler --forcer` réécrit le pont et les blocs fixes dans toutes les fiches, puis chacune augmente sa `version` (sans nouvelle grille : une grille existante change seulement de version dans son en-tête).
8. Une fiche pèse au plus 5 Mo, images et sons compris : `pnpm fiches:verifier` refuse au-delà. Une fiche se conçoit sous cette limite, elle ne se réduit pas après coup.

Aucun appel réseau dans une fiche, aucun fichier externe : images et audio en `data:`, dans la limite des 5 Mo.
