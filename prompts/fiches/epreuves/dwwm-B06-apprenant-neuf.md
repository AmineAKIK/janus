# B06 : réponses de l'apprenant neuf

## Pratique

PR1-1 : déductible (ET4, Le Wi-Fi n'est qu'un lien) : « Chacun parle à la box : la panne est dans ce qu'ils partagent, la box, la ligne ou plus loin. » « Connecté au Wi-Fi » ou un voyant allumé ne disent que le premier lien, celui entre l'appareil et la box ; le signal fort (défini dans la question) ne dit rien de plus. Les deux appareils ont leur premier lien qui marche et aucun n'ouvre de page : le maillon cassé est après la box, dans ce qu'ils ont en commun.
PR1-2 : déductible (ET6, Privée ou publique ; règle du 172 reprise à ET13, Ton adresse, privée ou publique ?) : 10.20.30.40 privée (plage 10) ; 198.51.100.200 publique (hors des trois plages) ; 172.16.0.5 privée (172, deuxième nombre 16, dans 16–31) ; 172.15.9.9 publique (deuxième nombre 15, hors de 16–31) ; 192.168.255.7 privée (192.168) ; 203.0.113.9 publique.
PR1-3 : déductible (ET8, Du fichier au temps) : 200 Mbit/s ÷ 8 = 25 Mo/s ; 500 Mo ÷ 25 Mo/s = 20 secondes, au mieux.
PR1-4 : déductible (ET9, Les cartes et Lire la sortie ; ET9, La passerelle et le DNS) : la carte qui sert est la carte Wi-Fi, car la carte Ethernet est « Média déconnecté » et le Wi-Fi a une adresse IPv4 et une passerelle renseignée. Adresse IPv4 192.168.0.41 ; masque 255.255.255.0 ; passerelle 192.168.0.1 ; DNS 198.51.100.53.
PR1-5 : déductible (ET9, Lire la sortie ; ET9, Le masque, écrit de deux façons ; ET9, La passerelle et le DNS) : l'interface active est en0 (« status: active » avec une ligne « inet » ; en1 est inactive, lo0 est interne d'après la question). Adresse IPv4 192.168.0.18 ; masque 0xffffff00 = 255.255.255.0 (ff = 255, 00 = 0, une paire par octet) ; passerelle = « Routeur » 192.168.0.1 ; DNS 198.51.100.53.
PR1-6 : déductible (ET10, Le premier maillon muet ; ET5, Le pare-feu) : « Ce serveur peut refuser de répondre aux ping : le silence ne prouve pas une panne. » Une machine peut refuser de répondre au ping par son pare-feu, et les documents s'ouvrent, donc la chaîne jusqu'à ce serveur marche.
PR1-7 : déductible (ET5, Une box, plusieurs fonctions ; Routeur ou switch ; Le DHCP ; Le pare-feu) : relie par câble la console et la télévision → le switch ; fait partir vers Internet la vidéo → le routeur ; donne son adresse IP à la console dès qu'il la branche → le DHCP ; refuse un programme inconnu qui cherche à entrer → le pare-feu ; adapte le signal qui arrive par la fibre → le modem (l'ONT, avec la fibre) ; permet à la montre de se relier sans fil → le point d'accès Wi-Fi.
PR1-8 : déductible (ET6, Une seule adresse publique ; ET6, Chez Farid) : « Deux adresses publiques différentes, celles de leurs deux box. » Une adresse privée ne vaut que dans une maison ; chaque box remplace l'adresse privée par sa propre adresse publique (NAT), et le FAI donne une adresse publique par abonnement.
PR1-9 : déductible (ET7, Deux services ; ET5, Routeur ou switch ; ET5, Dedans, dehors) : trouver l'adresse de librairie.example.org → DNS ; faire sortir le courriel de l'appartement → routeur ; le serveur de la banque, loin du réseau des appareils → WAN.
PR1-10 : déductible (ET8, Débit et latence ; ET6, Une seule adresse publique ; ET4, FAI ou hébergeur) : 15 ms entre l'envoi d'un test et sa réponse → latence ; l'adresse que la box montre à Internet → IP publique ; l'entreprise qui garde le site sur ses machines → hébergeur.

## Restitution

