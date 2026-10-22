# B01 : réponses de l'apprenant neuf (version 35)

## Pratique

PR7-1 : déductible (ET5, « Pas à pas » et « Sans les poids ») : 10010110 → poids 128 + 16 + 4 + 2 = 150.
PR7-2 : déductible (ET6, « La méthode ») : 77 → 128 non (0), 64 oui reste 13 (1), 32 non (0), 16 non (0), 8 oui reste 5 (1), 4 oui reste 1 (1), 2 non (0), 1 oui reste 0 (1) : 01001101.
PR7-3 : déductible (ET4, « Combien de valeurs ») : 64 valeurs, c'est juste, mais on compte à partir de 0, donc le plus grand nombre est 2^6 − 1 = 63.
PR7-4 : déductible (ET4, « Combien de valeurs ») : 127 : le nombre de valeurs double, de 64 à 128, et le plus grand nombre est 128 − 1.
PR7-5 : déductible (ET5, « Sans les poids » ; ET7, « La table ASCII ») : 01011010 = 64 + 16 + 8 + 2 = 90, et 90 dans la table, c'est Z.
PR7-6 : déductible (ET11, « Un programme de 6 octets ») : 1 10 range 10 dans le registre, 2 10 ajoute 10 (registre 20), 3 0 affiche : l'écran affiche 20.
PR8-1 : déductible (ET6, « La méthode ») : 6 = 4 + 2 → 00000110.
PR8-2 : déductible (ET14, « À retenir » ; ET2) : Ça dépend du programme qui les lit, et de son codage : une suite de bits n'a pas de sens toute seule.
PR8-3 : déductible (ET8, « Une couleur en octets » ; ET6, « La méthode ») : 32 → 00100000, 192 = 128 + 64 → 11000000, 96 = 64 + 32 → 01100000.
PR8-4 : déductible (ET9, « Écrire un octet ») : 0010 0000 → 20, 1100 0000 → c0, 0110 0000 → 60 : #20c060.
PR8-5 : déductible (ET10, « La taille d'une photo ») : 800 × 600 = 480 000 pixels, × 3 octets = 1 440 000 octets.
PR8-6 : déductible (ET4, « Les poids » ; ET6, « La méthode ») : Il a rangé les bits à l'envers : le poids 128 est à gauche. 163 = 128 + 32 + 2 + 1 s'écrit 10100011 (son 11000101 est cette suite retournée).
PR8-8 : déductible (ET11, « Un autre processeur » et « Le binaire n'est pas un langage ») : Chaque processeur les lit avec son jeu d'instructions, et les deux tables diffèrent : les mêmes octets font autre chose avec une autre table.

## Restitution

R21 : déductible (ET4, « Combien de valeurs ») : Avec 8 bits il y a 2^8 = 256 valeurs, mais on compte à partir de 0 et 0 est une valeur : les 256 valeurs vont de 0 à 255, donc le plus grand est 2^8 − 1 = 255. Avec 7 bits : 2^7 = 128 valeurs, et le plus grand nombre est 127.
R35 : déductible (ET4, « Les poids » ; ET5, « Pas à pas ») : 01010101 = 64 + 16 + 4 + 1 = 85. Un bit à 1 compte selon le poids de sa place : en partant de la droite les poids sont 1, 2, 4, 8, 16, 32, 64, 128, chacun le double du précédent (des puissances de 2) ; plus le bit est à gauche, plus il compte.
R31 : déductible (ET5 ; ET7, « La table ASCII » ; ET8, « Trois lumières » ; ET14, « À retenir ») : 01000011 = 64 + 2 + 1 = 67. Avec la table ASCII : la lettre C. Comme rouge en RGB : une intensité de 67 sur 255, un rouge plutôt faible. Aucune lecture n'est bonne toute seule : c'est le codage avec lequel le programme lit l'octet qui décide.
R32 : déductible (ET8, « Une couleur en octets » ; ET6, « La méthode ») : 144 = 128 + 16 → 10010000 ; 48 = 32 + 16 → 00110000 ; 224 = 128 + 64 + 32 → 11100000. Rouge 144 sur 255 : à mi-chemin (un peu plus de la moitié, comme 136 dans l'exemple) ; vert 48 : faible ; bleu 224 : presque à fond.
R34 : déductible (ET10, « Pixels et en-tête », « La taille d'une photo », « Ko, Mo, Go ») : Une photo est une grille de pixels. Chaque pixel prend trois octets, un par lumière : rouge, vert, bleu. Le fichier range ces octets à la suite, pixel après pixel, ligne après ligne. Au début, un en-tête donne la largeur et la hauteur, pour que le programme sache où couper les lignes. Calcul : 2 000 × 1 000 = 2 000 000 pixels, × 3 = 6 000 000 octets, soit 6 Mo (6 000 ko).
R26 : déductible (ET11, « Un programme de 6 octets » et « Le binaire n'est pas un langage ») : 1 6 range 6, 2 4 ajoute 4 (registre 10), 3 0 affiche : 10. Le binaire est seulement une façon d'écrire des nombres avec deux chiffres, comme le décimal avec dix ; il dit comment c'est écrit, pas ce que c'est. Ce qui fait du code machine un langage, c'est le jeu d'instructions du processeur ; un langage de programmation, ce sont des mots et des règles de grammaire pour écrire un programme en texte (PHP, JavaScript).

## Rappel

Q21 : déductible (ET5, « Sans les poids ») : 10110100 = 128 + 32 + 16 + 4 = 180.
Q22 : déductible (ET6, « La méthode ») : 37 = 32 + 4 + 1 → 00100101.
Q23 : déductible (ET4, « Combien de valeurs ») : Parce qu'on compte à partir de 0 et que 0 est une valeur : les 32 valeurs vont de 0 à 31, le plus grand est 2^5 − 1 = 31.
Q24 : déductible (ET7, « La table ASCII » ; ET8, « Trois lumières » ; ET14, « À retenir ») : Aucun n'a raison tout seul, ou les deux : 72, 105, 33 donnent « Hi! » avec la table ASCII et rgb(72, 105, 33) lus comme une couleur. Le sens vient du codage avec lequel le programme lit les octets.
Q25 : déductible (ET11, « Le binaire n'est pas un langage ») : Faux. Programmer, c'est écrire un programme en texte, avec les mots et la grammaire d'un langage comme PHP ou JavaScript. Ce texte est rangé en octets (en binaire, comme tout), puis traduit en code machine ou exécuté par un interpréteur. Le binaire n'est qu'une façon d'écrire des nombres.
Q29 : déductible (ET9, « Relire ») : 00 → 0 ; ff → 15 × 16 + 15 = 255 ; 80 → 8 × 16 + 0 = 128 : rgb(0, 255, 128).
Q27 : déductible (ET10, « La taille d'une photo ») : 64 × 64 = 4 096 pixels, × 3 octets par pixel (rouge, vert, bleu) = 12 288 octets.
Q30 : déductible (ET4, « Les poids » et « Combien de valeurs ») : 512. Les poids doublent à chaque place depuis la droite : 1, 2, 4, …, soit 2^0 à 2^9 pour 10 bits ; le bit de gauche, le 10e, vaut 2^9 = 512.

## Tâches différées

C21 : déductible (ET6, « La méthode » ; ET5) : 172 = 128 + 32 + 8 + 4 → 10101100. 00110011 = 32 + 16 + 2 + 1 = 51.
C22 : déductible (ET4, « Combien de valeurs ») : 2^10 = 1 024 valeurs, plus grand nombre 1 023. La différence de 1 vient du 0 : on compte à partir de 0, et 0 est une des valeurs.
C23 : déductible (ET7, « Quand « é » devient « Ã© » » et « Éviter « Ã© » ») : « è » n'est pas dans ASCII ; la page l'a écrit en UTF-8, avec deux octets. Le navigateur, faute d'annonce du codage (ou avec une fausse annonce), a lu la page avec Latin-1, un caractère par octet : les deux octets donnent deux caractères, Ã et ¨. Les octets sont justes, c'est le codage de lecture qui est faux. On l'évite en enregistrant la page en UTF-8 et en mettant <meta charset="utf-8"> en tête de la page HTML. (Je ne peux pas vérifier les valeurs des deux octets de « è » : elles ne sont pas données.)
C26 : déductible (ET9, « Relire » et « Écrire un octet ») : #33cc99 → 3 × 16 + 3 = 51, 12 × 16 + 12 = 204, 9 × 16 + 9 = 153 : rgb(51, 204, 153). rgb(255, 64, 0) : 255 = 1111 1111 → ff, 64 = 0100 0000 → 40, 0 → 00 : #ff4000.
C25 : déductible (ET11, « Un programme de 6 octets » et « Le binaire n'est pas un langage ») : Range 7, ajoute 1, affiche : 8. Je lui réponds : le code machine est écrit en binaire, mais « en binaire » dit seulement comment c'est écrit. Ce qui en fait un langage, c'est le jeu d'instructions du processeur : les mêmes octets font autre chose avec une autre table. Le binaire est une façon d'écrire des nombres, pas un langage.
DE21 : déductible (ET4, « Combien de valeurs ») : 2^12 = 1 024 × 2 × 2 = 4 096 valeurs, plus grand nombre 4 095. Ils diffèrent de 1 parce que 0 est une des valeurs : on compte de 0 à 4 095.
DE22 : déductible (ET3, « Le compteur » ; ET4, « Combien de valeurs ») : 256 est le nombre de valeurs, pas le plus grand nombre. Avec 3 bits : 2^3 = 8 valeurs, 0, 1, 2, 3, 4, 5, 6, 7 ; le plus grand est 7 = 8 − 1. De même un octet a 256 valeurs, de 0 à 255.
DE30 : déductible (ET7, « La table ASCII » ; ET14, « À retenir ») : Aucun ne se trompe. 01000101 = 64 + 4 + 1 = 69 ; lu comme un nombre c'est 69, lu avec la table ASCII c'est E. Ce sont deux codages différents pour les mêmes bits.
DE24 : déductible (ET1 ; ET10, « Une photo compressée » ; ET14, « À retenir ») : Non, pas forcément abîmé. Le fichier est une suite d'octets ; le Bloc-notes la lit avec sa table de caractères, qui n'est pas son codage : la plupart des octets tombent sur des signes sans suite ou des codes invisibles, d'où le charabia, comme pour une photo.
DE25 : déductible (ET11, « Le binaire n'est pas un langage ») : Le binaire n'est pas un langage, c'est une façon d'écrire des nombres avec deux chiffres. Son programme PHP est du texte, rangé en octets avec un codage comme UTF-8, et exécuté par un interpréteur, lui-même en code machine. Ce que le processeur exécute, c'est du code machine, lu avec son jeu d'instructions ; il n'y a pas de « binaire » à apprendre comme langage.
DE29 : déductible (ET11 ; ET7, « La table ASCII » ; ET14, « À retenir ») : Le processeur range 65 puis l'affiche : 65. Lu avec la table ASCII, l'octet 65 est la lettre A. Les deux lectures montrent que les mêmes octets donnent un programme ou du texte selon la règle qui les lit : c'est le jeu d'instructions qui en fait un programme, pas le binaire.
DE27 : déductible (ET6, « La méthode ») : Reste 180. 128 rentre : 1, reste 52. 64 ne rentre pas : 0. 32 rentre : 1, reste 20. 16 rentre : 1, reste 4. 8 ne rentre pas : 0. 4 rentre : 1, reste 0. 2 : 0. 1 : 0. Donc 10110100. On commence par 128 parce que tous les poids plus petits ensemble valent 127, moins que lui : si 128 rentre, rien ne peut le remplacer, chaque décision est sûre et les bits s'écrivent de gauche à droite.
DE28 : déductible (ET4, « Les poids » ; ET5) : Chaque 1 vaut le poids de sa place : celui de gauche 128, le suivant 64, celui de droite 1. L'octet vaut 128 + 64 + 1 = 193.
DT26 : déductible (ET7 ; ET9, « Relire » ; ET11 ; ET14, « Quatre lectures ») : a) table ASCII : 72 → H, 105 → i : « Hi ». b) hexadécimal relu en RGB : c0 = 12 × 16 = 192, 30 = 3 × 16 = 48, 60 = 6 × 16 = 96 : rgb(192, 48, 96). c) jeu d'instructions du processeur : 1 9 range 9, 3 0 affiche : 9.
DT22 : déductible (ET4, « Combien de valeurs » ; ET8, « Trois lumières ») : 2^10 = 1 024 valeurs d'intensité, la plus forte 1 023 ; un pixel a trois lumières, donc 3 × 10 = 30 bits.
DT23 : déductible (ET4, « Les poids » ; ET17, erreur « Inverser le sens des poids ») : Il a inversé le sens des poids, en mettant 128 à droite : il a lu 11010000 = 128 + 64 + 16 = 208. Le poids 128 est à gauche : 00001011 = 8 + 2 + 1 = 11.
DT24 : déductible (ET4 ; ET14, « À retenir » et « À explorer plus tard ») : Non : dans le système binaire de ce bloc, 11111111 vaut 255, et un octet va de 0 à 255, sans nombre négatif. Le programme lit l'octet avec un autre codage, fait pour les nombres négatifs, que ce bloc n'enseigne pas. Comment ce codage donne −1, je ne le sais pas : ce n'est pas expliqué.
DT28 : déductible (ET10, « La taille d'une photo » et « Ko, Mo, Go ») : 800 × 600 = 480 000 pixels, × 1 octet = 480 000 octets, soit 480 ko.

## Cartes

K21 : RECOPIÉE (ET3, « Le compteur » ; ET14, « Les mots du bloc ») : Un chiffre binaire, qui vaut 0 ou 1.
K22 : RECOPIÉE (ET4, « Bit et octet » ; ET14, « Les mots du bloc ») : Huit bits à la suite ; 256 valeurs, de 0 à 255.
K23 : RECOPIÉE (ET4, « Combien de valeurs » ; ET14, « Les mots du bloc ») : 2^n valeurs ; le plus grand nombre est 2^n − 1.
K24 : RECOPIÉE (ET14, « Les mots du bloc ») : 128, 64, 32, 16, 8, 4, 2, 1.
K25 : RECOPIÉE (ET4, « Les poids » ; ET14, « Les mots du bloc ») : Une façon d'écrire les nombres avec deux chiffres, 0 et 1, où chaque bit a un poids, puissance de 2. Pas un langage.
K26 : RECOPIÉE (ET7, « La table ASCII » ; ET14, « Les mots du bloc ») : La règle qui dit comment lire des bits : nombre, lettre, couleur, instruction.
K33 : RECOPIÉE (ET7, « La table ASCII ») : Je calcule son nombre, puis je cherche ce numéro dans la table.
K28 : RECOPIÉE (ET8, « Trois lumières » ; ET14, « Les mots du bloc ») : L'intensité du rouge, du vert et du bleu, dans cet ordre, chacune de 0 (éteinte) à 255 (à fond).
K29 : RECOPIÉE (ET9, « Écrire un octet » ; ET14, « Les mots du bloc ») : En deux chiffres hexadécimaux, un par moitié de 4 bits, de 00 à ff.
K30 : RECOPIÉE (ET11, « Le processeur » ; ET14, « Les mots du bloc ») : La table qui dit ce que fait chaque instruction ; elle fait de certains octets des instructions, le code machine.
K31 : RECOPIÉE (ET10, « Pixels et en-tête » ; ET14, « Les mots du bloc ») : 3 octets, un par lumière.
K34 : RECOPIÉE (ET10, « La taille d'une photo ») : Largeur × hauteur × 3 octets.

## Décompte

57 éléments : 45 déductibles, 12 recopiées, 0 non déductible, 0 hors champ assumé.

## Listes

### 1. Éléments NON DÉDUCTIBLES, puis éléments RECOPIÉS

Non déductibles : aucun.
(Limites signalées dans des éléments déductibles : C23, les valeurs des deux octets de « è » et le caractère ¨ ne sont donnés nulle part ; DT24, le codage des nombres négatifs est seulement nommé, la façon dont il donne −1 n'est pas enseignée.)

Recopiés : K21, K22, K23, K24, K25, K26, K33, K28, K29, K30, K31, K34. Les douze cartes reprennent mot pour mot « Les mots du bloc » (ET14) ou une phrase de méthode (ET7, ET10) : elles ne vérifient que la lecture.

### 2. Mots ou notions employés par les questions et jamais définis par le texte

- « faible », « à mi-chemin », « presque à fond » (R32) : aucun seuil donné ; seul l'exemple « 136 sur 255, un peu plus de la moitié » existe.
- « programmer » (Q25) : seul « langage de programmation » est défini.
- « fichier texte » (DT26 a) : jamais défini ; le texte parle seulement du Bloc-notes et de sa table de caractères.
- « feuille CSS » (DT26 b) : employée en ET8 sans définition ; seul CSS est défini.
- « fichier de musique » (DE24) : jamais évoqué.
- nombres négatifs, −1 (DT24) : seulement nommés dans « À explorer plus tard ».
- le caractère « ¨ » (C23) : absent de l'extrait Latin-1.
- « intensité » : utilisée (ET8, R31, R32, DT22) sans autre définition que « de 0 (éteinte) à 255 (à fond) ».

### 3. Passages qui renvoient à autre chose que la fiche

- ET1 : la partie « La machine » et ses trois blocs suivants (« Décider », « L'ordinateur et ses composants », « Du langage machine aux langages de haut niveau ») ; « Ce qui sera vérifié », replié.
- ET7 : « Le détail est pour plus tard » (UTF-8) ; la console du navigateur (F12), outil extérieur à la fiche.
- ET10 : la convention de Windows (par 1 024), non travaillée.
- ET11 : les vrais processeurs x86 et ARM, seulement nommés.
- ET13 : la preuve « Aisance » « dans ses Cinq preuves », jamais décrites ; « reviens ici les jours suivants ».
- ET14 : « La suite » (le bloc suivant sur la logique ET, OU, NON, puis les composants et les langages) ; « À explorer plus tard » (UTF-8 en détail, nombres négatifs, compression JPEG, vrais jeux d'instructions).
- ET15 : « sans le cours », qui renvoie à un cours distinct de la fiche.
- ET17 : le statut « À reprendre » du bloc, géré hors de la fiche.
