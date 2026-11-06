# B06 : réponses de l'apprenant neuf

## Pratique

PR1-1 : déductible (ET4 « La chaîne de la maison », écran « Le Wi-Fi n'est qu'un lien ») : « Chacun parle à la box : la panne est dans ce qu'ils partagent, la box, la ligne ou plus loin. » « Connecté au Wi-Fi » ou un voyant allumé ne disent que le premier lien, entre l'appareil et la box ; les deux appareils tiennent ce premier lien et échouent tous deux, donc le maillon cassé est dans la partie commune, après la box.

PR1-2 : déductible (ET6 « Les adresses de la maison », écran « Privée ou publique ») : 10.20.30.40 privée ; 198.51.100.200 publique ; 172.16.0.5 privée ; 172.15.9.9 publique (172.15 est hors de 172.16–172.31) ; 192.168.255.7 privée ; 203.0.113.9 publique. Règle écrite : tout ce qui est hors des trois plages est public.

PR1-3 : déductible (ET8 « Débit et latence », écran « Du fichier au temps ») : 200 Mbit/s ÷ 8 = 25 Mo/s ; 500 Mo ÷ 25 Mo/s = 20 secondes, au mieux.

PR1-4 : déductible (ET9 « Le terminal », écrans « Les cartes » et « Lire la sortie » ; ET13 « Chez toi, pour de vrai », écran « Tes réglages réseau ») : la carte qui sert est la carte Wi-Fi (la carte Ethernet est « Média déconnecté » ; la Wi-Fi a une IPv4 et une passerelle renseignée). Adresse IPv4 192.168.0.41 ; masque 255.255.255.0 ; passerelle 192.168.0.1 ; DNS 198.51.100.53.

PR1-5 : déductible (ET9 « Le terminal », écrans « Lire la sortie », « Le masque, écrit de deux façons », « La passerelle et le DNS ») : l'interface active est en0 (« status: active », ligne « inet »). Adresse 192.168.0.18 ; masque 0xffffff00 = ff.ff.ff.00 = 255.255.255.0 ; passerelle = « Routeur » 192.168.0.1 ; DNS 198.51.100.53.

PR1-6 : déductible (ET10 « Tester la chaîne », écran « Le premier maillon muet » ; ET5 « Dans la box », écran « Le pare-feu ») : « Ce serveur peut refuser de répondre aux ping : le silence ne prouve pas une panne. » Une machine peut refuser le ping par son pare-feu ; les documents s'ouvrent, donc le chemin jusqu'au serveur marche.

PR1-7 : déductible (ET5 « Dans la box », écrans « Une box, plusieurs fonctions », « Routeur ou switch », « Le DHCP », « Le pare-feu ») : relier par câble console et télévision → switch ; faire partir la vidéo vers Internet → routeur ; donner son adresse IP à la console → DHCP ; refuser un programme inconnu qui cherche à entrer → pare-feu ; adapter le signal de la fibre → modem (ONT) ; relier la montre sans fil → point d'accès Wi-Fi.

PR1-8 : déductible (ET6 « Les adresses de la maison », écrans « Une seule adresse publique » et « Chez Farid ») : « Deux adresses publiques différentes, celles de leurs deux box. » Chaque box remplace l'adresse privée par sa propre adresse publique (NAT) ; une adresse privée ne vaut que dans une maison.

PR1-9 : déductible (ET7 « DNS ou DHCP », écran « Deux services » ; ET5 « Dans la box », écrans « Routeur ou switch » et « Dedans, dehors ») : trouver l'adresse de librairie.example.org → DNS ; faire sortir le courriel de l'appartement → routeur ; le serveur de la banque, loin du réseau des appareils → WAN.

PR1-10 : déductible (ET8 « Débit et latence », écran « Débit et latence » ; ET6, écran « Privée ou publique » ; ET4, écran « FAI ou hébergeur ») : 15 ms entre un test et sa réponse → latence ; l'adresse que la box montre à Internet → IP publique ; l'entreprise qui garde le site sur ses machines → hébergeur.

## Restitution