B06-R1 : déductible (ET4, Du Wi-Fi au site et FAI ou hébergeur ; ET5, Routeur ou switch ; ET6, La passerelle et Une seule adresse publique ; ET7, Un nom, de bout en bout) : le Mac envoie ses paquets par le câble Ethernet à la box (sa passerelle, puisque le serveur est dans un autre réseau) ; dans la box, le routeur fait sortir les paquets de la maison et met l'adresse publique de la box à la place de l'adresse privée du Mac (NAT) ; le modem adapte le signal pour la ligne ; la ligne va au FAI, l'entreprise qui relie la maison à Internet ; Internet transporte les paquets jusqu'au serveur du site de partage, une machine qui garde les pages et répond, que fait tourner l'hébergeur. L'impression vers l'imprimante câblée à la même box reste dans le réseau local : les paquets passent par le switch de la box sans sortir de la maison. Ce test prouve donc le lien Mac–box et la partie locale de la box ; il ne dit rien du routeur, de la ligne, du FAI, d'Internet ni du serveur de l'hébergeur.
B06-R2 : déductible (ET7, Deux services ; ET5, Le DHCP) : recevoir son adresse en rejoignant le réseau → le DHCP ; chercher l'adresse du site du fabricant → le DNS. Le DHCP agit quand un appareil rejoint le réseau et lui donne ses réglages (adresse IP, masque, passerelle, adresse du DNS) ; le DNS agit chaque fois qu'on utilise un nom de site et traduit ce nom en adresse IP. Ils sont liés : le DHCP indique où est le DNS.
B06-R3 : déductible (ET6, Une seule adresse publique ; ET6, Chez Farid) : oui, sans tricherie : les trois joueurs sont derrière la même box, qui a une seule adresse publique. En sortant, chaque paquet a vu son adresse privée remplacée par l'adresse publique de la box (NAT) ; la box retient qui a fait quelle demande pour remettre la bonne adresse privée au retour.
B06-R4 : déductible (ET10, De proche en proche et Le premier maillon muet ; ET7, Deux services ; ET13, Tester de proche en proche, solution entière) : la panne est au DNS : l'adresse du site de la mairie répond, donc la passerelle, la ligne, le FAI et Internet tiennent jusqu'au site ; seul le nom échoue, et le test vers le nom ajoute le maillon DNS. Le ping muet vers 198.51.100.50 ne prouve pas une panne : une machine peut refuser de répondre au ping par son pare-feu, et une autre adresse publique répond juste après.
B06-R5 : déductible (ET8, Du fichier au temps) : 200 Mbit/s ÷ 8 = 25 Mo/s, car un octet fait 8 bits et le débit compte des bits alors que le fichier compte des octets ; 600 Mo ÷ 25 Mo/s = 24 secondes, au mieux (le débit annoncé est un maximum).
B06-R6 : déductible (ET5, Routeur ou switch) : console et télévision câblées qui s'échangent une vidéo → le switch, qui relie par câble les appareils d'un même réseau local ; console qui télécharge sur le site du fabricant → le routeur, qui relie des réseaux différents et fait sortir les paquets de la maison. Ce n'est pas la même fonction parce que le premier trajet reste dans le réseau local et le second va vers un autre réseau.

## Rappel

