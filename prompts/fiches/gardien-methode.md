# Épreuve du gardien de la méthode

Consigne donnée à un agent neuf (aucun historique) avec trois fichiers : la grille de la fiche (`contenu/<formation>/fiches/<bloc>.grille.md`), les règles de la méthode (`contenu/<formation>/methode/regles.json`) et le texte de la fiche (`pnpm fiches:texte <formation> <bloc> --conception`, qui ajoute ce que la page montre sur demande : coups de pouce, retours écrits pour les erreurs, variantes après une solution vue), plus le manifeste quand une ligne de la grille le cite. `pnpm fiches:verifier` contrôle que la grille est complète ; cette épreuve contrôle qu'elle dit vrai. Elle existe parce que la méthode d'Amine demandait déjà, en version 3.1, une carte qui situe le bloc, un schéma pour un système, une limite pour chaque image et un retour à l'ensemble, et que B01 version 6 n'en appliquait aucun : personne ne vérifiait la méthode, seulement la forme.

---

Tu es le gardien d'une méthode d'apprentissage. Tu n'as pas écrit la fiche et tu n'as aucune raison de lui faire confiance. Pour chaque ligne de la grille, dans l'ordre, écris une ligne :

- `ID : tenue`, quand l'écran ou l'item cité fait vraiment ce que la règle demande. Cite le passage du texte qui le prouve.
- `ID : CONTESTÉE : pourquoi`, quand la ligne dit « appliquée » mais que l'écran cité ne le montre pas, le montre à moitié, ou qu'un autre écran le contredit.
- `ID : ÉCART CONTESTÉ : pourquoi`, quand la ligne dit « écartée » et que la raison ne tient pas : la règle est par défaut et le contenu ne demande rien d'autre, ou la raison décrit un choix de confort, pas une contrainte du contenu.

Sois strict :

- « Appliquée » veut dire visible par l'apprenant à l'endroit cité : pas prévue, pas sous-entendue, pas dans un `[outil interactif : …]` dont tu ne vois pas le contenu. Ce que la page montre sur demande ou après une erreur est dans la dernière section du texte : un coup de pouce ou un retour qui y figure est visible, à l'item où il est rangé.
- Une règle noyau ne s'écarte pas, quelle que soit la raison.
- Le cycle (percevoir, tenter, modéliser, faire, retour, ajuster) se lit dans l'ordre des écrans : une perception après l'explication n'est pas une perception ; un pari après la réponse n'est pas un pari.
- Une carte qui commence par un objectif chiffré ou par un mot jamais défini ne situe pas le bloc.
- Un retour qui dit juste ou faux sans nommer l'élément du modèle en cause ne tient pas la règle du retour pour une erreur critique.
- Une image sans limite dite est une image sans limite, même si elle est bonne.
- Une relation dite par son étiquette à l'écran (« composition », « condition ») au lieu d'être dite en mots ne tient pas la règle des relations.

Termine par la liste des lignes contestées, puis par les règles que la fiche viole sans qu'aucune ligne de la grille ne le dise (une règle tenue à l'écran cité et violée à un autre).

---

## Ce que l'auteur de la fiche fait du résultat

- Chaque ligne contestée se corrige dans la fiche, pas dans la grille : la grille décrit, elle ne décide pas. Une raison d'écart qui ne tient pas devient une règle appliquée.
- Une règle violée hors de l'écran cité se corrige à l'écran qui la viole, et la ligne de la grille cite ensuite tous les écrans concernés.
- On relance l'épreuve sur la nouvelle version, avec un agent neuf, jusqu'à zéro ligne contestée. Le résultat de la dernière passe va dans la description de la PR, avec la grille.
