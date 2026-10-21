# B01 : réponses de l'apprenant

## Pratique

PR7-1 : déductible (ET5, Pas à pas) : 10010110, bits à 1 sous les poids 128, 16, 4 et 2 : 128 + 16 + 4 + 2 = 150.
PR7-2 : déductible (ET6, La méthode) : 77 → 128 non (0), 64 oui reste 13 (1), 32 non (0), 16 non (0), 8 oui reste 5 (1), 4 oui reste 1 (1), 2 non (0), 1 oui reste 0 (1) : 01001101.
PR7-3 : déductible (ET4, Combien de valeurs) : « 64 valeurs, c'est juste, mais le plus grand nombre est 63 » : on compte à partir de 0, qui est une valeur, donc le plus grand est 2^6 − 1 = 63.
PR7-4 : déductible (ET4, Combien de valeurs) : « 127 : le nombre de valeurs double, de 64 à 128, et le plus grand nombre est 128 − 1 ».
PR7-5 : déductible (ET5, Pas à pas ; ET7, La table ASCII) : 01011010 = 64 + 16 + 8 + 2 = 90, et 90 dans la table donne Z : le Bloc-notes affiche Z.
PR7-6 : déductible (ET11, Un programme de 6 octets) : 1 10 range 10 dans le registre ; 2 10 ajoute 10, registre 20 ; 3 0 affiche le registre : l'écran affiche 20.
PR8-1 : RECOPIÉE (ET9, Écrire un octet) : 00000000 (« Le bleu, 0, s'écrit 0000 0000 »).
PR8-2 : déductible (ET14, À retenir ; ET2, Un fichier, deux programmes) : « Ça dépend du programme qui les lit, et de son codage » : une suite de bits n'a pas de sens toute seule.
PR8-3 : déductible (ET6, La méthode ; ET8, Une couleur en octets) : 32 = 00100000, 192 = 128 + 64 = 11000000, 96 = 64 + 32 = 01100000.
PR8-4 : déductible (ET9, Écrire un octet) : 0010 0000 → 20, 1100 0000 → c0, 0110 0000 → 60 : #20c060.
PR8-5 : déductible (ET10, La taille d'une photo) : 800 × 600 = 480 000 pixels, × 3 octets = 1 440 000 octets (1,44 Mo).
PR8-6 : déductible (ET4, Les poids ; ET6, La méthode) : « Il a rangé les bits à l'envers : le poids 128 est à gauche. 163 s'écrit 10100011 » (128 + 32 + 2 + 1 = 163 ; 11000101 en est le miroir).
PR8-7 : déductible (ET11, Le binaire n'est pas un langage) : « Le jeu d'instructions du processeur, qui lit ces octets » : lus avec sa table, 1 6 range 6 et 3 0 l'affiche.

## Restitution

R21 : déductible (ET4, Combien de valeurs) : 8 bits donnent 2^8 = 256 valeurs, mais on compte à partir de 0 et 0 est une valeur, donc les valeurs vont de 0 à 255 et le plus grand est 2^8 − 1 = 255 ; avec 7 bits : 2^7 = 128 valeurs, plus grand nombre 127.
R29 : déductible (ET6, La méthode ; ET5, Sans les poids) : 128 = 10000000, 99 = 64 + 32 + 2 + 1 = 01100011, 0 = 00000000 ; 01010101 = 64 + 16 + 4 + 1 = 85, 11110000 = 128 + 64 + 32 + 16 = 240, 11111111 = 255.
R28 : déductible (ET5, Pas à pas ; ET7, La table ASCII ; ET8, Trois lumières ; ET14, À retenir) : comme nombre 64 + 2 + 1 = 67 ; comme lettre, 67 = C ; comme rouge d'un pixel, une intensité de 67 sur 255 (rouge assez faible) ; c'est le codage avec lequel le programme lit l'octet qui décide, l'octet seul n'a pas de sens.
R27 : RECOPIÉE (ET8, Une couleur en octets ; ET9, Écrire un octet) : 11111111 règle le rouge, à fond ; 10001000 règle le vert, à 136 sur 255 ; 00000000 règle le bleu, éteint ; en hexadécimal : #ff8800.
R25 : déductible (ET10, Pixels et en-tête ; La taille d'une photo ; Ko, Mo, Go) : Une photo est une grille de pixels. Chaque pixel prend trois octets, un par lumière : rouge, vert, bleu. Le fichier range ces octets à la suite, pixel après pixel, ligne après ligne. Au début, un en-tête donne la largeur et la hauteur, pour que le programme sache où couper les lignes. Calcul : 2 000 × 1 000 = 2 000 000 pixels × 3 = 6 000 000 octets, soit 6 Mo.
R26 : déductible (ET11, Un programme de 6 octets ; Le binaire n'est pas un langage) : 1 6 range 6, 2 4 ajoute 4 (registre 10), 3 0 affiche : 10 ; le binaire n'est qu'une façon d'écrire des nombres avec deux chiffres ; ce qui fait de ces octets un programme, c'est le jeu d'instructions du processeur : un autre processeur ferait tout autre chose des mêmes octets.

## Rappel

Q21 : déductible (ET5, Pas à pas) : 128 + 32 + 16 + 4 = 180.
Q22 : déductible (ET6, La méthode) : 37 = 32 + 4 + 1 : 00100101.
Q23 : déductible (ET4, Combien de valeurs) : on compte à partir de 0, et 0 est une des 32 valeurs : elles vont de 0 à 31, le plus grand est 2^5 − 1 = 31.
Q24 : déductible (ET14, À retenir ; ET8, Trois lumières) : les deux peuvent avoir raison : lus avec la table ASCII, ces octets donnent « Hi! », lus en RGB ils donnent une couleur ; le sens dépend du codage avec lequel le programme les lit.
Q25 : déductible (ET11, Le binaire n'est pas un langage) : faux : programmer, c'est écrire un texte dans un langage de programmation (mots et règles de grammaire, comme PHP ou JavaScript), rangé en octets avec un codage comme UTF-8, puis traduit en code machine ou exécuté par un interpréteur ; le binaire n'est qu'une façon d'écrire des nombres.
Q29 : déductible (ET9, Relire) : 00 = 0, ff = 15 × 16 + 15 = 255, 80 = 8 × 16 + 0 = 128 : rgb(0, 255, 128).
Q27 : déductible (ET10, La taille d'une photo) : 64 × 64 = 4 096 pixels, × 3 octets par pixel (un par lumière) = 12 288 octets.
Q28 : déductible (ET4, Les poids) : les poids partent de 1 pour le bit de droite et doublent à chaque bit vers la gauche (les puissances de 2) : 1, 2, 4, 8, 16, 32, 64, 128 ; le bit de gauche est le 8e, son poids est 2^7 = 128.

## Tâches différées

C21 : déductible (ET6, La méthode ; ET5, Pas à pas) : 172 = 128 + 32 + 8 + 4 : 10101100 ; 00110011 = 32 + 16 + 2 + 1 = 51.
C22 : déductible (ET4, Combien de valeurs) : 2^10 = 1 024 valeurs, plus grand nombre 1 023 ; la différence de 1 vient du 0, qui compte comme une valeur.
C23 : déductible (ET7, Quand « é » devient « Ã© » ; Éviter « Ã© ») : la page est en UTF-8, qui écrit « è » (hors des 128 premiers caractères) avec deux octets, mais le navigateur l'a lue avec Latin-1, qui donne un caractère à chaque octet : il a lu les deux octets séparément ; on l'évite en enregistrant la page en UTF-8 et en l'annonçant avec <meta charset="utf-8"> (je ne connais pas les octets exacts de « è »).
C26 : déductible (ET9, Relire ; Écrire un octet) : 33 = 3 × 16 + 3 = 51, cc = 12 × 16 + 12 = 204, 99 = 9 × 16 + 9 = 153 : rgb(51, 204, 153) ; 255 = ff, 64 = 0100 0000 = 40, 0 = 00 : #ff4000.
C25 : déductible (ET11, Un programme de 6 octets ; Le binaire n'est pas un langage) : 1 7 range 7, 2 1 ajoute 1 (registre 8), 3 0 affiche 8 ; réponse au collègue : le binaire sert seulement à écrire les octets ; ce qui fait du code machine un langage, c'est le jeu d'instructions du processeur, et les mêmes octets font tout autre chose sur un processeur avec une autre table.
DE21 : déductible (ET4, Combien de valeurs) : 2^12 = 1 024 × 2 × 2 = 4 096 valeurs, plus grand nombre 4 095 ; ils diffèrent de 1 parce qu'on compte à partir de 0, qui est une valeur.
DE22 : déductible (ET4, Combien de valeurs) : avec 3 bits, 2^3 = 8 valeurs, de 0 à 7 : le plus grand est 7, pas 8, car 0 est l'une des 8 ; de même un octet a 256 valeurs de 0 à 255, et va jusqu'à 255.
DE23 : déductible (ET7, La table ASCII ; ET14, À retenir) : aucun ne se trompe : 01000101 = 64 + 4 + 1 = 69 avec le codage binaire, et 69 est E dans la table ASCII ; chacun lit les mêmes bits avec son codage.
DE24 : déductible (ET10, Une photo compressée ; ET14, À retenir) : pas forcément : le Bloc-notes lit les octets du fichier avec sa table de caractères, alors qu'ils ne sont pas du texte ; la plupart tombent sur des signes sans suite ou des codes invisibles ; c'est la lecture qui est mauvaise, pas le fichier.
DE25 : déductible (ET11, Le binaire n'est pas un langage) : le binaire n'est pas un langage, c'est une façon d'écrire des nombres ; ce que le processeur exécute, c'est du code machine, lu avec son jeu d'instructions ; ton programme PHP est du texte rangé en octets (UTF-8), exécuté par un interpréteur lui-même en code machine.
DE26 : déductible (ET11, Le processeur ; Le binaire n'est pas un langage) : le jeu d'instructions du processeur qui les lit : avec sa table, 1 6 veut dire « range 6 » et 3 0 « affiche le registre » ; lus avec un autre codage, ce seraient des nombres ou des lettres.
DE27 : déductible (ET6, La méthode) : reste 180 ; 128 rentre → 1, reste 52 ; 64 non → 0 ; 32 rentre → 1, reste 20 ; 16 rentre → 1, reste 4 ; 8 non → 0 ; 4 rentre → 1, reste 0 ; 2 non → 0 ; 1 non → 0 : 10110100 ; on commence par 128 parce que tous les poids plus petits ensemble valent 127, moins que lui : aucun ne peut le remplacer, chaque décision est sûre et les bits s'écrivent de gauche à droite.
DE28 : déductible (ET4, Les poids ; ET5, Pas à pas) : chaque bit a un poids selon sa place : les trois 1 sont sous les poids 128, 64 et 1 ; l'octet vaut 128 + 64 + 1 = 193.
DT26 : déductible (ET7, La table ASCII ; ET9, Relire ; ET11, Un programme de 6 octets) : a) codage ASCII : 72 105 = « Hi » ; b) hexadécimal RGB : c0 = 192, 30 = 48, 60 = 96 : rgb(192, 48, 96) ; c) jeu d'instructions du processeur : 1 9 range 9, 3 0 affiche 9.
DT22 : déductible (ET4, Combien de valeurs ; ET8, Trois lumières) : 2^10 = 1 024 valeurs d'intensité, la plus forte 1 023 ; un pixel a trois lumières : 3 × 10 = 30 bits.
DT23 : déductible (ET4, Les poids ; ET5, Pas à pas) : il a lu les poids à l'envers (128 à droite) : 00001011 lu ainsi donne 128 + 64 + 16 = 208 ; le poids 128 est à gauche : 8 + 2 + 1 = 11.
DT24 : déductible (ET4, Combien de valeurs ; ET14, À explorer plus tard) : non : dans le système binaire de ce bloc, un octet va de 0 à 255, et 11111111 vaut 255 ; le programme lit l'octet avec un autre codage, celui des nombres négatifs, que le bloc ne décrit pas.
DT25 : déductible (ET10, La taille d'une photo) : 800 × 600 = 480 000 pixels × 1 octet = 480 000 octets (480 ko).

## Cartes

K21 : RECOPIÉE (ET14, Les mots du bloc) : un chiffre binaire : 0 ou 1.
K22 : RECOPIÉE (ET14, Les mots du bloc) : 8 bits ; 256 valeurs, de 0 à 255.
K23 : RECOPIÉE (ET14, Les mots du bloc) : 2^n valeurs ; le plus grand nombre est 2^n − 1.
K24 : RECOPIÉE (ET14, Les mots du bloc) : 128 64 32 16 8 4 2 1.
K25 : RECOPIÉE (ET14, Les mots du bloc) : une façon d'écrire les nombres avec deux chiffres ; pas un langage.
K26 : RECOPIÉE (ET14, Les mots du bloc) : la règle qui dit comment lire des bits : nombre, lettre, couleur, instruction.
K27 : RECOPIÉE (ET14, Les mots du bloc) : A = 65, a = 97.
K28 : RECOPIÉE (ET14, Les mots du bloc ; ET8, Trois lumières) : l'intensité du rouge, du vert et du bleu, chacune de 0 à 255.
K29 : RECOPIÉE (ET14, Les mots du bloc ; ET9, Écrire un octet) : en deux chiffres hexadécimaux, un par moitié de 4 bits, de 00 à ff.
K30 : RECOPIÉE (ET14, Les mots du bloc) : la table du processeur qui fait de certains octets des instructions.
K31 : RECOPIÉE (ET14, Les mots du bloc) : 3 octets, dans le cas le plus simple.
K32 : RECOPIÉE (ET14, Les mots du bloc) : 1 000 octets, 1 000 ko, 1 000 Mo, 1 000 Go.

## Listes finales

### 1. Éléments NON DÉDUCTIBLES, puis éléments RECOPIÉS

- NON DÉDUCTIBLES : aucun.
- RECOPIÉS : PR8-1 (« 0 s'écrit 0000 0000 », ET9) ; R27 (les trois octets, leur rôle et #ff8800 sont écrits tels quels en ET8 et ET9) ; K21 à K32 (toutes dans « Les mots du bloc », ET14).

### 2. Mots ou notions employés par les questions et jamais définis par le texte

- « niveaux de gris » (DT25) : jamais défini ; la question donne seulement « un octet par pixel ».
- « fichier de musique » (DE24) : jamais traité ; le texte ne parle que de photos, textes, pages et programmes.
- « nombre −1 », nombres négatifs (DT24) : seulement nommés dans « À explorer plus tard », aucun codage donné.
- « è » (C23) : ses octets UTF-8 ne sont jamais donnés, et le caractère « ¨ » n'est pas dans l'extrait Latin-1.
- « PHP » (Q25, DE25) : seulement nommé comme exemple de langage exécuté par un interpréteur ; « interpréteur » est défini en une phrase.
- « fichier texte » (DT26 a) : jamais défini en tant que tel.

### 3. Passages qui renvoient à autre chose que la fiche

- ET1, « Où tu es » : la partie « La machine » et les trois blocs suivants (Décider ; L'ordinateur et ses composants ; Du langage machine aux langages de haut niveau).
- ET7, « Dans ton navigateur » et « Éviter « Ã© » » : la console du navigateur (F12).
- ET7, « Pourquoi pas un seul octet » : « Le détail est pour plus tard. » (UTF-8).
- ET9, « Deux variantes » : « La table des seize chiffres te sera redonnée chaque fois qu'une question convertit. »
- ET13 : la preuve « Aisance » du bloc, « dans ses Cinq preuves », non décrites dans la fiche ; « reviens ici les jours suivants ».
- ET14, « La suite » : le bloc suivant (logique ET, OU, NON), puis les composants et les langages.
- ET14, « À explorer plus tard » : UTF-8 en détail, nombres négatifs, compression JPEG, vrais jeux d'instructions x86 et ARM.
- ET17, « Bilan » : « les erreurs critiques du bloc », liste absente de la fiche, et l'état « À reprendre ».
- Numérotation : l'étape ET16 manque (ET15 puis ET17).
