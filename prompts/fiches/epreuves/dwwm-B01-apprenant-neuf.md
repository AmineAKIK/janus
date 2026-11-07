# Rapport de l'apprenant neuf, fiche B01 (version 66)

## Réponses

PR7-1 : déductible (ET5, Pas à pas et Avec les poids) : 128 + 16 + 4 + 2 = 150.
PR7-2 : déductible (ET6, La méthode) : 77 = 64 + 8 + 4 + 1, soit 01001101.
PR7-3 : déductible (ET4, Combien de valeurs) : 64 valeurs est juste, mais le plus grand nombre est 2^n − 1 = 63. Première réponse.
PR7-4 : déductible (ET4, Combien de valeurs) : 2^7 = 128 valeurs, le plus grand nombre est 128 − 1 = 127. Première réponse.
PR7-5 : déductible (ET5 + ET7, La table ASCII) : 01011010 = 64 + 16 + 8 + 2 = 90, et 90 est Z dans la table. Il affiche Z.
PR7-6 : déductible (ET11, Un programme de 6 octets) : 1 10 range 10, 2 10 ajoute 10 donc 20, 3 0 affiche. L'écran affiche 20.
PR8-1 : déductible (ET6, La méthode) : 6 = 4 + 2, soit 00000110.
PR8-2 : déductible (ET14, À retenir) : une suite de bits n'a pas de sens toute seule, donc la première réponse : ça dépend du programme qui les lit et de son codage.
PR8-3 : déductible (ET6 + ET8, Une couleur en octets) : 32 = 00100000, 192 = 11000000, 96 = 01100000.
PR8-4 : déductible (ET9, Écrire un octet) : 32 = 0010 0000 donc 20, 192 = 1100 0000 donc c0, 96 = 0110 0000 donc 60. Réponse : #20c060.
PR8-5 : déductible (ET10, La taille d'une photo) : 800 × 600 × 3 = 1 440 000 octets.
PR8-6 : déductible (ET4, Les poids) : 11000101 vaut 197, pas 163. Les bits sont à l'envers, le poids 128 est à gauche. 163 = 128 + 32 + 2 + 1 = 10100011. Première réponse.
PR8-8 : déductible (ET11, Un autre processeur et Le binaire n'est pas un langage) : chaque processeur lit les octets avec sa propre table, et les deux tables diffèrent. Première réponse.
R21 : déductible (ET4, Combien de valeurs) : chaque bit double le nombre de valeurs, donc n bits donnent 2^n valeurs, un octet 2^8 = 256. On compte à partir de 0 et 0 est une valeur, donc le plus grand nombre est 2^n − 1 = 255. Avec 7 bits : 2^7 = 128 valeurs et le plus grand nombre est 127.
R35 : déductible (ET5 + ET4, Les poids) : 01010101 = 64 + 16 + 4 + 1 = 85. Un bit à 1 compte son poids, qui double à chaque place en allant de droite à gauche (1, 2, 4... 128) : plus il est à gauche, plus il compte.
R31 : déductible (ET5, ET7, ET8, ET14) : 01000011 = 64 + 2 + 1 = 67. Avec la table ASCII, 67 est C. Comme intensité de rouge, c'est 67 sur 255, un rouge assez faible (un peu plus du quart). Ce qui décide de la bonne lecture : le codage avec lequel le programme lit les bits. Aucune lecture n'est juste en soi.
R32 : déductible (ET6, ET8) : 144 = 128 + 16 = 10010000 ; 48 = 32 + 16 = 00110000 ; 224 = 128 + 64 + 32 = 11100000. Rouge 144 sur 255 : un peu plus que mi-chemin. Vert 48 : faible. Bleu 224 : presque à fond.
R34 : déductible (ET10, Pixels et en-tête, La taille d'une photo, Ko Mo Go) : une photo est une grille de pixels ; chaque pixel prend trois octets, un par lumière rouge, vert, bleu ; le fichier range ces octets à la suite, pixel après pixel, ligne après ligne ; un en-tête donne largeur et hauteur pour que le programme sache où couper les lignes. Calcul : 2 000 × 1 000 = 2 000 000 pixels, × 3 = 6 000 000 octets, soit 6 Mo.
R26 : déductible (ET11, Un programme de 6 octets et Le binaire n'est pas un langage) : 1 6 range 6, 2 4 ajoute 4 donc 10, 3 0 affiche : l'écran affiche 10. Le binaire dit seulement comment c'est écrit (une façon d'écrire des nombres avec deux chiffres) ; ce qui fait le langage machine, c'est le jeu d'instructions du processeur. Un langage de programmation, ce sont des mots et des règles de grammaire.
Q21 : déductible (ET5) : 10110100 = 128 + 32 + 16 + 4 = 180.
Q22 : déductible (ET6) : 37 = 32 + 4 + 1, soit 00100101.
Q23 : déductible (ET4, Combien de valeurs) : on compte à partir de 0 et 0 est une valeur ; 32 est le nombre de valeurs, le plus grand nombre est 2^5 − 1 = 31.
Q24 : déductible (ET14, À retenir ; ET7 ; ET8) : les deux ont raison, chacun avec son codage. 72 105 33 donne « Hi! » en ASCII et une couleur rgb(72, 105, 33) en RGB. Les bits n'ont pas de sens seuls : le sens vient du codage du programme qui lit.
Q25 : déductible (ET11, Le binaire n'est pas un langage) : faux. Le binaire est une façon d'écrire des nombres avec deux chiffres, pas un langage. Programmer, c'est écrire du texte dans un langage (PHP, JavaScript), traduit en code machine ou exécuté par un interpréteur.
Q31 : déductible (ET9, Relire) : #00ff80 : 00 = 0, ff = 15 × 16 + 15 = 255, 80 = 8 × 16 = 128, soit rgb(0, 255, 128). Le chiffre de gauche écrit la moitié gauche de l'octet, dont les poids 128, 64, 32, 16 valent 16 fois ceux de la moitié droite (8, 4, 2, 1).
Q27 : déductible (ET10, La taille d'une photo) : 64 × 64 = 4 096 pixels, × 3 octets par pixel = 12 288.
Q30 : déductible (ET4, Les poids) : les poids doublent en allant vers la gauche : 1, 2, 4, 8, 16, 32, 64, 128, 256, 512. Le 10e bit, tout à gauche, pèse 512 = 2^9, un poids de plus que dans l'octet à chaque doublement.
C21 : déductible (ET6 + ET5) : 172 = 128 + 32 + 8 + 4, soit 10101100. 00110011 = 32 + 16 + 2 + 1 = 51.
C22b : déductible (ET4, Combien de valeurs) : 10 bits donnent 2^10 = 1 024 valeurs, le plus grand nombre est 1 023. Il n'est pas égal au nombre de valeurs parce que 0 est l'une des valeurs.
C23 : déductible (ET7, Quand « é » devient « Ã© » et Éviter « Ã© ») : les octets sont justes (UTF-8, deux octets pour le caractère accentué), mais le navigateur les a lus avec le mauvais codage, Latin-1, un caractère par octet. On l'évite en enregistrant la page en UTF-8 et en annonçant <meta charset="utf-8"> en tête de la page.
C27 : déductible (ET9, Relire et Écrire un octet) : #33cc99 : 33 = 3 × 16 + 3 = 51, cc = 12 × 16 + 12 = 204, 99 = 9 × 16 + 9 = 153, soit rgb(51, 204, 153). rgb(255, 64, 0) : 255 = 1111 1111 donc ff, 64 = 0100 0000 donc 40, 0 donc 00 : #ff4000.
C25 : déductible (ET11) : 1 7 range 7, 2 1 ajoute 1 donc 8, 3 0 affiche : il affiche 8. Réponse au collègue : le binaire est seulement une façon d'écrire des nombres avec deux chiffres, pas un langage. Ce qui fait du code machine un langage, c'est le jeu d'instructions du processeur, la table qui donne un sens aux octets.
DE31b : déductible (ET4, Combien de valeurs) : 2^12 = 4 096 valeurs (2^10 = 1 024, puis deux doublements : 2 048, 4 096). Chaque bit ajouté double le nombre de valeurs.
DE22 : déductible (ET4, Combien de valeurs) : 256 est le nombre de valeurs, pas le plus grand nombre. Avec 3 bits : 8 valeurs, de 0 à 7, donc le plus grand nombre est 8 − 1 = 7, pas 8. Pour un octet, c'est 255.
DE30 : déductible (ET14, À retenir ; ET7) : 01000101 = 64 + 4 + 1 = 69, et 69 est E dans la table. Aucun ne se trompe : le premier lit en binaire (un nombre), l'autre avec la table ASCII (une lettre).
DE24 : déductible (ET10, Une photo compressée ; ET14, À retenir) : non, il n'est pas forcément abîmé. Le fichier est une suite d'octets ; le Bloc-notes les lit avec sa table de caractères, donc la plupart tombent sur des signes sans suite ou des codes invisibles. Mauvais codage pour ce fichier, pas fichier abîmé.
DE25 : déductible (ET11, Le binaire n'est pas un langage) : le binaire n'est pas un langage de programmation, c'est une façon d'écrire des nombres avec deux chiffres. PHP est un vrai langage de programmation : du texte exécuté par un interpréteur (lui-même en code machine). Pas besoin d'apprendre « le binaire » comme langage.
DE32b : déductible (ET11 + ET14) : les mêmes octets donnent un programme avec le jeu d'instructions du processeur (affiche 65) et une lettre avec la table ASCII (A). Ce n'est donc pas le binaire qui en fait un programme : c'est le jeu d'instructions qui lit les octets.
DE27 : déductible (ET6, La méthode) : 128 rentre dans 180 : 1, reste 52 ; 64 ne rentre pas : 0 ; 32 rentre : 1, reste 20 ; 16 rentre : 1, reste 4 ; 8 ne rentre pas : 0 ; 4 rentre : 1, reste 0 ; 2 : 0 ; 1 : 0. Résultat 10110100. On commence par 128 car tous les poids plus petits ensemble valent 127 : si 128 rentre, aucun autre poids ne peut le remplacer, chaque décision est sûre.
DE28 : déductible (ET4, Les poids) : chaque 1 compte le poids de sa place, qui double d'un rang à l'autre : ici 128, 64 et 1. L'octet vaut 128 + 64 + 1 = 193.
DT30 : déductible (ET7, ET9, ET11) : a) ASCII, « Hi ». b) #c03060 est une couleur hexadécimale rgb : c0 = 12 × 16 = 192, 30 = 3 × 16 = 48, 60 = 6 × 16 = 96, soit rgb(192, 48, 96). c) jeu d'instructions du processeur imaginaire : 1 9 range 9, 3 0 affiche : 9.
DT22b : déductible (ET4, ET8) : avec 10 bits, le plus grand nombre est 2^10 − 1 = 1 023, intensité la plus forte d'une lumière. Un pixel a trois lumières : 3 × 10 = 30 bits.
DT23 : déductible (ET4, Les poids) : 00001011 = 8 + 2 + 1 = 11. 208 = 11010000 est ce même octet lu à l'envers : il a inversé le sens des poids (le plus lourd, 128, est à gauche). Bonne valeur : 11.
DT24 : déductible (ET4, ET14) avec une limite : non. Dans le système binaire de ce bloc, 11111111 est 255 (tous les poids à 1). Le programme lit les mêmes bits avec un autre codage, et le texte dit seulement que les nombres négatifs en demandent un autre ; je ne sais pas lequel ni comment il fonctionne.
DT28 : déductible (ET10, La taille d'une photo ; Ko Mo Go) : 800 × 600 = 480 000 pixels, un octet par pixel : 480 000 octets, soit 480 ko.
K21 : RECOPIÉE (ET3, Le compteur ; ET14, Les mots du bloc) : un bit est un chiffre qui vaut 0 ou 1.
K22 : RECOPIÉE (ET4, Bit et octet ; ET14, Les mots du bloc) : un octet, c'est 8 bits, 256 valeurs, de 0 à 255.
K23 : RECOPIÉE (ET4, Combien de valeurs ; ET14, Les mots du bloc) : avec n bits, 2^n valeurs, et le plus grand nombre est 2^n − 1.
K24 : RECOPIÉE (ET4, Les poids ; ET14, Les mots du bloc) : 128 64 32 16 8 4 2 1, de gauche à droite.
K25 : RECOPIÉE (ET4, Les poids ; ET14, Les mots du bloc) : une façon d'écrire les nombres avec deux chiffres (base 2), pas un langage.
K26 : RECOPIÉE (ET7, La table ASCII ; ET14, Les mots du bloc) : la règle qui dit comment lire des bits : nombre, lettre, couleur, instruction.
K33 : RECOPIÉE (ET7, La table ASCII) : calculer son nombre, puis chercher ce numéro dans la table.
K28 : RECOPIÉE (ET8, Trois lumières ; ET14, Les mots du bloc) : dans l'ordre, rouge, vert, bleu, chacun de 0 (éteint) à 255 (à fond).
K29 : RECOPIÉE (ET9, Écrire un octet ; ET14, Les mots du bloc) : écrire les 8 bits, couper au milieu, écrire chaque moitié avec son chiffre hexadécimal : deux chiffres, de 00 à ff.
K30 : RECOPIÉE (ET11, Le processeur ; ET14, Les mots du bloc) : la table du processeur qui dit ce que fait chaque instruction, et qui fait de certains octets des instructions (le code machine).
K31 : RECOPIÉE (ET10, Pixels et en-tête ; ET14, Les mots du bloc) : 3 octets par pixel, dans le cas le plus simple.
K34 : RECOPIÉE (ET10, La taille d'une photo) : largeur × hauteur × 3 octets (plus un en-tête de quelques octets).

## Liste 1 : éléments NON DÉDUCTIBLES, puis RECOPIÉS

NON DÉDUCTIBLES : aucun.

Réserves sur des éléments que j'ai tout de même classés déductibles :

- DT24 : la partie « explique ce qui se passe » n'est enseignée qu'au niveau « un autre codage lit les mêmes bits ». Le codage des négatifs est seulement nommé (« À explorer plus tard »). Si la réponse attendue détaille ce codage, elle n'est pas déductible.
- Q31, R35 et C23 : la justification (pourquoi le chiffre de gauche compte 16 fois ; pourquoi un bit compte selon sa place ; pourquoi « è » devient « Ã¨ ») est reconstruite à partir de règles écrites, mais la bonne réponse n'est donnée par aucune phrase du texte. Le texte ne donne que le cas « é » pour C23.
- R31 : « un rouge faible » repose sur le seul repère de l'échelle de 0 à 255. Aucun seuil n'est écrit. R32 et « mi-chemin » : même remarque.

RECOPIÉS : K21, K22, K23, K24, K25, K26, K33, K28, K29, K30, K31, K34 (les douze cartes). Chaque réponse est écrite telle quelle dans le texte, surtout dans « Les mots du bloc ».

## Liste 2 : mots ou notions employés par les questions et jamais définis

- Nombres négatifs et codage des négatifs (DT24) : seulement nommés, renvoyés à plus tard.
- « Bloc-notes » : employé comme un programme qui lit en caractères (DE24, PR7-5). Jamais défini, on l'infère du contexte.
- « Fichier de musique » (DE24) : aucun mot sur les formats audio, la compression d'une photo est le seul cas traité. Le raisonnement se transpose, il n'est pas écrit pour la musique.
- « Faible », « mi-chemin », « presque à fond » (R32) : jamais chiffrés, seulement l'échelle de 0 à 255 et un exemple (136 « un peu plus de la moitié »).
- « Niveaux de gris » (DT28) : défini dans la question elle-même.
- « Opacité » : mentionnée en ET9 sans être travaillée, non demandée.
- « UTF-8 » : seulement « deux octets pour é, le détail est pour plus tard ». Pas de règle pour prédire le nombre d'octets d'un autre caractère comme « è » (C23).

## Liste 3 : passages qui renvoient à autre chose que la fiche

- ET1 : « Les trois blocs suivants reposent sur celui-ci », et les trois autres idées de la partie La machine.
- ET7 : « Le détail est pour plus tard » (UTF-8).
- ET7 : « Dans ton navigateur » (console F12, charCodeAt, fromCharCode, TextEncoder) : action hors fiche.
- ET11 : « Sur la carte du bloc, tu as lu que tout, dans la machine, est écrit en binaire. »
- ET12 et ET15 : renvoi à « Ce qu'on te demande », parties Pratique et Restitution, « plus bas ». Restitution « sans le cours ».
- ET13 : « la page des blocs », « Prouvé », preuve « Aisance », niveaux de 30, 20, 10 secondes sur plusieurs jours.
- ET14 : « le schéma du cours s'affiche, pour comparer » ; « Tes mots et ton nombre de boîtes peuvent différer du cours ».
- ET14 « La suite » : le bloc suivant (logique), les composants, les langages. « À explorer plus tard » : UTF-8 en détail, nombres négatifs, compression JPEG, vrais jeux d'instructions x86 et ARM.
- ET9 : « La table des seize chiffres te sera redonnée chaque fois qu'une question convertit. »
- ET1 : « Replié sous " Ce qui sera vérifié " » (reproduit aussi en ET12).
- ET17 : les erreurs critiques « que la page a repérées dans tes réponses ».

## Liste 4 : passages qui parlent de la fiche au lieu de me parler

- Les étapes portent des numéros ET2, ET1, ET3 ... ET15, ET17 dans le désordre, sans ET16 : numéros jamais expliqués. Le titre porte « (version 66) ».
- ET4 : « Ce que tu as cherché avec le compteur a des noms. Les encadrés reprennent tes essais, là où ta réponse s'écartait. » Suivent des modèles bruts : « [seulement si l'essai c2 est faux] », « [la réponse à l'essai c2] », et ainsi de suite pour c1, c3b, c3c, c4, c5, c6, c7c, c7d, c7e, c8a, c8b. Je n'ai pas vu les essais, le texte reste cassé pour moi.
- ET3 : « Ici, pas de compteur, et ne reviens pas le chercher... Une réponse fausse ici n'a rien de grave, l'étape suivante part de tes réponses. »
- ET1 : « Replié sous " Ce qui sera vérifié " » : paragraphe de plan d'évaluation recopié (aussi dans ET12).
- ET12 : « Les exercices, un item à la fois : plus bas, dans " Ce qu'on te demande ", partie Pratique. »
- ET13 : explication de la preuve « Aisance » et de la page des blocs.
- ET14 : « Ça ne compte pas dans ta note : c'est un essai... pas pour réciter un dessin. Tu as deux essais, puis le schéma du cours s'affiche. » ; « Fais passer note.dat dans le schéma » avec la liste « Boîte donnée / Flèche à écrire / Boîte à écrire » : consignes de l'outil, pas du contenu.
- ET15 : « Elle se fait sans le cours... masqué jusqu'à ta dernière réponse... corrigées à la fin de la série, pour qu'une correction ne souffle pas la question suivante. »
- ET17 : « Une erreur cochée met le bloc " À reprendre " jusqu'à ce qu'une réponse solide... la referme » ; la case « Inverser le sens des poids » révèle un piège que le texte ne mentionne nulle part.
- Répétitions mécaniques : la table du jeu d'instructions est recopiée quatre fois en ET11, la table hexadécimale trois fois en ET9.
- Étiquettes de méthode adressées à l'apprenant : « Pas à pas : réponds à chaque question avant de passer à la suivante », « Sans aide », « À compléter », « À toi ».