B06-Q1 : déductible (ET4, FAI ou hébergeur ; ET4, Le Wi-Fi n'est qu'un lien) : l'hébergeur de la librairie. Le FAI de Farid donne l'accès à Internet, et tous les autres sites s'ouvrent : l'accès marche. Le seul maillon propre au site de la librairie est son serveur, chez l'hébergeur ; et la panne se répète depuis une autre maison, avec un autre accès.
B06-Q2 : déductible (ET6, La passerelle ; ET6, Le masque ; ET5, Routeur ou switch) : l'imprimante est dans le même réseau que le PC (mêmes trois premiers nombres avec le masque 255.255.255.0) : la box fait passer les paquets par le switch, sans passerelle. Un site est dans un autre réseau : le PC doit envoyer ses paquets à la passerelle, l'adresse de la box vue de l'intérieur. Sans passerelle, il ne sait pas où les envoyer.
B06-Q3 : déductible (ET6, Une seule adresse publique) : en arrivant à la box, la réponse va vers 198.51.100.40, l'adresse publique que la box a mise à la place de 10.0.0.7 au départ (NAT) ; la box, qui a retenu quel appareil a fait la demande, remet l'adresse privée 10.0.0.7 et la réponse arrive à l'ordinateur sous cette adresse.
B06-Q4 : déductible (ET5, Une box, plusieurs fonctions ; ET4, Du Wi-Fi au site) : le point d'accès Wi-Fi, la partie radio de la box, celle qu'un appareil trouve quand il cherche le Wi-Fi. Le Mac n'est pas touché parce qu'il est relié à la box par un câble Ethernet, un autre premier lien, qui passe par le switch ; le routeur, le modem et la ligne marchent puisque le Mac ouvre les sites.
B06-Q5 : déductible (ET10, De proche en proche et Le premier maillon muet ; ET13, Tester de proche en proche, solution entière) : tester de proche en proche avant d'appeler : ping vers sa passerelle (la box), puis vers une autre adresse publique, puis vers un nom. Le premier test qui échoue situe la panne ; et un ping muet ne prouve pas une panne à lui seul, le serveur de la banque peut refuser de répondre par son pare-feu. Si la passerelle ne répond pas, la panne est chez lui, pas chez le FAI.
B06-Q6 : déductible (ET10, Le chemin du paquet ; ET6, La passerelle) : cette ligne parle de sa box, dont l'adresse vue de la maison est la passerelle 192.168.1.1. Elle vient en premier parce qu'un appareil envoie à la passerelle tout paquet destiné à un autre réseau : la box est la première machine que le paquet traverse en quittant l'appartement.
B06-Q7 : déductible (ET9, Le masque, écrit de deux façons ; ET6, Le masque) : 0xffffff00 → ff, ff, ff, 00 → 255.255.255.0. Avec ce masque, les trois premiers nombres désignent le réseau : 10.0.0 est la partie réseau de 10.0.0.12, et 12 désigne l'appareil. (Remarque : le masque 0xffffff00 est exactement celui du texte, ET9 et ET13 ; seule la seconde partie est un cas nouveau.)
B06-Q8 : déductible (ET9, Les cartes et Lire la sortie ; ET13, Tes réglages réseau) : sous Windows, la carte en 172.16.4.9 : elle a une adresse IPv4 et une « Passerelle par défaut » renseignée, l'autre est « Média déconnecté ». Sous macOS, en3 : marquée « status: active » avec une ligne « inet », alors qu'en1 est inactive.

## Tâches différées

