---
name: fiche
description: Écrire, corriger ou éprouver la fiche d'un bloc (contenu/<formation>/fiches/<bloc>.html). À charger dès qu'Amine demande un bloc, une fiche, ses épreuves ou une correction de fiche. Donne l'ordre de lecture, les étapes, les commandes et la règle d'arrêt des épreuves, pour que rien n'ait à être rappelé.
---

# Faire une fiche

Ce mode d'emploi existe parce que B06 (5 et 6 novembre 2026) a pris 13 h 30 : treize manches d'épreuves préparées à la main, la limite de l'API atteinte deux fois, une PR livrée à moitié, et l'évaluation IA annoncée « bloquée » alors que le dépôt la portait. Tout ce qu'il faut savoir est dans le dépôt ; rien ne se demande à Amine que ces fichiers répondent.

## Lire d'abord, dans cet ordre

1. `AGENTS.md` en entier : « Concevoir une fiche » (l'ordre d'écriture, la liste avant d'écrire un écran, les cinq épreuves, « Quand on trouve un défaut ») et toutes les leçons, B01 à B06.
2. `contenu/<formation>/gabarit/LISEZ-MOI.md`, `contenu/<formation>/methode/LISEZ-MOI.md` et `contenu/<formation>/methode/regles.json`.
3. La dernière fiche fusionnée, sa grille et son cahier de conception : `contenu/<formation>/fiches/<bloc>.html`, `<bloc>.grille.md`, `contenu/<formation>/conception/<bloc>.md` quand il existe.
4. Les consignes des agents : `prompts/fiches/controle-plan.md`, `apprenant-neuf.md`, `parcours-apprenant.md`, `gardien-methode.md`, `relecteur-lecons.md`.
5. La ligne du bloc dans le plan de référence du module (le doc « Plan du module … » du projet, et son plan détaillé quand il existe). Le champ `diagnostic` du plan détaillé contient des réponses attendues : il ne s'affiche jamais à Amine.

## Ce qu'on ne touche pas dans une PR de fiche

Le gabarit, le moteur, le pont, `regles.json`, le doc de la méthode, `apps/api/src/fiches.ts`, une autre fiche. Un défaut de l'un d'eux va dans la section « Hors périmètre repéré » de la PR, ou dans une PR à part sur le mot d'Amine. Les tâches réservées à Amine et les notes du projet marquées comme telles ne se lisent pas et ne se montrent pas. Les agents ne lisent rien sous le dossier partagé du projet : leurs entrées vont dans le dossier temporaire de la session.

## Les étapes

Travaille sur une branche `fiche-<bloc>` créée depuis `main`, avec des commits de travail en cours avant chaque étape longue : un changement de modèle ou une coupure ne doit rien perdre.

### 1. Le contrôle du plan

Prépare dans le dossier temporaire un fichier avec : la ligne du bloc (objectif, type, prérequis, erreurs critiques, TP, automatisme, preuve, notions), celles de ses prérequis, la carte de sa partie (TP, ajouts, règles transversales) et ce que le plan range « à explorer plus tard ». Un agent neuf le lit avec `prompts/fiches/controle-plan.md`. Les écarts A et C se corrigent dans le plan ; chaque écart B va à Amine sur une carte de décision (élargir l'objectif ou réduire l'exigence, avec ta recommandation). Le plan de référence est modifié avec son accord avant d'écrire une ligne ; l'objectif du manifeste le recopie mot pour mot. Quand une notion part dans le bloc suivant, l'objectif de ce bloc est mis à jour dans le plan dans la même foulée.

### 2. Le cahier de conception

Avant la fiche, écris `contenu/<formation>/conception/<bloc>.md` sur le modèle du dernier cahier : identité du bloc, erreurs critiques en phrases d'apprenant, modèle du bloc (éléments, relations typées, relation centrale, frontières, à quoi ça sert), fil rouge, parcours étape par étape dans l'ordre du cycle, manifeste, tableau d'alignement, contraintes de style, les classes de défaut des blocs précédents, et ce que l'auteur rend. Recopie dedans, mot pour mot, « La liste avant d'écrire un écran » d'AGENTS.md.

### 3. L'écriture

`pnpm fiches:nouvelle <formation> <bloc>` crée le squelette. L'auteur (toi, ou un agent avec le cahier et AGENTS.md) écrit la fiche et sa grille, écran par écran, la liste sous les yeux. Avant de rendre, l'auteur joue lui-même l'épreuve 1 sur son texte (`pnpm fiches:texte <formation> <bloc>` à un agent neuf avec `prompts/fiches/apprenant-neuf.md`) et corrige ce qui est recopié ou non déductible, et chaque retour qui donne la réponse. Puis `pnpm fiches:verifier --base origin/main` vert, `pnpm --filter @janus/web exec vitest run` vert, et un rejeu Chromium à 390 px, clair et sombre, sans erreur de console ni débordement.

### 4. Les épreuves

```
mkdir -p <dossier>            # dans le dossier temporaire de la session
# y écrire plan.md : la ligne du bloc dans le plan (TP, automatisme, preuve), que lit le gardien
pnpm fiches:epreuves <formation> <bloc> <dossier>
```

La commande crée `<dossier>/v<n>/` avec tout ce que lisent les agents (texte, texte du cours, texte de conception, grille, manifeste, règles, leçons, plan, consignes) et écrit dans `consignes-agents.md` la consigne exacte de chaque agent à lancer. Lance un agent neuf par épreuve listée (général, sans historique, en parallèle, chacun avec sa consigne et rien d'autre) ; chaque agent écrit `rapport-<épreuve>.md` dans le dossier de la manche. Les épreuves dont les entrées n'ont pas changé depuis la manche précédente ne sont pas rejouées : leur rapport est repris.

```
pnpm fiches:epreuves <formation> <bloc> <dossier> --bilan
```

Le bilan compte les rapports et applique la règle d'arrêt : zéro non déductible et zéro recopiée (apprenant neuf), zéro décrochage, zéro île et au plus quatre écrans abstraits d'affilée (parcours), zéro ligne contestée, écart contesté ou règle violée hors grille (gardien), zéro bloquant (relecteur). Tant qu'il dit « manche suivante » : corrige la classe (une règle dans `regles.json`, un contrôle dans `pnpm fiches:verifier`, une leçon dans AGENTS.md, dans la même PR), vérifie que chaque remarque se voit dans la page avant de corriger, relance la commande sans `--bilan`. Quand il dit « arrêt possible » : les gênants et mineurs du relecteur qui nomment une règle et un écran, vérifiés dans la page, se corrigent avant la PR sans nouvelle manche ; les autres vont dans la section « À toi de trancher » de la PR. Les comptes de chaque manche vont dans la PR, en tableau.

Les manches coûtent : chaque agent lit toute la fiche, et une cinquantaine d'agents en une soirée a déclenché deux fois la limite de cinq heures de l'API. Quand la limite tombe, les agents reprennent après sa remise à zéro ; on ne relance pas des agents neufs pour compenser.

### 5. L'évaluation IA

Les réponses de l'apprenant neuf de la dernière manche passent au correcteur, par le workflow du dépôt, qui porte les clés dans ses secrets. Aucune clé ne se cherche dans l'environnement d'une session, aucune ne se demande à Amine ; le coût est d'une quinzaine d'appels à Haiku, moins d'un centime.

```
cp <dossier>/v<n>/rapport-apprenant-neuf.md prompts/fiches/epreuves/<formation>-<bloc>-apprenant-neuf.md
npx prettier --write prompts/fiches/epreuves/<formation>-<bloc>-apprenant-neuf.md
git add … && git commit … && git push -u origin fiche-<bloc>
pnpm ia:evaluer:ci <formation> <bloc> prompts/fiches/epreuves/<formation>-<bloc>-apprenant-neuf.md
```

Chaque réponse déductible ou recopiée doit sortir Solide ; une bonne réponse qui ne sort pas Solide dit un attendu mal écrit, à réécrire avant la PR. Le résultat (cas, accord, coût, lien de l'exécution) va dans la PR.

### 6. Le parcours dans l'appli

`apps/web/e2e-api/cycle.spec.ts` joue le cycle sur l'API réelle, bloc par bloc (sur ce conteneur : `service postgresql start` d'abord ; le banc se lance avec `pnpm --filter @janus/api banc`). Les branches de l'épreuve 5 d'AGENTS.md se jouent toutes ; les captures 390 px et 1440 px, clair et sombre, sont jointes par la CI.

### 7. La PR

Le modèle `.github/pull_request_template.md`, rempli en entier : Ticket (la fiche du bloc au plan), Avant, Après, Critères d'acceptation avec leur preuve, une section « Épreuves » avec le tableau des manches et les comptes de la dernière, l'évaluation IA, le rejeu, la charge (écrans, saisies), « Hors périmètre repéré », et « À toi de trancher » qui ne contient que des décisions, jamais une étape qu'Amine attend de l'IA. Brouillon d'abord, prête quand la CI est verte, fusionnée seulement sur la parole d'Amine. Une PR de fiche est entière : rien de ce qui précède ne reste « à faire ensuite ».

### 8. Après la fusion

Une leçon nouvelle va dans AGENTS.md ; un contrôle nouveau va dans `pnpm fiches:verifier` ; un défaut du gabarit va dans une PR à part sur le mot d'Amine. Rien ne se garde en mémoire de session : ce que la prochaine fiche doit savoir est dans le dépôt.

## Avec Amine

Des messages courts, en « tu », sans tiret cadratin ; un résultat ou un blocage, pas le récit. Pas de question dont un fichier du dépôt a la réponse. Un choix qui change l'objectif, ce qu'il verra ou une étape sans retour va sur une carte de décision, une fois, avec une recommandation ; le travail continue sur la recommandation. Rien ne se dit « bloqué » sans avoir vérifié AGENTS.md, `.github/workflows/` et `package.json`, et une affirmation reprise d'un résumé de contexte se revérifie dans le dépôt avant d'être répétée.
