# Épreuve du relecteur des leçons

Consigne donnée à un agent neuf (aucun historique) avec : `AGENTS.md` (de « Concevoir une fiche » à la fin des leçons), `contenu/<formation>/methode/regles.json`, la grille de la fiche et le texte de la fiche avec ce qu'elle montre sur demande (`pnpm fiches:texte <formation> <bloc> --conception`) ; il peut ouvrir la fiche HTML pour lever un doute. Le gardien de la méthode vérifie que la grille dit vrai, règle par règle ; celui-ci vérifie que la fiche tient les leçons écrites après les blocs précédents, écran par écran. Elle existe parce que B02 version 32 violait une dizaine de leçons écrites après B01 (exercices sans leurs données, ordre de calcul non redonné, plusieurs consignes par écran, attendus en grille, citations de grille périmées) alors que le vérificateur et la grille étaient verts : Amine les a trouvées en jouant le bloc (25 octobre 2026).

---

Tu relis une fiche d'apprentissage que tu n'as pas écrite, et tu n'as aucune raison de lui faire confiance. Les leçons de `AGENTS.md` et les règles de `regles.json` sont la loi ; une ligne « appliquée » de la grille n'est pas une preuve.

D'abord, la règle qui prime : **chaque écran se résout avec ce qu'il montre.** Pour chaque écran (`####`), chaque question de pratique, de restitution, de rappel, chaque tâche différée et chaque carte, et pour chaque retour, coup de pouce et variante : peut-on comprendre et répondre sans se souvenir d'un autre écran ? Relève chaque donnée, seuil, chaîne, code, convention ou exemple utilisé sans être redonné sur place (« du début », « corrigé », « bien rangée », « ta chaîne », « comme pour », « vu plus tôt »…).

Puis, leçon par leçon, chaque manquement : convention interrogée non redonnée, un écran à plusieurs consignes, plus de deux sous-questions, explication demandée pour ce que l'écran montre déjà, question sur ce qui n'est pas encore enseigné, notion employée avant d'être définie, attendu écrit comme une grille ou un modèle, carte de correspondance, texte qui laisse voir la conception, texte qui écrit en dur une donnée de l'appli, charge (le nombre de saisies), ligne de grille « appliquée » que l'écran cité ne tient pas.

Rends une liste triée par gravité (bloquant, gênant, mineur). Pour chaque point : l'écran exact (étape et titre d'écran, ou identifiant), une citation courte, la leçon ou la règle violée, et la correction concrète (le texte à ajouter ou à changer). Termine par les leçons que la fiche viole de façon répétée, et pour chacune un contrôle que `pnpm fiches:verifier` pourrait faire.

---

## Ce que l'auteur de la fiche fait du résultat

- Chaque point se corrige dans la fiche, dans la même PR ; un point qu'on choisit de garder se dit dans la PR, avec sa raison, et c'est Amine qui tranche.
- Une leçon violée de façon répétée devient un contrôle de `pnpm fiches:verifier` quand c'est faisable, dans la même PR (« Quand on trouve un défaut » dans AGENTS.md).
- On relance l'épreuve sur la nouvelle version, avec un agent neuf, jusqu'à zéro point bloquant ou gênant. Le résultat de la dernière passe va dans la description de la PR.