B06-R1 : déductible (ET4 « La chaîne de la maison », écrans « Du Wi-Fi au site » et « FAI ou hébergeur » ; ET5, écran « Routeur ou switch » ; ET6, écran « Une seule adresse publique » ; ET7, écran « Un nom, de bout en bout ») : le Mac (il envoie la photo) → câble Ethernet → la box (sa passerelle : le routeur fait sortir le paquet du réseau local et met l'adresse publique de la box à la place de l'adresse privée du Mac, le NAT ; le modem ou ONT adapte le signal pour la ligne) → la ligne → le FAI (l'entreprise qui relie l'appartement à Internet, chez qui Farid a son abonnement) → Internet (le grand réseau, qui transporte le paquet d'une adresse à une autre) → le serveur du site de partage (la machine qui garde les photos et répond), tenu par l'hébergeur (qui fait tourner les serveurs du site). Le retour suit le même chemin dans l'autre sens. L'impression prouve seulement le premier maillon : le câble Mac–box et le switch de la box, dans le réseau local ; ces paquets ne sortent pas de la maison, donc rien n'est prouvé sur le routeur, la ligne, le FAI, Internet ni le serveur.

B06-R2 : déductible (ET7 « DNS ou DHCP », écran « Deux services » ; ET5, écran « Le DHCP ») : recevoir son adresse en rejoignant le réseau → le DHCP ; chercher l'adresse du site du fabricant → le DNS. Le DHCP agit quand un appareil rejoint le réseau et lui donne ses réglages (adresse IP, masque, passerelle, adresse du DNS) ; le DNS agit chaque fois qu'on utilise un nom de site et traduit ce nom en adresse IP. Les deux sont liés : le DHCP dit à l'appareil où est le DNS.

B06-R3 : déductible (ET6, écran « Une seule adresse publique ») : oui. Trois appareils d'une même maison ont des adresses privées différentes, mais la box remplace chacune par son unique adresse publique (NAT) : le serveur voit trois fois 203.0.113.80, comme le site voyait 203.0.113.10 pour le PC, la tablette et le téléphone de Yasmine.

B06-R4 : déductible (ET7, écran « Deux services » ; ET10 « Tester la chaîne », écrans « De proche en proche » et « Le premier maillon muet » ; ET13, écran « Tester de proche en proche ») : la panne est au DNS : l'adresse du site répond, donc la passerelle, la ligne et Internet marchent jusqu'au site ; seul le nom échoue, et traduire un nom en adresse est le travail du DNS. Le ping muet vers 198.51.100.50 ne prouve pas une panne : une machine peut refuser le ping par son pare-feu, et 203.0.113.60, plus loin dans la chaîne, répond.

B06-R5 : déductible (ET8, écran « Du fichier au temps ») : 200 Mbit/s ÷ 8 = 25 Mo/s ; 600 Mo ÷ 25 Mo/s = 24 secondes au mieux. On divise par 8 parce qu'un octet fait 8 bits : le débit compte des bits, le fichier des octets ; le débit annoncé est un maximum, d'où « au mieux ».

B06-R6 : déductible (ET5, écran « Routeur ou switch ») : console ↔ télévision : le switch, les deux appareils sont dans le même réseau local, les paquets ne sortent pas de la maison ; console → site du fabricant : le routeur, le site est dans un autre réseau, il fait sortir les paquets de la maison.

## Rappel

B06-Q1 : déductible (ET4, écrans « FAI ou hébergeur » et « Le Wi-Fi n'est qu'un lien ») : l'hébergeur de la librairie. Le FAI de Farid relie bien son appartement à Internet puisque tous les autres sites s'ouvrent ; la panne touche un seul site, depuis deux maisons différentes : le maillon commun est le serveur du site, donc son hébergeur.

B06-Q2 : déductible (ET6, écrans « La passerelle », « Ce que le DHCP donne » et « Le masque » ; ET5, écran « Routeur ou switch ») : la passerelle est l'adresse de la box où un appareil envoie tout paquet destiné à un autre réseau. Sans elle, le PC ne sait pas où envoyer les paquets pour les sites. L'imprimante est dans le même réseau (192.168.1.x d'après le masque), le switch suffit, aucune passerelle n'est nécessaire.

B06-Q3b : déductible (ET6, écran « Une seule adresse publique ») : la réponse arrive avec l'adresse publique de la box, 198.51.100.40, la seule que le site a vue. La box retient toute seule quel appareil a fait quelle demande et remet l'adresse privée du bon appareil, 10.0.0.7, au retour (NAT).

B06-Q4 : déductible (ET5, écrans « Une box, plusieurs fonctions » et « Routeur ou switch » ; ET4, écran « Du Wi-Fi au site ») : le point d'accès Wi-Fi, la partie radio de la box que le téléphone trouve quand il cherche le Wi-Fi. Le Mac se relie par câble, par le switch, pas par le Wi-Fi ; le modem, le routeur et le reste de la chaîne marchent puisque les sites s'ouvrent.

B06-Q5 : déductible (ET10, écrans « De proche en proche » et « Le premier maillon muet » ; ET13, écran « Tester de proche en proche » ; ET14 « Chez Yasmine, enfin », écran « Ton pari, corrigé ») : tester de proche en proche d'abord : ping vers sa passerelle, puis vers une autre adresse publique, puis vers un nom. Un ping muet vers un seul serveur ne prouve pas une panne (le serveur de la banque peut refuser le ping par son pare-feu) ; et si la passerelle ne répond pas, la panne est chez lui, pas chez le FAI. Regarder aussi si d'autres sites s'ouvrent.

B06-Q6 : RECOPIÉE (ET10, écran « Le chemin du paquet » ; ET13, écran « Le chemin d'un paquet » ; ET6, écran « La passerelle ») : la box de Farid, sa passerelle. Le texte l'écrit tel quel : « Le premier saut est la passerelle, c'est-à-dire la box » ; et « c'est là qu'un appareil envoie tout paquet destiné à un autre réseau », donc elle est la première machine traversée. Seuls le prénom et la cible changent par rapport au texte.

B06-Q7b : déductible (ET9, écran « Le masque, écrit de deux façons » ; ET6, écran « Le masque ») : 0xffffff00 = 255.255.255.0. Les trois premiers nombres désignent le réseau : 10.0.0 ; le dernier, 12, désigne l'appareil. (Remarque : la première moitié, « 0xffffff00 vaut 255.255.255.0 », est écrite telle quelle à ET13 ; seule la seconde applique la règle à une adresse nouvelle.)

B06-Q8b : déductible (ET9, écrans « Les cartes » et « Lire la sortie » ; ET13, écran « Tes réglages réseau ») : la carte avec 172.16.4.9 et la passerelle 172.16.4.1. Le signe : elle a une adresse IPv4 et une « Passerelle par défaut » renseignée ; l'autre est « Média déconnecté », donc pas branchée.

B06-Q9 : déductible (ET9, écran « Lire la sortie » ; ET13, écran « Tes réglages réseau ») : en3. Le signe : « status: active » et une ligne « inet » ; en1 est « status: inactive ».

## Tâches différées

B06-C1 : déductible (ET4, écran « Le Wi-Fi n'est qu'un lien ») : le voyant allumé ne prouve que le lien console–box, pas qu'Internet marche. Le téléphone, qui partage la même box, n'ouvre aucun site : le maillon cassé est donc dans ce qui est commun (box, ligne, FAI, DNS), pas dans le jeu. Il faut tester la chaîne avant d'accuser le jeu.

B06-C2 : déductible (ET6, écrans « Privée ou publique » et « Chez Farid ») : 10.0.0.15 est dans la plage privée 10.0.0.0–10.255.255.255 ; une adresse privée ne sert qu'à l'intérieur d'un réseau local et ne circule pas sur Internet : d'autres réseaux locaux peuvent utiliser la même. Seule l'adresse publique de sa box est unique à l'instant où elle est utilisée.

B06-C3b : déductible (ET7, écran « Deux services » ; ET5, écran « Routeur ou switch ») : c'est le DHCP, pas le DNS, qui donne son adresse à un appareil qui arrive ; le DNS traduit un nom en adresse. Le téléphone et l'enceinte, en Wi-Fi dans le même réseau local, se parlent par le point d'accès Wi-Fi (le travail du switch, en sans-fil), pas par le routeur, qui relie des réseaux différents.

B06-C4 : déductible (ET8, écran « Débit et latence ») : non. Le retard des actions est de la latence (le temps d'un aller-retour, en ms) ; passer de 300 à 1 000 Mbit/s augmente le débit (la quantité de données par seconde). Un fort débit n'implique pas une faible latence.

B06-C5 : déductible (ET5, écran « Dedans, dehors ») : le LAN est le réseau de la maison, les appareils reliés entre eux par sa propre box. Le téléphone de la voisine est relié à la box de la voisine : il est de l'autre côté de la box du stagiaire, hors de son LAN, comme le Mac de Farid dans son appartement. Habiter le même immeuble n'y change rien.

B06-T1 : déductible (ET4, écran « Le Wi-Fi n'est qu'un lien » ; ET10, écran « De proche en proche » ; ET14, écran « Ton pari, corrigé » ; ET11 « La box vue de l'intérieur », écran « Ouvrir les pages de la box ») : tester avec ping, de proche en proche (passerelle, adresse publique, nom). « Connecté » ne dit que le premier maillon, et seul un test trouve le maillon cassé ; redémarrer la box ou appeler le FAI sans savoir si la panne est chez soi, sur le chemin ou au DNS, c'est agir sans savoir (chez Yasmine, c'était le DNS).

B06-T2 : déductible (ET8, écran « Du fichier au temps ») : 400 Mbit/s ÷ 8 = 50 Mo/s ; 900 Mo ÷ 50 Mo/s = 18 secondes au mieux. Le passage à 400 Mbit/s double le débit en Mo/s (25 → 50 Mo/s), donc divise le temps par deux (36 s → 18 s) ; la division par 8 ne change pas.

B06-T3 : déductible (ET4, écrans « Du Wi-Fi au site » et « Le Wi-Fi n'est qu'un lien » ; ET8, écran « Débit et latence ») : le répéteur ne touche que le premier maillon, le lien Wi-Fi entre l'appareil et la box : il est mieux reçu dans la cuisine. Il ne change rien à la box, à la ligne du FAI, à Internet ni au site ; le débit est limité par le maillon le plus étroit et la latence s'additionne sur toute la chaîne, donc si la lenteur vient d'un maillon plus loin, elle reste.

## Cartes

B06-K1 : déductible (ET4, écrans « Le Wi-Fi n'est qu'un lien » et « FAI ou hébergeur » ; ET10, écran « De proche en proche ») : hors de cause : la box, la ligne du FAI et Internet (le Mac reçoit ses courriels par la même box), et le lien Wi-Fi montre–box (« connecté »). Il reste le bout du chemin : le serveur des notifications (son hébergeur), à tester, par exemple avec un ping vers son adresse ou son nom.

B06-K2 : déductible (ET4, écran « FAI ou hébergeur ») : un seul hébergeur, l'entreprise Z, qui fait tourner le serveur du site. Des FAI : autant que d'abonnements distincts chez les membres, au plus un par membre (moins si plusieurs ont le même FAI) ; chacun relie une maison à Internet.

B06-K3 : déductible (ET5, écran « Routeur ou switch » ; ET6, écran « Une seule adresse publique ») : non. Le switch relie les appareils d'un même réseau local ; le routeur relie des réseaux différents, fait sortir les paquets de la maison vers Internet et fait le NAT. Sans routeur, les paquets ne quittent pas le réseau local.

B06-K4 : déductible (ET6, écrans « La passerelle » et « Ce que le DHCP donne ») : la passerelle manque : l'adresse de la box où envoyer tout paquet pour un autre réseau. D'ordinaire, c'est le DHCP de la box qui la donne, avec l'adresse, le masque et le DNS. L'imprimante est dans le même réseau (10.0.0.x), elle n'a pas besoin de passerelle.

B06-K5 : déductible (ET6, écrans « Privée ou publique », « Une seule adresse publique », « Chez Farid ») : non. Chaque box remplace 192.168.1.23 par sa propre adresse publique (NAT), et une adresse publique est unique à l'instant où elle est utilisée : le site voit deux adresses publiques différentes.

B06-K6 : déductible (ET6, écran « Une seule adresse publique ») : une adresse publique par abonnement, donnée à la box ; chaque box donne des adresses privées à ses cinq appareils et traduit (NAT) leurs adresses en son adresse publique unique. 1 000 adresses suffisent pour 5 000 appareils.

B06-K7 : déductible (ET6, écran « Quatre nombres ») : 192.168.1.300 n'est pas une IPv4 valide : chaque nombre tient dans un octet, de 0 à 255, et 300 dépasse 255. 2001:db8::5 n'est pas une IPv4 : c'est une IPv6 (plus longue, avec des deux-points).

B06-K8 : déductible (ET10, écrans « De proche en proche » et « Le premier maillon muet » ; ET13, écran « Tester de proche en proche ») : il ne sait pas si le premier maillon (Mac–box) tient, ni si ce serveur refuse simplement le ping : un test lointain muet ne dit pas où la chaîne casse. Il aurait dû pinguer d'abord sa passerelle, puis seulement une adresse publique, puis un nom.

B06-K9 : déductible (ET8, écrans « Du fichier au temps » et « Convertir un débit ») : non. 100 Mbit/s = 12,5 Mo/s ; 400 Mo ÷ 12,5 Mo/s = 32 secondes au mieux. Il a confondu Mbit et Mo : un octet fait 8 bits.

B06-K10 : déductible (ET8, écran « Débit et latence ») : B télécharge le plus vite un gros fichier (300 Mbit/s, débit trois fois plus grand) ; A fait réagir le plus vite une page (10 ms d'aller-retour contre 600 ms). Un fort débit n'implique pas une faible latence.

B06-K11 : déductible (ET6, écran « Le masque ») : non. Avec 255.255.255.0, les trois premiers nombres désignent le réseau : 192.168.1 et 192.168.2 diffèrent, donc deux réseaux différents ; seul le dernier nombre désigne l'appareil.

B06-K12 : déductible (ET10, écran « Le premier maillon muet » ; ET5, écran « Le pare-feu ») : l'ordinateur du collègue peut refuser de répondre au ping, par son pare-feu, tout en répondant à ce qu'on lui demande d'autre : un ping sans réponse ne prouve pas, à lui seul, une panne.

B06-K13 : déductible (ET10, écran « Un saut muet » ; ET13, écran « Le chemin d'un paquet » ; ET14, écran « À retenir ») : non. « * * * » dit seulement que la machine du saut 5 n'a pas répondu au test ; le saut 6 répond, donc le paquet a traversé le saut 5. Ces lignes sont normales.

B06-K14 : déductible (ET11, écran « Ouvrir les pages de la box » ; ET10, écran « De proche en proche » ; ET14, écran « Ton pari, corrigé ») : elle risque de perdre tous ses réglages (nom et mot de passe du Wi-Fi, protection) et de couper la maison d'Internet, pour une panne qui n'est peut-être pas dans la box (chez elle, c'était le DNS). D'abord : tester de proche en proche avec ping, et lire les pages de la box sans rien modifier.

B06-K15 : déductible (ET10, écrans « Ping » et « Quand ping s'arrête ») : non. Sous macOS, ping continue jusqu'à Ctrl+C (sauf avec -c 4) : qu'il défile n'est pas une panne. Chaque ligne avec un temps en ms est une réponse reçue : la connexion marche.

B06-K16 : déductible (ET5, écrans « Une box, plusieurs fonctions », « Routeur ou switch », « Dedans, dehors ») : l'ONT adapte le signal de la fibre pour la box : sans lui, la box n'a plus la ligne du FAI, les appareils perdent Internet (tout le WAN). Le Mac et l'imprimante, câblés à la box, restent dans le même réseau local : le switch fait passer leurs paquets sans sortir, le Mac peut encore imprimer.

B06-K17 : déductible (ET8, écran « Débit et latence » ; ET10, écran « Ping ») : non, pas à lui seul. 42 ms est la latence : le temps d'un aller-retour, qui joue sur la réactivité à un clic, pas sur la quantité de données par seconde. Un téléchargement lent relève du débit, limité par le maillon le plus étroit ; 42 ms est d'ailleurs un aller-retour modeste au regard des repères du texte (15 ms en fibre, plus de 500 ms par satellite).
