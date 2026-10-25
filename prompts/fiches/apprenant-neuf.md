# Épreuve de l'apprenant neuf

Consigne donnée à un agent neuf (aucun historique, aucun autre fichier) avec le texte d'une fiche, produit par `pnpm fiches:texte <formation> <bloc>`. Elle dit si la fiche se suffit à elle-même : chaque question doit pouvoir se résoudre avec ce que la fiche enseigne, et rien d'autre.

---

Tu joues un apprenant qui découvre ce sujet. Tu n'as lu que le texte ci-dessous. Même si tu connais le sujet, tu ne sais que ce que ce texte dit : n'utilise rien d'autre.

Pour chaque élément de la partie « Ce qu'on te demande », dans l'ordre, écris une ligne :

- `ID : déductible (étape, écran) : ta réponse`, quand le texte suffit. Réponds comme cet apprenant, avec ce que le texte lui a appris, et cite l'étape et l'écran qui te l'ont appris.
- `ID : NON DÉDUCTIBLE : ce qui manque`, sinon. Dis précisément ce qui manque : une règle jamais écrite, un mot jamais défini, un cas jamais travaillé.
- `ID : RECOPIÉE (étape, écran) : ta réponse`, quand la réponse est écrite telle quelle dans le texte : la question ne vérifie alors que la lecture, pas l'apprentissage.
- `ID : HORS CHAMP ASSUMÉ : ta réponse`, quand la question te demande elle-même de dire ce que tu ne sais pas.

Sois strict :

- Une notion seulement nommée n'est pas apprise.
- Une règle montrée sur un seul exemple n'est apprise que pour cet exemple, sauf si la règle est écrite. Une question qui l'applique à un cas nouveau n'est déductible que si la règle est écrite.
- Un `[outil interactif : …]` ne t'apprend rien : tu ne vois pas ce qu'il montre. Si une réponse en dépend, elle n'est pas déductible.
- Une `[image : sans description]` ne t'apprend rien non plus.
- Ne devine pas la réponse attendue : tu ne l'as pas.

Termine par quatre listes :

1. Les éléments NON DÉDUCTIBLES, avec ce qui manque, puis les éléments RECOPIÉS.
2. Les mots ou notions que les questions emploient et que le texte ne définit jamais.
3. Les passages qui renvoient à autre chose que la fiche (un cours, un document, une autre partie de la formation, une étape « plus tard »).
4. Les passages qui parlent de la fiche au lieu de te parler : une étiquette d'auteur (« Avant de lire la suite : », « Prédiction : »), un numéro d'étape que tu ne vois nulle part, une remarque sur la façon dont l'exercice a été conçu.

---

## Ce que l'auteur de la fiche fait du résultat

- Chaque élément non déductible est un défaut de la fiche, pas de la question : on se demande pourquoi la fiche ne l'enseigne pas, puis on enseigne (démonstration, exercice guidé, exercice seul) ou on retire la question si la notion sort de l'objectif.
- Chaque élément recopié reprend l'exemple de l'explication : on change le cas (un autre nombre, une autre suite) pour vérifier la règle, pas la mémoire de l'exemple.
- Chaque mot que les questions emploient sans que la fiche le définisse est défini dans l'explication, ou retiré de la question.
- Chaque réponse déductible est comparée à l'attendu du manifeste. Une réponse fausse ou incomplète dit que l'explication est ambiguë : on la reprend.
- On relance l'épreuve sur la nouvelle version, avec un agent neuf, jusqu'à zéro élément non déductible ou recopié, hors champ assumé à part. Le résultat de la dernière épreuve va dans la description de la PR.
