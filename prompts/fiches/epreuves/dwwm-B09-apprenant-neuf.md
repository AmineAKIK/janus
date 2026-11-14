# Épreuve de l'apprenant neuf : B09 (texte v6)

## Réponses, dans l'ordre

PR1-1 : déductible (ET4, « Une option qui attend un argument » et « Commande, option, argument ») : -a est une option (tiret) ; -L est une option qui attend un argument ; 2 est l'argument de -L (le nombre de niveaux), pas un argument de tree ; /etc est l'argument de la commande, le dossier à afficher.
PR1-2 : déductible (ET4, « Commande, option, argument » et « Plusieurs options » ; ET6, « Voir ce qu'un dossier contient ») : ls -l /Users/farid (ou ls -l ~, ou ls -l s'il est déjà dans son dossier personnel).
PR1-3 : déductible (ET4, « Plusieurs options » et « Sans le tiret ») : ls -tl /usr donne la même liste (deux options d'une lettre collées derrière un seul tiret, lues -t -l ; l'ordre n'importe pas, ce que le texte écrit seulement pour -la/-al, mais aucune des deux n'attend d'argument) ; ls -l t /usr ne donne pas la même liste : sans tiret, t est un argument, un nom de dossier ou de fichier que ls cherche en plus de /usr, et la liste n'est pas triée par date.
PR1-4 : déductible (ET4, « Plusieurs options ») : ls -Ra /etc (ou ls -aR /etc).
PR1-5 : déductible (ET5, « Les crochets » et « Les points de suspension », tableau) : COMMAND, dans nohup : hors crochets et sans points, donc obligatoire, exactement un ; [SUFFIX], dans basename : entre crochets, donc facultatif, aucun ou un ; NAME..., dans dirname : hors crochets, donc obligatoire, et suivi de points, donc répétable : un ou plusieurs.
PR1-6 : déductible (ET5, « La barre verticale » et « Les points de suspension ») : pwd : prévue (tout est entre crochets) ; pwd -L -P : non prévue (la barre impose un seul des deux choix) ; which : non prévue (program est hors crochets, donc obligatoire) ; which ls tree : prévue (program suivi de points, donc répétable).
PR1-7 : déductible (ET5, « Deux écritures, une notation », « Les options longues », « cd n'a pas sa page ») : ls -t /usr : acceptée (t est dans le premier crochet) ; ls --recursive /usr : refusée (option longue absente du SYNOPSIS du Mac, qui n'a presque que des options courtes) ; ls -S /usr : acceptée (S est dans le premier crochet) ; ls --size /usr : refusée (même raison que --recursive) ; help cd : refusée (la commande help n'existe pas dans zsh).
PR1-8 : déductible (ET5, « Les options longues » et « cd n'a pas sa page ») : which -a tree : acceptée (a est dans [-as], tree tient la place de program) ; which --help : refusée (--help n'est pas dans son SYNOPSIS ; --help ne répond que si le manuel le dit) ; help which : refusée (help n'existe pas dans zsh).
PR1-9 : déductible (ET7, « Remonter ») : /var/log (la deuxième paire de points remonte de /var/www à /var, puis log descend dans /var/log).
PR1-10 : déductible (ET7, « Remonter » et « Depuis la racine ») : cd ../images (ou cd /Users/farid/projet/images, ou cd ~/projet/images).
PR1-11 : déductible (ET7, « Depuis la racine », « Remonter », « Revenir au dossier personnel » ; ET6, « La racine ») : cd → /home/yasmine ; cd .. → /usr ; cd . → /usr/share (elle ne bouge pas, . est le répertoire courant) ; cd / → la racine, / ; cd ../bin → /usr/bin ; cd /share → échoue (chemin absolu, la racine ne contient pas share), elle reste dans /usr/share.
PR1-12 : déductible (ET8, « Dans les commandes et les options » et « Dans les noms ») : -d et -D : deux options différentes (la casse compte dans les options) ; pwd et PWD dans Ubuntu : différents (le nom d'une commande suit la même règle, comme LS n'est pas ls) ; notes.txt et Notes.txt sur Linux : deux noms différents ; sur le disque d'un Mac réglé comme d'habitude : le même fichier.
PR1-13 : déductible (ET8, « Dans les noms » et « La 404 de Farid ») : elle manque : le serveur cherche exactement plage.jpg, le fichier s'appelle Plage.JPG, un autre nom sous Linux.
B09-R1 : déductible (ET5, « Les crochets » et « Les points de suspension ») : après cut, elle doit écrire au moins une option (OPTION est hors crochets, donc obligatoire) et peut en écrire plusieurs (points) ; elle peut ajouter des noms de fichiers, aucun, un ou plusieurs ([FILE]...). cut tout seul n'est pas une ligne complète.
B09-R2 : déductible (ET5, « La barre verticale », « Les crochets », « Les points de suspension ») : tail notes.txt : prévue ; tail -n 5 -c 20 notes.txt : non prévue (-c et -n sont séparés par une barre, un seul choix) ; tail -f -n 5 notes.txt journal.txt : prévue (un choix dans chaque crochet, file répétable) ; tail -r -f notes.txt : non prévue (-r et -f sont séparés par une barre).
B09-R3 : déductible (ET7, « Remonter » et « Depuis la racine ») : chemin relatif ../img ; pour marcher depuis n'importe quel dossier, le chemin absolu /var/www/site/img.
B09-R4 : déductible (ET7, « Remonter » et « Revenir au dossier personnel ») : cd .. remonte au parent de projet, qui se trouve être /Users/farid ; cd ~ mène au dossier personnel, /Users/farid, quel que soit le départ. Depuis /var/log, seul cd ~ l'y mènerait encore (cd .. mènerait dans /var).
B09-R5 : déductible (ET8, « Dans les noms » et « La 404 de Farid ») : le serveur répondra 404 pour contact.html : sous Linux, Contact.html et contact.html sont deux noms, et aucun fichier ne s'appelle exactement contact.html. Sur son PC, le disque de Windows ne tient pas compte de la casse et désigne le même fichier par les deux noms : il cachait l'erreur.
B09-R6 : déductible (ET4, « Sans le tiret » ; ET8, « Dans les noms » ; ET7, « Depuis là où tu es ») : le l n'a pas de tiret, donc wc le lit comme un argument, un fichier nommé l, et ne compte pas les lignes ; et Site n'est pas site, sous Linux deux noms différents, donc Site/index.html n'existe pas. Ligne correcte : wc -l site/index.html.
B09-Q1 : déductible (ET5, « Ouvrir, lire, quitter ») : tant que la page de manuel est ouverte, ce qu'il tape va à la page, pas au shell ; il tape d'abord q pour la fermer, puis ls -a.
B09-Q2 : déductible (ET4, « Sans le tiret » et « Une option qui attend un argument ») : sans tiret, n n'est pas une option : head le lit comme un argument, un nom de fichier ; 3 n'est donc l'argument d'aucune option, c'est aussi un argument de head, un fichier nommé 3, comme notes.txt.
B09-Q3 : déductible (ET5, « Les options longues » et « Ouvrir, lire, quitter ») : --help n'est pas dans le SYNOPSIS de son cat, et les commandes du Mac n'ont presque que des options courtes : il peut prévoir que cat --help sera refusé. Pour le détail des options, il tape man cat et lit la section DESCRIPTION (puis q).
B09-Q4 : déductible (ET5, « cd n'a pas sa page ») : exit est une commande interne du shell, que bash exécute lui-même, donc help la connaît ; ls est un programme rangé sur le disque, pas une commande interne, donc help le refuse (ls a sa page de manuel).
B09-Q5 : déductible (ET6, « Le répertoire courant ») : Yasmine (bash) lit le chemin entier, /usr/share ; Farid (zsh) ne lit que le dernier nom, share, et tape pwd pour connaître son répertoire courant.
B09-Q6 : déductible (ET7, « Depuis la racine » et « Depuis là où tu es ») : cd www/site, relatif, part de /var et la mène dans /var/www/site ; cd /www/site, absolu, cherche www dans la racine (/www/site), et échoue s'il n'y en a pas.
B09-Q7 : déductible (ET7, « Remonter ») : il arrive dans /Users/farid/projet/images ; . désigne le répertoire courant (pages) et ne le déplace pas ; .. remonte au parent, projet ; puis images descend dans images.
B09-Q8 : déductible (ET8, « Dans les commandes et les options » ; ET4, « Une option qui attend un argument ») : -i et -I sont deux options différentes (la casse compte) ; -i n'attend pas d'argument (il affiche un numéro), donc tmp n'est pas un nom à cacher : c'est l'argument de ls, qui affiche le contenu de tmp avec un numéro devant chaque nom, au lieu de le cacher. Il fallait ls -I tmp.
B09-C1 : déductible (ET7, « Depuis là où tu es » ; ET12, « Ton pari, corrigé ») : log est un chemin relatif : il part du répertoire courant, donc cd log ne mène dans /var/log que depuis /var ; ailleurs, il échoue ou mène dans un autre log. Pour y aller toujours : cd /var/log.
B09-C2 : déductible (ET8, « Dans les noms ») : le disque d'un Mac réglé comme d'habitude ne tient pas compte de la casse : Menu.html et menu.html y désignent le même fichier, donc il ne peut pas garder les deux pages ; elle n'en a qu'une sur son Mac. (Laquelle reste, ou ce que fait la copie, le texte ne le dit pas.)
B09-C3 : déductible (ET4, « Commande, option, argument ») : -a commence par un tiret, c'est une option, pas un argument ; tree ne reçoit qu'un argument, /var.
B09-T1 : déductible (ET4, « Sans le tiret ») : il a oublié le tiret : sans lui, n n'est pas une option, cat le lit comme un argument, un fichier nommé n à afficher en plus de notes.txt, et ne numérote rien. Il fallait cat -n notes.txt.
B09-T2 : déductible (ET7, « Depuis la racine » et « Depuis là où tu es ») : cd /usr/share/man, absolu, bon d'où que l'on parte ; cd share/man n'aurait marché que pour quelqu'un qui est dans /usr.
B09-T3 : déductible (ET8, « Dans les commandes et les options » ; ET5, « Les options longues » et « Deux écritures, une notation ») : il tape ls -r /usr (la forme courte, -r inverse l'ordre sur les deux systèmes) ; il vérifie dans man ls sur son Mac, dans le SYNOPSIS : r est dans le premier crochet (et le détail dans DESCRIPTION).
B09-T4 : déductible (ET6, « La racine » ; ET7, « Depuis la racine ») : non : la règle de la barre vaut pour UNIX. Sous Windows, la racine du disque s'écrit C:\ ; ce chemin commence par C:\, il part donc de la racine du disque C : c'est un chemin absolu.
B09-K1 : déductible (ET4, « Commande, option, argument » et « Sans le tiret ») : seul le tiret fait de -l une option ; notes.txt, sans tiret et pas juste après une option qui attend un argument, est un argument. Sans tiret, l deviendrait un argument, un nom de fichier que wc cherche.
B09-K2 : déductible (ET5, « Les crochets » et « Les points de suspension ») : uname tout seul est complet (tout ce qui suit est entre crochets) ; readlink tout seul ne l'est pas : FILE... est hors crochets, donc il faut au moins un fichier.
B09-K3 : déductible (ET5, « La barre verticale ») : la barre ne se tape pas, elle sépare des choix dont on ne prend qu'un ; il pouvait écrire pwd -L ou pwd -P (ou pwd tout seul, tout étant entre crochets).
B09-K4 : déductible (ET5, « Deux écritures, une notation ») : même commande cat, même notation : les options, facultatives, sont entre crochets ([OPTION]... d'un côté, les lettres collées derrière un tiret [-belnstuv] de l'autre, aucune, une ou plusieurs) ; les fichiers, facultatifs et répétables, [FILE]... d'un côté, [file ...] de l'autre ; seule l'écriture (majuscules ou minuscules, points dans ou après le crochet) change.
B09-K5 : déductible (ET7, « Depuis là où tu es » et « Depuis la racine » ; « Quand cd échoue ») : cd man, relatif, part de /usr/share et mène dans /usr/share/man ; cd /man, absolu, cherche man dans la racine, qui n'en a pas : cd échoue et elle reste où elle était.
B09-K6 : déductible (ET7, « Revenir au dossier personnel ») : cd tout seul la mène dans /home/yasmine ; cd ~/site la mène dans /home/yasmine/site (si ce dossier existe, ce que la question ne dit pas). Le départ ne compte pas : cd tout seul ramène au dossier personnel d'où que l'on parte, et le shell remplace ~ par /home/yasmine, ce qui fait de ~/site un chemin qui se comporte comme un chemin absolu.
B09-K7 : déductible (ET8, « Dans les noms » et « La 404 de Farid ») : non : sous Linux, Bandeau.png et bandeau.png sont deux noms ; la page demande Bandeau.png, que le serveur ne trouve plus : l'image manque (404).
B09-K8 : déductible (ET7, « Quand cd échoue » ; ET8, « Dans les noms ») : la troisième : Share n'est pas share, la casse compte, et ls montrerait share. Les deux premières ne la trouvent pas parce qu'elles sont justes : pwd répond bien /usr, et le chemin, sans barre, part bien de /usr comme elle le croit.
B09-K9 : déductible (ET4, « Plusieurs options ») : deux options, -l et -R, collées derrière un seul tiret ; ls -l -R /usr donne la même liste (ou ls -Rl /usr).

## 1. Non déductibles, puis recopiés

Non déductibles : aucun.

Recopiés : aucun.

Réserves, sans changer le classement :

- PR1-3 et B09-K9 (variante ls -Rl) : que l'ordre des lettres collées ne compte pas n'est écrit que pour « ces deux lettres » (-la / -al), pas comme règle générale. La seule règle générale sur l'ordre est celle de l'option qui attend un argument (en dernier). Un apprenant strict hésite pour -tl et -Rl ; écrire la règle en général lèverait le doute.
- B09-C2 : le texte dit que Menu.html et menu.html désignent le même fichier sur le disque d'un Mac, mais ne dit jamais ce que fait une copie vers ce disque (remplacer, refuser). La réponse « il n'en a qu'une » se déduit, pas ce qui se passe pendant la copie.
- B09-Q8 : le « Pour lire » ne dit pas que -i n'attend pas d'argument (dans ET8, pour -l de tree, le texte l'écrivait explicitement) ; on le déduit seulement par contraste avec -I.
- B09-K6 : la question ne dit pas si /home/yasmine/site existe.
- PR1-13, B09-R5, B09-Q5 sont très proches d'exemples du texte (Index.html, l'invite de bash et de zsh), mais le cas change (autre nom, autre système ou autre dossier) : ce ne sont pas des recopies.

## 2. Mots ou notions des questions jamais définis dans le texte

- « page principale » (B09-R5) : jamais définie, sans gêner la réponse.
- « tutoriel » (PR1-7, PR1-8, B09-Q3, B09-T3) : employé sans définition, mot courant.
- « numéro devant chaque nom » (B09-Q8) : ce que montre -i n'est pas expliqué, sans gêner la réponse.
- Les commandes nohup, basename, dirname, which, cut, tail, wc, cat, readlink, uname, exit : présentées dans la question elle-même quand il le faut ; leur fonction n'est pas toujours dite (nohup, basename, dirname, readlink, uname), mais les questions ne portent que sur la notation.
- Aucun mot dont dépend une réponse n'est employé sans définition.

## 3. Passages qui renvoient à autre chose que la fiche

- ET2 : « Ce bloc est le deuxième de la partie « Le poste du développeur ». Le précédent, « Un shell UNIX sur son poste »… Le suivant, « Manipuler fichiers et dossiers »… »
- ET2 : « l'outil tree, que tu as installé » et « avec le shell installé au bloc précédent ».
- ET10 : « Le troisième jour, reviens ici, coche le dernier critère du constat et renvoie-le » (un constat renvoyé à quelqu'un, hors de la fiche).
- ET11 : « Il en faut plusieurs, chacune un jour différent : la liste sous l'arbre montre celles qui restent. Tu peux passer à la suite et revenir ici un autre jour. »
- ET12 : « Le bloc suivant, « Manipuler fichiers et dossiers »… » et « À explorer plus tard » (touche Tab, recherche dans le manuel, espaces dans les noms, dossiers de Windows).
- ET14 : « Une erreur cochée met le bloc « À reprendre »… » (un état de la formation, hors de la fiche).
- ET9 et ET13 renvoient à « Ce qu'on te demande », plus bas : interne à la fiche.

## 4. Passages qui parlent de la fiche au lieu de parler à l'apprenant

- Titre : « (version 2) ».
- « [seulement si l'essai p3 est faux] », « p4 », « p1 », « p2 » : numéros d'essais que l'apprenant ne voit nulle part (les essais de ET3 n'ont pas de numéro visible), avec « [la réponse à l'essai p3] » laissé en gabarit.
- « Replié sous « Ce qui sera vérifié » : … » (ET2 et ET9) : étiquette de mise en page, suivie d'une liste écrite pour l'auteur (avec « Aisance : 10 arrivées de cd prédites justes sur 10 »).
- Les identifiants d'étapes ET1 à ET14 et l'intitulé « Ce que la fiche enseigne ».
- ET12 : « Boîte donnée », « Flèche à écrire, sous la question », « Boîte donnée (à compléter : … ) » : description de l'outil plus que consigne.
- « PR1 : Entraînement » et les identifiants PR1-1…, B09-R1… : numéros d'auteur.
- Les étiquettes « Une question », « Un indice », « L'étape détaillée » (ET10) et « Pour lire : » se lisent comme des titres d'outil ; elles restent compréhensibles.