B06-C1 : déductible (ET4, Le Wi-Fi n'est qu'un lien ; ET14, Ton pari, corrigé) : le voyant du câble ne prouve que le lien console–box, pas Internet. La box, la ligne du FAI, le DNS et le site peuvent casser sans que ce voyant le montre. Le téléphone, en Wi-Fi sur la même box, n'ouvre aucun site : les deux appareils ont leur premier lien qui marche et rien ne passe, la panne est dans ce qu'ils partagent (box, ligne ou plus loin), pas dans le jeu.
B06-C2 : déductible (ET6, Privée ou publique ; ET6, Une seule adresse publique) : 10.0.0.15 est dans la plage 10.0.0.0–10.255.255.255 : une adresse privée, qui ne vaut que dans son réseau local et ne circule pas sur Internet. D'autres maisons peuvent avoir la même ; Internet ne voit que l'adresse publique de sa box (NAT).
B06-C3 : déductible (ET7, Deux services ; ET5, Routeur ou switch) : l'adresse reçue au branchement vient du DHCP, pas du DNS, qui traduit un nom de site en adresse. Le téléphone et l'enceinte sont dans le même réseau local : ce n'est pas le routeur, qui relie des réseaux différents ; la box fait passer leurs paquets sans sortir de la maison. (Limite : le texte définit le switch comme reliant « par câble » ; il ne dit jamais quelle fonction nomme le passage entre deux appareils en Wi-Fi, je ne peux donc que dire « pas le routeur ».)
B06-C4 : déductible (ET8, Débit et latence) : non, ou pas forcément : des actions qui arrivent en retard, c'est de la latence, le temps d'aller-retour, qui fait qu'une page réagit vite ou lentement. Passer à 1 000 Mbit/s augmente le débit, la quantité de données par seconde, et un fort débit n'implique pas une faible latence.
B06-C5 : déductible (ET5, Dedans, dehors) : le LAN est le réseau de la maison, les appareils reliés entre eux par sa box. Le téléphone de la voisine est relié à sa box à elle : il est de l'autre côté de la box du stagiaire, dans le WAN vu de chez lui. Habiter le même immeuble ne met pas dans le même réseau local.
B06-T1 : déductible (ET4, Le Wi-Fi n'est qu'un lien ; ET10, De proche en proche ; ET14, Ton pari, corrigé) : tester avec ping d'abord, de proche en proche (passerelle, adresse publique, nom), depuis un ordinateur relié à la même box : « connecté » ne prouve que le premier maillon et rien ne se voit, seul un test trouve le maillon qui casse. Redémarrer la box ou appeler le FAI sans savoir où est la panne, c'est agir à l'aveugle.
B06-T2 : déductible (ET8, Du fichier au temps) : 400 Mbit/s ÷ 8 = 50 Mo/s ; 900 Mo ÷ 50 Mo/s = 18 secondes, au mieux. À 200 Mbit/s, c'était 25 Mo/s et 36 secondes : doubler le débit double le nombre de Mo par seconde, donc divise le temps par deux ; la division par 8 ne change pas.
B06-T3 : déductible (ET4, Le Wi-Fi n'est qu'un lien ; ET8, Débit et latence) : le répéteur n'agit que sur le premier maillon, le lien Wi-Fi entre la tablette et la box : il est mieux reçu. Il ne change rien à la box, à la ligne du FAI, à Internet ni au serveur ; le débit est limité par le maillon le plus étroit et la latence s'additionne sur toute la chaîne, donc si la lenteur vient d'un maillon après la box, elle reste.

## Cartes

