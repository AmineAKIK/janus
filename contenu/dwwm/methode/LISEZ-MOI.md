# La méthode d'apprentissage, côté dépôt

`regles.json` recopie, règle par règle, ce que la méthode d'apprentissage d'Amine demande à une fiche : [Ma méthode d'apprentissage : modèle complet](https://claude.ai/code/artifact/e97bf8ec-5bbd-4a10-8d4b-35de4301d518), version 3.3 du 18 octobre 2026 (R01, C09, T01 : une convention est redonnée avec la question qui s'en sert, sauf par cœur demandé par l'objectif). Le doc fait foi ; ce fichier est sa traduction pour les outils, et il change dans la même PR que le doc, sur la parole d'Amine.

Chaque règle a un `id` (une lettre pour la section, deux chiffres), un `statut` (noyau : toujours appliqué ; par défaut : appliqué sauf raison écrite ; réglage : valeur de départ, à ajuster d'après les résultats), la `section` du doc d'où elle vient, un `titre` et le `texte` de ce que la fiche doit tenir.

Le 28 octobre 2026, le schéma de fin de bloc a changé (C08, P02, R02). Il se refaisait de mémoire, devant des cases vides, et se jugeait sur sa ressemblance au schéma vu une fois tôt dans le cours : pour un apprenant qui fait le bloc en plusieurs séances, l'exercice mesurait la mémoire d'un dessin et poussait au par cœur. Il se construit désormais pour un cas nouveau (un client, un fichier) : la première boîte porte les données du cas en mots, la dernière est posée sans sa valeur, les autres cases et les flèches ont une question qui aide sans donner le terme, et l'apprenant ajoute ou retire des boîtes. Le correcteur juge la chaîne pour ce cas : le nombre de boîtes et les mots peuvent différer du cours, une étape qui manque ou une relation fausse est une erreur. Le schéma reparaît aussi rempli au milieu du bloc, pour un autre cas. Le doc de la méthode garde sa version 3.3 tant qu'Amine ne l'a pas repris.

Le 29 octobre 2026, F06 traduit ce que la méthode dit déjà (« J'apprends en faisant », section Pratique) en règle qu'une fiche doit tenir : chaque travail pratique, l'automatisme et la preuve que le plan donne au bloc se font, dans la page ou dans l'atelier, jamais retirés parce que la page ne les voit pas. B01, B02 et B03 en avaient sauté.

Les règles de séance (journal, révisions dues, répétition espacée) ne sont pas ici : elles sont tenues par Amine et par l'appli, pas par une fiche.

## La grille d'une fiche

Chaque fiche porte `fiches/<bloc>.grille.md`, à côté de `fiches/<bloc>.html` : une ligne par règle, qui dit où l'apprenant voit la règle appliquée, ou pourquoi elle est écartée.

```markdown
# Grille de la méthode : B01, version 7

Une ou deux phrases libres, si utile.

| Règle | Statut    | Où, ou pourquoi pas                                                                     |
| ----- | --------- | --------------------------------------------------------------------------------------- |
| C01   | appliquée | ET1 à ET8 : perception en ET1, tentative en ET3, schéma en ET2 puis ET8                 |
| C02   | appliquée | ET1 : la photo zoomée jusqu'aux lampes, un pari à la fin                                |
| C11   | écartée   | rien à mettre en répétition espacée dans ce bloc : les termes sont déjà dans les cartes |
```

- La première ligne porte le bloc et la version du manifeste : la grille se refait à chaque version.
- Chaque règle de `regles.json` figure exactement une fois.
- `appliquée` cite au moins une étape (`ET2`), un item de pratique (`PR1-3`) ou le mot « manifeste » ou « alignement » ; chaque étape citée existe dans le manifeste.
- Ce qu'une ligne `appliquée` cite entre « » se lit tel quel dans la page (texte, attributs, outils), casse, espaces et apostrophes mises à part ; une coupure se marque « … » ou « […] ». Un texte que la page calcule (un coup de pouce fait avec les nombres de l'exercice) ou qu'elle a retiré se cite entre “ ”. `pnpm fiches:verifier` refuse une citation « » périmée : la grille se relit à chaque version de la fiche (25 octobre 2026).
- `écartée` donne la raison ; une règle noyau ne s'écarte pas.

`pnpm fiches:verifier` refuse une fiche nouvelle ou modifiée sans grille (avec `--base`, comme en CI), et toute grille incomplète ou mal formée. Une fiche seulement réassemblée (`pnpm fiches:assembler --forcer`, puis sa version) n'est pas modifiée au sens de la grille : l'apprenant n'y voit rien de nouveau ; si elle a déjà une grille, seule la version de l'en-tête change. L'épreuve du gardien de la méthode (`prompts/fiches/gardien-methode.md`) vérifie ensuite que la grille dit vrai : la grille décrit, elle ne décide pas.
