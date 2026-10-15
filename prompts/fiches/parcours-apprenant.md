# Épreuve du parcours de l'apprenant

Consigne donnée à un agent neuf (aucun historique, aucun autre fichier) avec le texte d'une fiche, produit par `pnpm fiches:texte <formation> <bloc>`. L'épreuve de l'apprenant neuf vérifie que chaque question est déductible ; celle-ci vérifie qu'un débutant qui lit les écrans dans l'ordre sait, à la fin, où il est, comment les morceaux tiennent ensemble et à quoi ça sert. B01 version 6 passait la première et pas la seconde : un apprenant en sortait avec « quatre îles » (le calcul, les lectures, la photo, le processeur), sans savoir pourquoi il était là, et son premier écran, l'objectif d'examen, aurait pu lui faire fermer l'appli.

---

Tu joues un adulte en reconversion qui découvre ce sujet, sur un téléphone, sans aucune base. Tu lis la partie « Ce que la fiche enseigne » dans l'ordre, écran par écran, sans sauter ni revenir en arrière, et tu ne lis pas « Ce qu'on te demande ». Même si tu connais le sujet, tu ne sais que ce que le texte t'a dit jusque-là.

Pendant la lecture, écris pour chaque écran une ligne : `ÉTAPE, écran : ce que je comprends maintenant / ce qui me manque`. Marque `DÉCROCHAGE` un écran où tu aurais fermé l'appli : un mur de mots nouveaux, une consigne sans savoir quoi chercher, une évaluation avant d'avoir appris, une contradiction apparente avec un écran précédent.

À la fin, sans relire, écris :

1. **Où je suis.** En une phrase : dans quoi s'inscrit ce bloc, et ce qui s'en servira ensuite. Si le texte ne te l'a pas dit, écris « non dit ».
2. **À quoi ça sert.** En une phrase, dans le métier visé. Sinon « non dit ».
3. **Mon modèle, de mémoire.** Les éléments que tu as retenus et, entre eux, les liens que tu sais expliquer, avec un mot pour chaque lien (fait partie de, dépend de, est une sorte de, s'oppose à, vient avant…). Liste ensuite les éléments que tu n'arrives à relier à rien : ce sont tes îles.
4. **La relation centrale.** Celle sans laquelle le reste ne tient pas, en une phrase. Si tu hésites entre plusieurs, dis-le.
5. **Ce que j'ai vu fonctionner.** As-tu vu ou entendu le système marcher en entier avant qu'on te l'explique ? À quel écran ? T'a-t-on demandé de parier ou d'essayer avant l'explication ?
6. **Ce que j'ai dû corriger.** Une idée que tu t'étais faite et qu'un écran plus tard a contredite ; as-tu eu un moment pour la reprendre ?
7. **Les images.** Chaque image ou comparaison que le texte emploie, et si le texte dit où elle s'arrête.

Sois strict :

- Une notion seulement nommée n'est pas retenue.
- Un lien que tu ne sais pas expliquer n'est pas un lien.
- Un `[outil interactif : …]` ne t'apprend rien : tu ne vois pas ce qu'il montre.
- Une `[image : sans description]` ne t'apprend rien non plus.

---

## Ce que l'auteur de la fiche fait du résultat

L'épreuve passe quand : aucun DÉCROCHAGE ; « où je suis » et « à quoi ça sert » sont dits et justes ; le modèle est d'un seul tenant, sans île ; la relation centrale est celle du modèle du bloc (`ensemble` et `relations` du tableau d'alignement) ; le système a été vu fonctionner avant l'explication, suivi d'un pari ou d'une tentative ; chaque image a sa limite.

- Une île est un défaut de la fiche, pas de l'apprenant : il manque l'écran qui relie, le schéma d'ensemble ou le retour à l'ensemble.
- Un décrochage se corrige à l'écran qui le cause (trop de mots nouveaux d'un coup, une consigne sans but, l'objectif avant la carte), pas en ajoutant un écran plus loin.
- Une relation centrale fausse ou hésitante dit que la fiche ne la met pas en avant : elle s'énonce, se montre et se teste.
- On relance l'épreuve sur la nouvelle version, avec un agent neuf, jusqu'à ce qu'elle passe. Le résultat de la dernière passe va dans la description de la PR.
