PR1-1 : RECOPIÉE (ET4 Du nom à la page, écran du déroulé ; ET9 Un échange chiffré) : DNS donne l'adresse IP ; connexion TCP avec le serveur ; accord TLS pour chiffrer ; requête « donne-moi /planning » ; le serveur traite et renvoie 200 et la page ; le navigateur affiche la page et demande la feuille de style. La suite est écrite telle quelle dans le déroulé, seule l'URL change.
PR1-2 : déductible (ET5 Les morceaux d'une adresse, tableau et ligne des identifiants) : https = schéma ; yasmine = identifiants ; notes.formation.example.org = hôte ; 8443 = port ; /notes/2026 = chemin ; trimestre=2&matiere=reseau = paramètres ; moyenne = fragment.
PR1-3 : déductible (ET6 nslookup, au terminal, écran macOS) : résolveur 192.168.1.1 (port 53) ; adresse IPv6 du nom 2001:db8::31.
PR1-4 : déductible (ET7 Ce que demande le navigateur, L'onglet Réseau ; ET10 Set-Cookie, puis Cookie) : méthode POST, code 200, type de contenu text/html; charset=utf-8, cookie demandé jeton=c4d81f07.
PR1-5 : déductible (ET8 Quatre familles) : première réponse : le serveur marche, il a reçu la requête et refuse l'accès à ce dossier ; 4xx est une réponse, pas une panne.
PR1-6 : déductible (ET10 Jusqu'à la fermeture, ou jusqu'à une date) : langue=fr; Max-Age=2592000 persistant ; panier=3 session ; membre=e29d07 session ; bandeau=ferme; Expires=... persistant ; course=10km; Max-Age=600 persistant (toute durée, même courte, rend persistant).
PR1-7 : déductible (ET8 Six codes à connaître, tableau) : /contact renommée = 301 ; programme qui s'arrête sur une erreur = 500 ; profil qui s'affiche = 200 ; cours inexistant = 404 ; notes d'un autre groupe réservées = 403 ; site arrêté trente minutes pour mise à jour = 503.
PR1-8 : déductible (ET12 Vérifier au lieu de deviner, tableau ; ET4 Quatre étages) : « Impossible de trouver l'adresse IP » = DNS ; « Délai de connexion dépassé » avec adresse IP obtenue = réseau ; code 500 = serveur ; menu qui ne réagit plus mais marche en navigation privée = navigateur (extension).
PR1-9 : déductible (ET5 Nom, URL, adresse IP) : une même machine sert les deux sites, une adresse IP ne désigne pas un site, la requête dit lequel.
PR1-10 : déductible (ET9 Ce que le cadenas prouve) : échange chiffré avec le détenteur du nom affiché, rien sur l'honnêteté de la boutique.
PR1-11 : déductible (ET10 Set-Cookie, puis Cookie) : une petite valeur (un jeton lecteur=a81b) donnée par le serveur, renvoyée à chaque requête vers ce site ; pas le mot de passe.
PR1-12 : déductible (ET11 Deep web, darknet, dark web) : sur le deep web, ouverte avec le navigateur habituel ; non indexée n'est pas darknet.
B07-R1 : déductible (ET4 Du nom à la page ; ET5 Le port ; ET9 Un échange chiffré) : Entrée ; DNS donne l'adresse IP de agenda.example.org ; connexion TCP vers cette adresse et le port 8080 (port écrit dans l'URL, il l'emporte sur le 80) ; requête GET /rdv ; le serveur traite ; réponse 200 et page HTML ; rendu ; requêtes secondaires pour les photos. Par rapport à https : pas de pas TLS entre la connexion et la requête, donc requête et réponse en clair, lisibles par qui les capte (et ici port 8080 au lieu de 443).
B07-R2 : déductible (ET5 Les morceaux d'une adresse, Ce qui part au serveur) : https = schéma ; invite = identifiants ; agenda.example.org = hôte ; 8443 = port ; /rdv/2027 = chemin ; mois=3&vue=liste = paramètres ; samedi = fragment. Le fragment ne quitte jamais le navigateur.
B07-R3 : déductible (ET12 Vérifier au lieu de deviner, tableau) : étage du réseau (la connexion ne s'ouvre pas, le DNS a donné l'adresse IP) ; ensuite il vérifie si d'autres sites s'ouvrent, puis curl -I.
B07-R4 : déductible (ET8 Quatre familles, Six codes à connaître) : 403 : le serveur est joint et marche, il refuse l'accès à cette page ; 503 : le serveur est joint mais momentanément indisponible, en défaut (5xx).
B07-R5 : déductible (ET10 Jusqu'à la fermeture, ou jusqu'à une date) : le cookie contient un jeton (abonne=5be1d2), pas le mot de passe ; Max-Age rend le cookie persistant : il reste 2 592 000 secondes même navigateur fermé, il ne disparaît pas à la fermeture.
B07-R6 : déductible (ET5 Un nom se lit de droite à gauche ; ET9 Ce que le cadenas prouve) : l'hôte a pour domaine example.com (deux derniers morceaux), pas example.org ; le cadenas prouve seulement un échange chiffré avec le détenteur de example.com ; non, elle ne doit pas taper son mot de passe.
B07-Q1 : déductible (ET5 Le port) : port 443 ; quand l'URL n'écrit pas de port, le navigateur prend celui de son schéma (https : 443), on n'écrit un port que pour un autre numéro.
B07-Q2 : déductible (ET6 Combien de temps une réponse reste valable) : jusqu'à 16 h (14 h + 7 200 s = 2 h), parce que la durée se compte depuis la réception de la réponse par le résolveur, qui ne sait rien du changement de 14 h 30.
B07-Q3 : déductible (ET6 Qui réserve un nom) : deux bureaux d'enregistrement (registrars, revendeurs agréés) ; son nom sera inscrit sur la liste du registre du .fr, l'AFNIC.
B07-Q4 : déductible (ET7 ; ET4 Les fichiers d'une page) : le corps contient une feuille de style CSS ; la demande vient sans doute d'une requête secondaire, faite après réception de la page HTML.
B07-Q5 : déductible (ET10 Un serveur sans mémoire) : HTTP est sans état, le serveur ne relie pas une requête aux précédentes ; le cookie est le signe renvoyé avec chaque requête qui permet de reconnaître Farid.
B07-Q6 : déductible (ET5 Ce qui part au serveur) : non, le fragment ne quitte jamais le navigateur ; il sert à faire défiler la page jusqu'à l'endroit marqué, une fois la page reçue.
B07-Q7 : déductible (ET4 Les fichiers d'une page) : celle du programme JavaScript (menu.js), qui donne le comportement ; texte et couleurs sont arrivés.
B07-Q8 : déductible (ET11 L'hébergeur, le FAI, le cloud) : le FAI de Yasmine : aucun site ne s'ouvre chez elle alors que Farid ouvre le site, donc l'hébergeur marche ; le FAI porte le début de l'étage réseau, de la maison à Internet.
B07-C1 : déductible (ET4 Pourquoi cet ordre) : ordre inversé : le DNS donne l'adresse IP d'abord, ensuite la connexion, ensuite seulement la requête ; pas de requête avant la connexion.
B07-C2 : déductible (ET5 Nom, URL, adresse IP) : trois choses différentes : nom de domaine, URL (adresse complète d'une ressource), adresse IP (numéro d'une machine).
B07-C3 : déductible (ET9 Ce que le cadenas prouve) : le cadenas prouve un échange chiffré avec le détenteur du nom, rien de ses intentions ni de son sérieux ; tout détenteur de nom peut en obtenir un.
B07-C4 : déductible (ET10 Set-Cookie, puis Cookie) : le cookie ne contient jamais le mot de passe, seulement un jeton ou une préférence ; effacer le cookie fait perdre le jeton, le site ne reconnaît plus la personne, mais cela n'efface pas un mot de passe.
B07-C5 : déductible (ET11 Deep web, darknet, dark web) : le deep web est tout ce qui n'est pas indexé (messageries, pages à mot de passe), ni illégal ni dangereux ; Tor sert à un darknet, pas au deep web.
B07-T1 : déductible (ET12 Un symptôme, un étage ; Vérifier au lieu de deviner) : un code 503 prouve que le serveur a été joint, donc le DNS a marché et le nom n'est pas expiré ; je propose curl -I (code 5xx : serveur en défaut, attendre ou prévenir l'hébergeur) plutôt que le renouvellement.
B07-T2 : déductible (ET8 ; ET12 Côté client, étage serveur) : le serveur répond, il n'est plus indisponible ; 403 (4xx) : accès refusé, c'est la requête ou l'accès qui est en cause.
B07-T3 : déductible (ET8 Quatre familles) : le premier chiffre donne la famille : 4xx, erreur côté client ; le serveur a répondu, il marche, c'est la requête qui pose problème.
B07-K1 : déductible (ET6 Combien de temps une réponse reste valable) : planning : oui tant que la durée de vie de la réponse en cache n'est pas écoulée ; site jamais visité : non, aucune adresse IP en cache et le résolveur ne répond pas.
B07-K2 : déductible (ET5 Nom, URL, adresse IP ; ET7 Ce que demande le navigateur) : une même machine porte souvent plusieurs sites ; sans nom de site dans Host, elle sert celui qu'elle donne par défaut.
B07-K3 : déductible (ET5 Ce qui part au serveur) : les deux fois la requête porte /planning ; le fragment (#jeudi, #vendredi) n'est pas envoyé.
B07-K4 : déductible (ET5 Un nom se lit de droite à gauche ; ET6 Qui réserve un nom) : le propriétaire de example.net a réservé le nom de domaine (via un bureau d'enregistrement) ; « paris » et « cours » sont des sous-domaines choisis par ce propriétaire.
B07-K5 : déductible (ET6 La propagation) : des caches ont reçu l'ancienne réponse et la gardent jusqu'à la fin de sa durée de vie ; le site est déjà sur la nouvelle machine, ce sont les caches qui tardent.
B07-K6 : déductible (ET6 Qui réserve un nom ; ET14 Le registre et le bureau d'enregistrement) : le registre (l'AFNIC) publie la fiche ; le bureau d'enregistrement y figure parce qu'il a inscrit le nom au registre pour son titulaire.
B07-K7 : déductible (ET8 ; ET12 Côté client, étage serveur) : non : le serveur marche, il a répondu 404 pour ce chemin (lien périmé) et l'accueil répond 200 ; la panne n'est pas en cause.
B07-K8 : déductible (ET8 Une redirection, vue au terminal) : deux requêtes : la première reçoit le 301 avec Location, le navigateur en envoie de lui-même une seconde vers l'adresse donnée, qui renvoie la page.
B07-K9 : déductible (ET9 Un échange chiffré) : sur http://club.example.net : sans s, pas de TLS, la requête passe en clair ; sur https, chiffré, illisible.
B07-K10 : déductible (ET10 Jusqu'à la fermeture, ou jusqu'à une date) : non : sans Expires ni Max-Age c'est un cookie de session, effacé à la fermeture du navigateur.
B07-K11 : déductible (ET6 La propagation ; ET11 Exister, et être trouvé) : l'ancien site affiché chez certains vient de la propagation (caches DNS) ; la page absente des moteurs vient de l'indexation (page neuve, pas encore rangée).
B07-K12 : déductible (ET12 Un symptôme, un étage ; ET4) : non : la chaîne s'est arrêtée au DNS, pas d'adresse IP, donc ni connexion ni requête vers le serveur.
B07-K13 : déductible (ET7 L'onglet Réseau ; ET14) : 11 requêtes secondaires, car la première est la page elle-même ; les autres, envoyées après réception de la page, sont secondaires.

Liste 1. Éléments NON DÉDUCTIBLES : aucun.
Éléments RECOPIÉS : PR1-1 (l'ordre des six moments est écrit tel quel dans le déroulé d'ET4 et dans ET9 ; seul le nom de l'hôte change). Proches de la copie, sans l'être : PR1-5 et PR1-9 reprennent la structure d'une question posée dans le texte (404 de la salle 3, Nom/URL/IP), avec un code ou des noms changés ; B07-R2 reprend la lecture d'URL de l'exemple d'ET5 sur un autre cas.

Liste 2. Mots ou notions employés par les questions et jamais définis :

- « paquets » (B07-K9, Wi-Fi) : seulement nommé en ET2 (« Internet transporte des paquets »), jamais défini.
- « Tor » (B07-C5) : donné seulement comme « logiciel dédié », sans plus.
- « cache du Mac » / cache de l'ordinateur (B07-K1) : le texte dit que « les ordinateurs eux-mêmes » gardent des réponses, mais pas ce que l'ordinateur fait quand le résolveur ne répond plus ; j'ai appliqué la règle du TTL.
- « Wi-Fi », « FAI », « box », « data center » : FAI et data center sont définis ; Wi-Fi et box ne le sont pas (box rappelée comme connue).
- « registrar »/« bureau d'enregistrement » : défini. « WHOIS » : défini. « ICANN » : seulement nommée.
- « Content-Length », « charset », « HTTP/1.1 », « OK » : lus dans les exemples (PR1-4), jamais expliqués ; sans incidence sur les réponses.
- « extension » a deux sens (de nom de domaine, d'un navigateur) : le texte le signale en ET12.

Liste 3. Passages qui renvoient à autre chose que la fiche :

- ET2 : « Des deux blocs d'avant », « la partie Internet et le Web », « Le réseau local et l'accès à Internet », « Internet, réseau de réseaux » ; « Ce que tu connais déjà » (adresse IP, DNS, box, terminal supposés connus).
- ET2 et ET13 : « Replié sous “Ce qui sera vérifié” » (objectif replié que je ne vois pas, hormis son texte recopié).
- ET8 : « L'étape “Les codes, sans réfléchir” t'y entraîne ».
- ET13, ET17 : « plus bas, dans “Ce qu'on te demande”, partie Pratique / Restitution ».
- ET14 : l'atelier (« avant l'atelier » en ET2), les outils de ton propre navigateur, le service WHOIS de l'AFNIC, Wikipédia.
- ET16 « La suite » : « Serveur local », « GitHub et hébergement », « Menaces », « Se protéger » ; « À explorer plus tard ».
- ET3 : « les étapes suivantes expliquent pourquoi » ; « la page te montre tes réponses ».
- ET15 : la liste des séries faites et la preuve « Aisance ».

Liste 4. Passages qui parlent de la fiche au lieu de me parler :

- Marqueurs non résolus : « [seulement si l'essai p1 est faux] … [la réponse à l'essai p1] » (ET4), p2 (ET5), p3 (ET8), p4 (ET9), p5 (ET10), p6 (ET11) : étiquettes et variables d'auteur visibles.
- « Ton pari », « Ton pari, repris », « Ton pari, corrigé » ; « Avant de voir sa soirée sur le schéma de la chaîne, fais ton pronostic » ; « avant chacun, réponds dans ta tête à la question, puis vérifie » ; « Essaie avec ton bon sens. Personne ne te note » ; « Cet exercice n'est pas noté… le schéma de la fiche s'affiche ensuite » ; « Ce que tu fais : tu suis, sur le schéma… ».
- Étiquettes de mise en page : « Pour lire », « Deux mots, pour lire », « Les données, pour lire », « Pour te le représenter », « Ce que l'image ne dit pas » (remarque de conception récurrente), « Le terme du métier ».
- Numéros d'étape ET1 à ET18 en titres, « version 2 » dans le titre, « Réponds avec ce qui précède, et seulement avec ça ».
- ET2 : « L'idée du bloc », « À la fin, tu sauras » (annonces sur la fiche) ; ET14 : « Ton constat. La page ne voit pas ta machine » et « L'aide que tu as prise : Aucune aide, Un indice… » ; ET17 : « il est masqué jusqu'à ta dernière réponse, … corrigées à la fin de la série » ; ET18 : « Une erreur cochée met le bloc “À reprendre” ».
- Marqueurs [outil interactif : …] : je ne vois pas ce qu'ils montrent ; aucune réponse n'en dépend, sauf PR1-1 (ordre) que je tire du texte écrit.
