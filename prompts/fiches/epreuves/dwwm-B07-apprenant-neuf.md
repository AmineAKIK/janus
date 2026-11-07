PR1-1 : déductible (ET4 « Du nom à la page », ET8 « Une redirection, vue au terminal », ET9 « Un échange chiffré ») : DNS donne l'IP ; connexion TCP port 80 ; requête en clair ; le serveur répond 301 + Location ; nouvelle connexion TCP port 443 ; TLS ; requête chiffrée.
PR1-2 : déductible (ET5 « Les morceaux d'une URL », « Après le chemin », « Le port ») : notes.formation.example.org = hôte ; 8443 = port ; /notes/2026 = chemin ; trimestre=2&matiere=reseau = paramètres ; moyenne = fragment.
PR1-3 : déductible (ET6 « A, puis AAAA ») : 2001:db8::31 (le #53 est le port du résolveur, pas une partie de l'adresse).
PR1-4 : déductible (ET7 « Ce que demande le navigateur », « Ce que répond le serveur » ; ET10 « Set-Cookie, puis Cookie ») : méthode POST ; type de contenu text/html; charset=utf-8 ; cookie : jeton=c4d81f07 (posé par Set-Cookie).
PR1-5 : déductible (ET8 « Quatre familles », « Six codes à connaître ») : il marche, a reçu la requête et refuse l'accès à ce dossier.
PR1-6 : déductible (ET10 « Jusqu'à la fermeture, ou jusqu'à une date ») : panier=3 session ; bandeau (Expires) persistant ; course (Max-Age) persistant.
PR1-7 : déductible (ET8 « Six codes à connaître ») : programme qui s'arrête = 500 ; cours inexistant = 404 ; notes d'un autre groupe réservées = 403 ; site arrêté trente minutes = 503.
PR1-8 : déductible (ET12 « Vérifier au lieu de deviner », « Côté client, étage serveur ») : « Impossible de trouver l'adresse IP » = DNS ; « Délai de connexion dépassé » = réseau ; 500 = serveur ; menu qui ne s'ouvre pas sauf en navigation privée = navigateur (extension).
PR1-9 : déductible (ET5 « Nom, URL, adresse IP ») : une même machine sert les deux sites, la requête dit lequel.
PR1-10 : déductible (ET9 « Ce que le cadenas prouve ») : échange chiffré avec le détenteur du nom, rien sur l'honnêteté de la boutique.
PR1-11 : déductible (ET10 « Set-Cookie, puis Cookie ») : une petite valeur (jeton) donnée par le serveur, renvoyée à chaque requête vers ce site ; pas le mot de passe.
PR1-12 : déductible (ET11 « Deep web, darknet, dark web ») : sur le deep web, ouverte avec le navigateur habituel.
B07-R7 : déductible (ET4 « Du nom à la page », ET5 « Le port », ET9 « Un échange chiffré ») : URL, DNS, connexion TCP vers le port 8080 (port écrit dans l'URL l'emporte sur 80), requête en clair, traitement par le serveur, réponse 200, rendu, requêtes secondaires pour les photos ; TLS n'a pas lieu.
B07-R2 : déductible (ET5 « Les morceaux d'une URL », « Après le chemin », « Ce qui part au serveur ») : schéma https ; identifiants invite ; hôte agenda.example.org ; port 8443 ; chemin /rdv/2027 ; paramètres mois=3&vue=liste ; fragment samedi ; le fragment ne quitte jamais le navigateur.
B07-R8 : déductible (ET12 « Vérifier au lieu de deviner ») : l'étage du réseau (la connexion ne s'ouvre pas, le DNS a marché) ; il vérifie si d'autres sites s'ouvrent, puis lance curl -I.
B07-R4 : déductible (ET8 « Six codes à connaître ») : 403 : le serveur est joint et marche, il refuse l'accès à cette page ; 503 : le serveur est joint mais momentanément indisponible (surchargé), en défaut.
B07-R5 : déductible (ET10 « Set-Cookie, puis Cookie », « Jusqu'à la fermeture… ») : un jeton (abonne=5be1d2), jamais le mot de passe ; Max-Age = persistant, 2 592 000 s de durée : il reste après la fermeture du navigateur.
B07-R9 : déductible (ET5 « Un nom se lit de droite à gauche », ET9 « Ce que le cadenas prouve ») : l'hôte se lit depuis la droite, son nom de domaine est example.com, pas la formation ; le cadenas prouve seulement un échange chiffré avec le détenteur de example.com ; non, elle ne doit pas y taper son mot de passe.
B07-Q9 : déductible (ET5 « Le port ») : port 443 ; puis 8443 (le port écrit l'emporte).
B07-Q10 : déductible (ET6 « Combien de temps une réponse reste valable ») : 7 200 s = 2 h depuis la réception à 14 h : jusqu'à 16 h, car le cache ne sait rien du changement de 14 h 30 et garde sa réponse jusqu'à la fin de la durée de vie.
B07-Q3 : déductible (ET6 « Qui réserve un nom ») : deux bureaux d'enregistrement (registrars) ; le nom sera inscrit sur la liste du registre du .fr, l'AFNIC.
B07-Q4 : déductible (ET7 « Ce que répond le serveur », ET4 « Les fichiers d'une page ») : une feuille de style CSS ; une requête secondaire.
B07-Q11 : déductible (ET10 « Un serveur sans mémoire », « Set-Cookie, puis Cookie ») : HTTP est sans état ; sans cookie gardé, le navigateur ne renvoie pas de jeton, donc le serveur ne reconnaît pas la requête « Mes notes ».
B07-Q12 : déductible (ET4 « Les fichiers d'une page ») : le JavaScript (menu.js), qui donne le comportement du menu.
B07-Q8 : déductible (ET11 « L'hébergeur, le FAI, le cloud ») : le FAI de Yasmine : aucun site ne s'ouvre chez elle alors que Farid ouvre le site, donc le début de l'étage réseau, de sa maison à Internet, pas le serveur.
B07-Q13 : déductible (ET11 « L'hébergeur, le FAI, le cloud ») : au fournisseur du cloud, qui loue à la demande de la puissance dans un data center, donc rien à acheter.
B07-C6 : déductible (ET4 « Sans le DNS », « Pourquoi cet ordre ») : l'ordre est inversé : le DNS donne l'adresse IP avant la connexion, et la requête ne part qu'après.
B07-C7 : déductible (ET5 « Nom, URL, adresse IP ») : example.org est un nom de domaine, l'URL désigne une ressource, 203.0.113.20 est le numéro d'une machine : trois choses différentes.
B07-C3 : déductible (ET9 « Ce que le cadenas prouve ») : le cadenas prouve un échange chiffré avec le détenteur du nom, rien sur le sérieux ou les intentions ; tout propriétaire d'un nom en obtient un facilement.
B07-C4 : déductible (ET10 « Set-Cookie, puis Cookie ») : le cookie ne contient jamais le mot de passe, seulement un jeton ou une préférence ; l'effacer supprime le jeton (le site ne la reconnaît plus), ça ne retire rien de stocké.
B07-C5 : déductible (ET11 « Deep web, darknet, dark web ») : le deep web est ce qu'aucun moteur n'indexe, ni illégal ni dangereux en soi, accessible avec un navigateur ordinaire ; Tor relève du darknet, autre chose.
B07-T4 : déductible (ET12 « Le schéma, pour la page de Farid », « Vérifier au lieu de deviner ») : d'abord curl -I (ou voir le code) : un 503 est un code reçu, donc le DNS a marché, le nom n'a pas expiré ; c'est le serveur en défaut, attendre ou prévenir l'hébergeur.
B07-T5 : déductible (ET8 « Six codes à connaître », ET12) : non, le serveur est joint et répond ; le 403 est un accès refusé : c'est la requête (l'accès demandé) qui est en cause, plus une panne.
B07-T3 : déductible (ET8 « Quatre familles ») : le premier chiffre donne la famille : 4xx, erreur côté client ; le serveur est joint et a répondu, c'est la requête qui pose problème ; le sens exact reste inconnu.
B07-K1 : déductible (ET6 « Combien de temps une réponse reste valable ») : le planning, oui, tant que la durée de vie de l'entrée en cache n'est pas écoulée ; un site jamais visité, non : pas d'adresse IP en cache et résolveur muet, donc pas de connexion.
B07-K2 : déductible (ET5 « Nom, URL, adresse IP » ; ET7 « Ce que demande le navigateur ») : une IP désigne une machine qui porte souvent plusieurs sites ; sans nom de site dans Host, elle sert son site par défaut.
B07-K4 : déductible (ET5 « Un nom se lit de droite à gauche ») : le propriétaire a réservé le nom de domaine example.net ; « paris » et « cours » sont des sous-domaines choisis par ce propriétaire.
B07-K5 : déductible (ET6 « Combien de temps… », « La propagation ») : des caches gardent l'ancienne adresse IP jusqu'à la fin de leur durée de vie (propagation) ; le site est déjà sur la nouvelle machine.
B07-K6 : déductible (ET6 « Quand un nom expire », « Qui réserve un nom ») : le registre (l'AFNIC) publie la fiche ; le bureau d'enregistrement y figure parce qu'il a inscrit le nom au registre pour son titulaire.
B07-K7 : déductible (ET8, ET12 « Côté client, étage serveur ») : non : le 404 est une réponse, le serveur marche (l'accueil donne 200) ; c'est l'URL recopiée qui est introuvable.
B07-K8 : déductible (ET8 « Une redirection, vue au terminal ») : deux requêtes : la première reçoit le 301, puis le navigateur en envoie une seconde à l'URL de Location (sur une nouvelle connexion en https).
B07-K9 : déductible (ET9 « Un échange chiffré ») : sur http://club.example.net : en http la requête passe en clair ; en https elle est chiffrée.
B07-K10 : déductible (ET10 « Jusqu'à la fermeture… ») : non : sans Expires ni Max-Age c'est un cookie de session, effacé à la fermeture du navigateur.
B07-K11 : déductible (ET6 « La propagation », ET11 « Exister, et être trouvé ») : l'ancien site encore affiché vient de la propagation (caches DNS) ; la page absente des moteurs vient de l'indexation.
B07-K12 : déductible (ET4 « Sans le DNS », ET12) : non : la chaîne s'arrête au DNS, sans adresse IP il n'y a ni connexion ni requête.
B07-K13 : déductible (ET7 « L'onglet Réseau », ET14 « Une requête en détail ») : 11 : la première ligne est la page elle-même, les autres sont des requêtes secondaires.

Liste 1 : éléments NON DÉDUCTIBLES et RECOPIÉS

- NON DÉDUCTIBLES : aucun.
- RECOPIÉS : aucun au sens strict. Quasi-recopies à surveiller : PR1-3 (lire une adresse dans une sortie qui reprend la forme de l'exemple d'ET6), B07-R7 (le port écrit l'emporte est écrit tel quel en ET5), PR1-5 (« 403 : accès refusé » est donné dans l'énoncé).
- Points un peu justes mais déduits : PR1-7 « arrêté trente minutes pour une mise à jour » = 503 (la table dit « surchargé », pas « arrêté »), B07-K6 (l'origine du nom du registrar dans la fiche n'est écrite qu'indirectement), B07-C4 (le texte ne parle pas d'un mot de passe enregistré par le navigateur lui-même), B07-K13 (le « 12 requêtes » est l'inverse de l'exemple à 5, la règle « la première ligne est la page » n'est écrite qu'en ET14).

Liste 2 : mots que les questions emploient et que le texte ne définit pas

- « Tor » : seulement cité comme logiciel dédié du darknet (utilisé en B07-C5).
- « Wi-Fi », « Mac », « Forbidden » (« 403 Forbidden » traduit en accès refusé, mais l'anglais n'est pas relié), « mise à jour ».
- « identifiants » quand il n'y a qu'un nom d'utilisateur (PR1-2) : le texte donne le cas nom+mot de passe.
- « Host » comme en-tête : défini, mais « sans nom de site la machine sert celui par défaut » est dit en une phrase.

Liste 3 : passages qui renvoient à autre chose que la fiche

- ET2 : « Des deux blocs d'avant » (Internet, réseau de réseaux ; réseau local) ; « Juste après ce bloc, « Serveur local » ».
- ET7 : « l'étape des cookies le montre » ; ET8 : « L'étape « Les codes, sans réfléchir » ».
- ET13/ET17 : « plus bas, dans « Ce qu'on te demande » ».
- ET16 : « Dans la partie suivante… « Serveur local » », « GitHub et hébergement », « Menaces », « Se protéger » ; « À explorer plus tard » (six pistes).
- ET2 : « Les autres mots… sont expliqués dans les étapes qui suivent » ; « l'objectif replié sous « Ce qui sera vérifié » ».
- ET6 : « L'écran suivant dit pourquoi » ; ET14 : « Tu le complètes à l'écran « Une requête en détail » ».

Liste 4 : passages qui parlent de la fiche au lieu de me parler

- Gabarits non résolus : « [seulement si l'essai p1 est faux] À la question sur l'ordre, au début, tu avais répondu [la réponse à l'essai p1] » (et p2 à p6).
- « Avant chacun, réponds dans ta tête à la question, puis vérifie » (ET4, ET12) ; « Ton pari » (ET1, ET16) ; « À la fin de cette étape, la page te montre tes réponses et ce qui était attendu » ; « Personne ne te note ».
- Étiquettes d'auteur : « pour lire », « Pour te le représenter… Ce que l'image ne dit pas » (répété), « L'idée du bloc », « Un mot, pour lire », « Les familles de codes, pour lire ».
- Méta-fiche : « Ces six codes sont à connaître par cœur… l'étape … t'y entraîne » ; « Cet exercice n'est pas noté… le schéma de la fiche s'affiche ensuite » ; « Ton constat. La page ne voit pas ta machine » ; « Le nom d'un cookie est exigé : cet écran n'est fait que quand il est sur ton papier » ; « Trois cookies rangés sont exigés » ; « L'aide que tu as prise : … » ; indice/piste/solution ; « Une série est réussie… la preuve « Aisance » » ; « Elle se fait sans le cours : dès que tu commences, il est masqué ».
- Noms de blocs de questions (Pratique, Restitution, Rappel, Tâches différées, Cartes) et libellés « ET » (numéros d'étapes que je ne vois que par le titre « ET n »).