B06-K1 : déductible (ET4, Du Wi-Fi au site et Le Wi-Fi n'est qu'un lien ; ET10, De proche en proche) : la montre affiche « connecté » : son lien à la box marche. Le Mac, sur la même box, reçoit ses courriels : la box, la ligne, le FAI et Internet marchent. Hors de cause : le lien montre–box, la box, la ligne du FAI, Internet. Reste à tester le bout de la chaîne : le serveur qui envoie les notifications de la montre.
B06-K2 : déductible (ET4, FAI ou hébergeur) : un hébergeur, l'entreprise Z, qui fait tourner le serveur du site. Un FAI par abonnement : chaque membre passe par le FAI de son propre abonnement, donc autant de FAI que d'entreprises différentes chez qui les membres ont leur abonnement (plusieurs membres peuvent avoir le même).
B06-K3 : déductible (ET5, Routeur ou switch ; ET6, Une seule adresse publique) : non. Le switch relie par câble les appareils d'un même réseau local ; il ne relie pas des réseaux différents. Faire sortir les paquets de la maison vers Internet et mettre l'adresse publique à la place de la privée (NAT), c'est le travail du routeur.
B06-K4 : déductible (ET6, La passerelle ; ET6, Ce que le DHCP donne ; ET9, Les cartes) : il lui manque la passerelle, l'adresse de la box vue de l'intérieur, à laquelle on envoie tout paquet destiné à un autre réseau ; sans elle, il joint l'imprimante (même réseau) mais aucun site. D'ordinaire, c'est le DHCP de la box qui la donne, avec l'adresse, le masque et le DNS.
B06-K5 : déductible (ET6, Une seule adresse publique ; ET6, Chez Farid) : non. Chaque box remplace l'adresse privée 192.168.1.23 par sa propre adresse publique (NAT), et les deux abonnements ont deux adresses publiques différentes. Le site voit deux adresses distinctes ; l'adresse privée ne circule jamais sur Internet.
B06-K6 : déductible (ET6, Une seule adresse publique) : en donnant une adresse publique par abonnement, à la box, et en laissant chaque box donner des adresses privées à ses cinq appareils puis traduire (NAT) ces adresses en son adresse publique unique pour tout ce qui sort. Le texte dit que c'est ce que fait le NAT face à la pénurie d'adresses IPv4.
B06-K7 : déductible (ET6, Quatre nombres) : 192.168.1.300 n'est pas une IPv4 valide : chaque nombre tient dans un octet, de 0 à 255, et 300 dépasse. 2001:db8::5 est une adresse IPv6 : plus longue, écrite avec des deux-points.
B06-K8 : déductible (ET10, De proche en proche et Le premier maillon muet ; ET13, Tester de proche en proche) : il ne sait pas si le premier maillon, entre son Mac et sa box, tient ; et un ping muet ne prouve pas une panne à lui seul. Il aurait dû pinguer d'abord sa passerelle (la box) : le premier test qui échoue situe la panne, et on teste du plus proche au plus lointain.
B06-K9 : déductible (ET8, Du fichier au temps) : non. 100 Mbit/s ÷ 8 = 12,5 Mo/s ; 400 Mo ÷ 12,5 Mo/s = 32 secondes au mieux. Farid a compté comme si 100 Mbit/s faisaient 100 Mo/s, en oubliant qu'un octet fait 8 bits.
B06-K10 : déductible (ET8, Débit et latence) : B télécharge le gros fichier le plus vite (300 Mbit/s, plus de données par seconde) ; A fait réagir la page le plus vite (10 ms d'aller-retour contre 600). Un fort débit n'implique pas une faible latence.
B06-K11 : déductible (ET6, Le masque) : non. Avec 255.255.255.0, les trois premiers nombres désignent le réseau ; 192.168.1 et 192.168.2 diffèrent au troisième nombre, donc ce sont deux réseaux différents.
B06-K12 : déductible (ET10, Le premier maillon muet ; ET5, Le pare-feu) : l'ordinateur du collègue peut refuser de répondre au ping par son pare-feu, tout en répondant au reste : un ping sans réponse ne prouve pas, à lui seul, une panne. Le dossier partagé qui s'ouvre montre que le lien entre les deux machines marche.
B06-K13 : déductible (ET10, Un saut muet ; ET13, Le chemin d'un paquet, solution entière) : non. « * * * » dit seulement que la machine du saut 5 n'a pas répondu au test ; le saut 6 répond, donc le paquet a traversé le saut 5. Il faut regarder si les lignes d'après répondent, et ces lignes sont normales.
B06-K14 : déductible (ET11, Ouvrir les pages de la box ; ET13, Les pages de ta box ; ET10, De proche en proche) : un réglage changé peut couper la maison d'Internet ; en effaçant tous ses réglages, Yasmine risque de perdre ce qui fait marcher sa box (le nom et la protection de son Wi-Fi, ce que le FAI y a réglé) et de couper la maison, alors que rien ne dit que la box est en cause. D'abord : tester de proche en proche avec ping pour situer la panne, et lire les pages de la box sans rien modifier, sans bouton qui restaure.
B06-K15 : déductible (ET10, Ping ; ET10, Quand ping s'arrête) : non. Sous macOS, ping continue jusqu'à Ctrl+C si on n'a pas écrit -c 4 ; et chaque ligne avec un temps en ms est une réponse reçue, le temps d'un aller-retour. Sa connexion répond : il lui suffit de taper Ctrl+C.
B06-K16 : déductible (ET5, Une box, plusieurs fonctions ; ET5, Routeur ou switch ; ET5, Dedans, dehors) : l'ONT adapte le signal de la fibre, entre la ligne du FAI et la box : en panne, plus rien ne passe vers le WAN, les appareils perdent Internet. Le Mac et l'imprimante, câblés à la box, sont dans le même réseau local : le switch les relie sans passer par la ligne, le Mac peut encore imprimer.
B06-K17 : RECOPIÉE (ET10, Ping ; ET8, Débit et latence) : c'est la latence, le temps d'un aller-retour entre son Mac et le serveur de la banque, en ms. Ce n'est pas un débit : le débit est la quantité de données qui arrive chaque seconde, en Mbit/s. Le texte écrit tel quel « Il écrit le temps de chaque aller-retour, en ms (« temps= » sous Windows…) : c'est la latence » ; changer 42 et « banque » ne demande aucune règle à appliquer.

## Bilan chiffré

- Éléments : 49 (PR1 : 10 ; Restitution : 6 ; Rappel : 8 ; Tâches différées : 8 ; Cartes : 17).
- Déductibles : 48
- Non déductibles : 0
- Recopiées : 1 (B06-K17)
- Hors champ assumé : 0

## Liste 1 : non déductibles, puis recopiés

Non déductibles : aucun.

Recopiés :
- B06-K17 : « temps= … c'est la latence » est écrit tel quel à ET10, Ping ; la question ne change que la valeur (42 ms) et la cible (banque), qui n'entrent dans aucun calcul ni aucune règle.

Points à surveiller (déductibles, mais au bord) :
- B06-Q7 : le masque 0xffffff00 est le même que dans le texte (ET9, ET13 : « 0xffffff00 vaut 255.255.255.0 ») ; seule la partie sur 10.0.0.12 vérifie la règle. Un autre masque (par exemple 0xffff0000) vérifierait la conversion.
- B06-C3 : la correction « pas le routeur » se déduit, mais la fonction qui relie deux appareils en Wi-Fi d'un même réseau n'est jamais écrite (le switch est défini « par câble »). Si l'attendu nomme le switch ou le point d'accès pour ce cas, je ne peux pas le produire.
- B06-K1 : le maillon restant (le serveur des notifications) se déduit de la chaîne, mais le texte n'a jamais travaillé un cas où le premier lien et le milieu de la chaîne sont prouvés et où seul le bout reste ; la question « lequel reste à tester » suppose qu'il n'en reste qu'un.

## Liste 2 : mots ou notions des questions que le texte ne définit jamais

- La fonction de la box qui fait communiquer deux appareils en Wi-Fi d'un même réseau local (B06-C3) : le switch est défini pour le câble seulement, le point d'accès comme « la partie radio ».
- « Dossier partagé » (B06-K12) : jamais défini ; la réponse n'a besoin que de savoir que c'est un échange entre deux machines.
- Tester « avec ping » depuis un téléphone (B06-T1) : le texte n'apprend ping que dans le terminal d'un PC ou d'un Mac.
- Les mots nouveaux introduits par les questions elles-mêmes sont définis sur place et ne manquent pas : « signal fort » (PR1-1), « Serveur DHCP » et « liaison locale » (PR1-4), « lo0 » (PR1-5), « répéteur Wi-Fi » (B06-T3), « réinitialiser » (B06-K14), « ONT » (B06-K16, aussi dans ET5).

## Liste 3 : passages qui renvoient à autre chose que la fiche

- ET2, Où tu es : « Ce bloc est le deuxième de la partie Internet et le Web », « Internet, réseau de réseaux », « C'est le cas concret du bloc précédent », « Le Web en action … s'appuie sur ce bloc ».
- ET2, Ce que tu connais déjà : « Dans « L'information en bits » … Dans « Internet, réseau de réseaux » ».
- ET2 et ET12 : « Replié sous « Ce qui sera vérifié » : Schéma annoté … » (la liste de ce qui sera évalué, répétée deux fois).
- ET5, Une box, plusieurs fonctions : « tu le verras plus loin ».
- ET5, Le DHCP : « que l'écran « Ce que le DHCP donne » détaille ».
- ET5, Le pare-feu : « un petit test que tu verras à l'étape « Tester la chaîne » ».
- ET5, Dedans, dehors : « comme le montre l'écran « Une seule adresse publique », à l'étape suivante ».
- ET9, Lire la sortie : « le masque, lui, se lit à l'écran suivant ».
- ET9, Le masque, écrit de deux façons : « Tu croiseras les deux écritures dans le métier ».
- ET9, La passerelle et le DNS : « C'est elle qui ouvrira les pages de la box, à l'étape « La box vue de l'intérieur » ».
- ET12 : « Les exercices, un item à la fois : plus bas, dans « Ce qu'on te demande », partie Pratique. »
- ET13, Le schéma de ton réseau et constat : « sans regarder le cours » (deux fois).
- ET14, Le schéma, pour Karim : « le schéma de la fiche s'affiche ensuite, pour comparer ».
- ET14, La suite : « La suite suit une page web de bout en bout… » ; « À explorer plus tard » (cinq sujets).
- ET15 : « Les questions, une à la fois : plus bas, dans « Ce qu'on te demande », partie Restitution. Elle se fait sans le cours… ».
- ET16 : « expliqués à l'étape « Dans la box » », « expliqués à l'étape « DNS ou DHCP » ».

## Liste 4 : passages qui parlent de la fiche au lieu de me parler

- Étiquettes « pour lire » : « Les trois gestes et les mots de la soirée, pour lire : » (ET1), « Deux unités, pour lire : » (ET3, ET8 trois fois, PR1-3, B06-R5, T2, K9), « Les trois plages privées, pour lire : » (ET6, ET13 deux fois, PR1-2, PR1-8, C2, K5), « Trois mots, pour lire : » (ET7), « Hexadécimal, pour lire : » (ET9, B06-Q7), « Les trois tests de Yasmine, pour lire : » (ET10), « La situation, pour lire : » et « Le cas de Karim, pour lire : » (ET14), « Un mot, pour lire : » (PR1-1, PR1-6), « Les lignes d'ipconfig, pour lire : », « Les lignes de macOS, pour lire : » (PR1-4, PR1-5), « Le masque, pour lire : » (K11), « « * * * », pour lire : » (K13), « Ping, pour lire : » (K15).
- Étiquettes de structure : « Ton pari », « Ton pari, repris », « Ton pari, corrigé » ; « Où tu es », « À quoi ça sert », « L'idée du bloc. », « Ce que tu connais déjà », « À la fin, tu sauras » (ET2) ; « Pour te représenter … », « Ce que l'image ne dit pas : », « Le terme du métier : » (ET4, ET5, ET6, ET8) ; « À retenir », « Quatre confusions à éviter. », « Tester, et la box. », « La suite » (ET14).
- « Replié sous « Ce qui sera vérifié » : … » (ET2, ET12) : remarque de mise en page et liste d'évaluation.
- ET3 : « Personne ne te note : réponds comme tu penses… À la fin de cette étape, la page te montre tes réponses et ce qui était attendu ; les étapes suivantes expliquent pourquoi. »
- Marqueurs conditionnels et identifiants invisibles : « [seulement si l'essai p1 est faux] À la question sur …, tu avais répondu [la réponse à l'essai p1]. » (p1 à ET4, p3 à ET5, p2 à ET6, p4 à ET7, p5 à ET8) : je ne vois nulle part d'« essai p1 ».
- Listes vides sous les outils : trois « - » sous « Les trois gestes » (ET1), six « - » sous « La box de Yasmine, ouverte » (ET5), « - » entre les sorties de « Les trois tests de Yasmine » (ET10).
- ET4, Le Wi-Fi n'est qu'un lien : « Dans cette fiche, un maillon désigne l'un ou l'autre. »
- ET5, Une box, plusieurs fonctions : « Deux sont à connaître d'abord … Les quatre autres viennent ensuite. »
- ET6, Privée ou publique : « c'est une convention, à lire, pas à retenir : les trois plages sont écrites là où tu en as besoin » ; « Dans ce bloc, on relève l'IPv4. »
- ET12 et ET15 : renvoi à la partie « Ce qu'on te demande » et explication du masquage du cours et de la correction différée (« pour qu'une correction ne souffle pas la question suivante »).
- ET13 : « Tu es ici : sur ta machine et sur ton papier, chez toi. » ; niveaux d'aide « Un indice », « Une piste détaillée », « Une partie de la solution », « La solution entière » ; « Ton constat. La page ne voit pas ta machine : c'est toi qui dis ce que tu as fait. » ; « L'aide que tu as prise : Aucune aide, Un indice, … ».
- ET14, Le schéma, pour Karim : « Cet exercice n'est pas noté. Tu construis le schéma du bloc pour ce cas, avec tes mots, qui peuvent différer de ceux de la fiche » ; « Boîte donnée », « Flèche à écrire, sous la question : », « Boîte à écrire, sous la question : », « Boîte donnée (à compléter : …) ».
- ET16 : « Celles que la page a repérées dans tes réponses y sont déjà cochées … Une erreur cochée met le bloc « À reprendre » jusqu'à ce qu'une réponse solide … la referme. »
- Les en-têtes « ET1 … ET16 » et les identifiants « PR1-1 », « B06-R1 », etc. : des numéros d'étape et d'item que je ne vois que dans ce texte.
