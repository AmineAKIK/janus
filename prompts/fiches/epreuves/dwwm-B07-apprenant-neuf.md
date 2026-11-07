PR1-1 : déductible (ET4 « Du nom à la page », ET9 « Un échange chiffré ») : 1 DNS donne l'adresse IP ; 2 connexion TCP ; 3 TLS (juste après la connexion, avant la requête) ; 4 requête « donne-moi /planning » ; 5 le serveur traite et renvoie 200 et la page ; 6 le navigateur affiche la page et demande la feuille de style.
PR1-2 : déductible (ET5 « Les morceaux d'une adresse », tableau et ligne sur les identifiants) : https = schéma ; yasmine = identifiants ; notes.formation.example.org = hôte ; 8443 = port ; /notes/2026 = chemin ; trimestre=2&matiere=reseau = paramètres (& sépare les deux) ; moyenne = fragment.
PR1-3 : déductible (ET6 « nslookup, au terminal », version macOS en anglais) : résolveur interrogé = 192.168.1.1 ; adresse IPv6 de mediatheque.example.com = 2001:db8::31.
PR1-4 : déductible (ET7 « Ce que répond le serveur » et « L'onglet Réseau », ET10 « Set-Cookie, puis Cookie ») : méthode POST ; code 200 ; adresse distante 203.0.113.20 port 443 ; Content-Type text/html; charset=utf-8 ; Set-Cookie jeton=c4d81f07. Je compte cinq lignes pour « quatre informations » : j'ai donné les cinq.
PR1-5 : déductible (ET8 « Quatre familles ») : le serveur marche, il a reçu la requête et refuse l'accès à ce dossier (4xx : c'est la requête qui pose problème, pas une panne). Première option.
PR1-6 : déductible (ET10 « Jusqu'à la fermeture, ou jusqu'à une date », règle écrite) : langue=fr; Max-Age=2592000 persistant ; panier=3 session ; membre=e29d07 session ; bandeau=ferme; Expires=… persistant ; course=10km; Max-Age=600 persistant.
PR1-7 : déductible (ET8 « Six codes à connaître », tableau) : /contact renommée = 301 ; programme des moyennes qui s'arrête = 500 ; profil qui s'affiche = 200 ; cours inexistant = 404 ; notes réservées d'un autre groupe = 403 ; site arrêté trente minutes = 503.
PR1-8 : déductible (ET12 « Vérifier au lieu de deviner », tableau des symptômes ; ET16 « Ton pari, corrigé ») : « Impossible de trouver l'adresse IP » = DNS ; « Délai de connexion dépassé » avec nslookup qui répond = réseau ; code 500 = serveur ; menu qui ne s'ouvre pas sauf en navigation privée sans extension = navigateur.
PR1-9 : déductible (ET5 « Nom, URL, adresse IP ») : une même machine sert les deux sites ; la requête dit lequel elle veut (première option).
PR1-10 : déductible (ET9 « Ce que le cadenas prouve ») : l'échange est chiffré avec le détenteur du nom baskets-pas-cheres.example.com ; rien sur l'honnêteté de la boutique (première option).
PR1-11 : déductible (ET10 « Set-Cookie, puis Cookie ») : une petite valeur (un jeton, lecteur=a81b) donnée par le serveur, renvoyée dans chaque requête vers ce site ; jamais le mot de passe (première option). L'exemple lecteur=a81b est déjà dans l'explication, mais c'est la règle qui fait répondre.
PR1-12 : déductible (ET11 « Deep web, darknet, dark web ») : sur le deep web (pas indexée, ouverte avec le navigateur habituel).
B07-R1 : RECOPIÉE (ET4 « Du nom à la page » et « Pourquoi cet ordre », ET16 « À retenir ») : l'ordre est écrit tel quel (adresse tapée, DNS, connexion TCP, TLS, requête, traitement, réponse 200 et page, rendu, requêtes secondaires pour le logo) et la raison aussi (chaque moment a besoin du précédent) ; seul le nom du site change.
B07-R2 : déductible (ET5 « Les morceaux d'une adresse », « Ce qui part au serveur ») : https = schéma ; invite = identifiants ; agenda.example.org = hôte ; 8443 = port ; /rdv/2027 = chemin ; mois=3&vue=liste = paramètres ; samedi = fragment. Le fragment (samedi) ne quitte jamais le navigateur.
B07-R3 : déductible (ET12 « Vérifier au lieu de deviner », tableau) : le réseau (la connexion ne s'ouvre pas, le DNS a répondu) ; ensuite, vérifier si d'autres sites s'ouvrent, puis curl -I sur le site.
B07-R4 : déductible (ET8 « Quatre familles » et « Six codes ») : 403 = accès refusé, 4xx : serveur joint et en état de marche, il refuse la requête ; 503 = service momentanément indisponible, 5xx : serveur joint mais qui n'arrive pas à traiter, temporairement.
B07-R5 : déductible (ET10 « Set-Cookie, puis Cookie » et « Jusqu'à la fermeture ») : un jeton (identifiant) donné par le serveur, jamais le mot de passe ; avec Max-Age c'est un cookie persistant : il reste après la fermeture du navigateur, jusqu'à la fin de la durée (2 592 000 secondes).
B07-R6 : déductible (ET5 « Un nom se lit de droite à gauche », ET9 « Ce que le cadenas prouve ») : le nom de domaine de cette page est example.com (deux derniers morceaux), pas celui de la formation ; le cadenas prouve seulement un échange chiffré avec le détenteur de ce nom-là ; non, elle ne doit pas taper son mot de passe.
B07-Q1 : déductible (ET5 « Le port ») : port 443, celui de https ; quand l'URL n'écrit pas de port, le navigateur prend celui de son schéma, on ne l'écrit que pour un autre numéro.
B07-Q2 : déductible (ET6 « Combien de temps une réponse reste valable ») : jusqu'à 16 h (14 h + 7 200 s = 2 h), car la durée se compte depuis la réception par le cache (14 h) et le cache ignore le changement de 14 h 30.
B07-Q3 : déductible (ET6 « Qui réserve un nom ») : deux bureaux d'enregistrement (registrars), des revendeurs agréés ; quel que soit son choix, le nom sera inscrit sur la liste du registre, l'AFNIC.
B07-Q4 : déductible (ET7 « Ce que répond le serveur », ET4 « Les fichiers d'une page ») : le corps contient une feuille de style CSS ; elle a sans doute été demandée par une requête secondaire, après la page HTML.
B07-Q5 : déductible (ET10 « Un serveur sans mémoire ») : HTTP est sans état, le serveur ne relie pas une requête aux précédentes ; le cookie est le signe que le navigateur renvoie à chaque requête pour qu'il reconnaisse Farid.
B07-Q6 : déductible (ET5 « Ce qui part au serveur ») : non, le fragment ne quitte jamais le navigateur ; il sert à faire défiler la page jusqu'à l'endroit marqué « absences » une fois la page reçue.
B07-Q7 : déductible (ET4 « Les fichiers d'une page ») : celle du programme JavaScript (le comportement), puisque texte et couleurs (HTML, CSS) sont arrivés.
B07-Q8 : déductible (ET11 « L'hébergeur, le FAI, le cloud », ET12 tableau « d'autres sites s'ouvrent-ils ? ») : le FAI de Yasmine : aucun site ne s'ouvre chez elle alors que le site de la formation marche chez Farid, donc le serveur va bien (hébergeur hors de cause) ; le FAI porte l'étage réseau de la maison à Internet. L'inférence « aucun site ne s'ouvre donc pas l'hébergeur » n'est pas écrite telle quelle ; le DNS ou la box pourraient aussi être en cause.
B07-C1 : déductible (ET4 « Du nom à la page ») : l'ordre est inversé : le DNS donne l'adresse IP avant toute requête ; sans adresse, pas de connexion, sans connexion, pas de requête.
B07-C2 : déductible (ET5 « Nom, URL, adresse IP ») : trois choses différentes : example.org est un nom de domaine (nom lisible), https://example.org/contact une URL (adresse complète d'une ressource), 203.0.113.20 une adresse IP (numéro d'une machine).
B07-C3 : déductible (ET9 « Ce que le cadenas prouve ») : le cadenas prouve seulement un échange chiffré avec le détenteur du nom ; tout propriétaire d'un nom peut obtenir un certificat, il ne dit rien de l'honnêteté.
B07-C4 : déductible (ET10 « Set-Cookie, puis Cookie ») : le cookie ne contient jamais le mot de passe (jeton ou préférence) ; le serveur l'a vérifié une fois ; effacer le cookie retire le jeton, donc il sera déconnecté, mais le mot de passe n'était pas là.
B07-C5 : déductible (ET11 « Deep web, darknet, dark web ») : le deep web est ce qu'aucun moteur n'indexe (messageries, pages derrière mot de passe), ni illégal ni dangereux ; il se visite avec un navigateur ordinaire ; Tor relève d'un darknet, autre chose.
B07-T1 : RECOPIÉE (ET12 « Vérifier au lieu de deviner », dernier paragraphe) : la phrase « le site ne répond plus » et la réponse sont écrites : dans l'ordre de la chaîne, d'abord nslookup (le nom donne-t-il une adresse IP ?), puis curl -I (le serveur répond-il, avec quel code ?) avant d'appeler l'hébergeur.
B07-T2 : déductible (ET8 « Quatre familles », « Six codes ») : non, 403 est une réponse 4xx : le serveur marche, il a reçu la requête et refuse l'accès ; ce qui est en cause maintenant, c'est la requête (accès non permis), pas une panne.
B07-T3 : déductible (ET8 « Quatre familles ») : le premier chiffre donne la famille : 4xx = erreur côté client ; le serveur a répondu et marche, c'est la requête qui pose problème ; le sens exact du 418 reste inconnu.
B07-K1 : déductible (ET6 « Qui répond au nom », « Combien de temps… ») : oui pour le planning tant que la réponse en cache est valable (le Mac la redonne) ; non pour un site jamais visité : pas de cache, pas de résolveur, donc pas d'adresse IP, donc pas de connexion.
B07-K2 : déductible (ET5 « Nom, URL, adresse IP », ET7 « Ce que demande le navigateur ») : une adresse IP désigne une machine qui peut porter plusieurs sites ; la requête n'a plus de nom de site dans Host, donc la machine sert son site par défaut.
B07-K3 : déductible (ET5 « Ce qui part au serveur ») : les deux fois, le serveur reçoit /planning seulement ; le fragment (#jeudi, #vendredi) ne part pas.
B07-K4 : déductible (ET5 « Un nom se lit de droite à gauche », ET6 « L'arbre des noms ») : le propriétaire de example.net a réservé le nom de domaine ; « cours » et « paris » sont des sous-domaines créés comme il veut par ce propriétaire.
B07-K5 : déductible (ET6 « Combien de temps une réponse reste valable ») : des caches (résolveurs, ordinateurs) ont gardé l'ancienne réponse et la redonnent jusqu'à la fin de sa durée de vie ; ils ne savent rien du changement ; c'est la propagation.
B07-K6 : déductible (ET6 « Qui réserve un nom ») : le registre (l'AFNIC pour .fr) publie la fiche ; le nom du bureau d'enregistrement y figure parce que c'est lui qui a inscrit le nom au registre pour le titulaire.
B07-K7 : RECOPIÉE (ET8 « Quatre familles », tableau des six codes, ET16 « À retenir ») : 404 = le serveur marche, il a reçu la requête et répond qu'il n'a pas la ressource ; 503 = serveur joint mais qui n'arrive pas à traiter, momentanément indisponible (5xx, côté serveur). Aucun cas nouveau.
B07-K8 : déductible (ET8 « Une redirection, vue au terminal ») : deux requêtes : la première vers http, qui reçoit 301 ; le navigateur suit de lui-même Location et envoie une seconde requête vers https, d'où vient la page.
B07-K9 : déductible (ET9 « Un échange chiffré ») : sur http://club.example.net, car sans s la requête passe en clair ; sur https le contenu est chiffré par TLS.
B07-K10 : déductible (ET10 « Jusqu'à la fermeture, ou jusqu'à une date ») : non, panier=2 n'a ni Expires ni Max-Age : cookie de session, effacé à la fermeture du navigateur.
B07-K11 : déductible (ET6 « Combien de temps… », ET11 « Exister, et être trouvé ») : l'ancien site encore affiché = propagation (caches DNS) ; page absente des moteurs = indexation (page neuve, aucun lien ne mène à elle).
B07-K12 : déductible (ET4 « Du nom à la page » et « Quatre étages ») : non : la chaîne s'est arrêtée au DNS, sans adresse IP pas de connexion, sans connexion pas de requête ; le serveur n'a rien reçu.
B07-K13 : déductible (ET7 « L'onglet Réseau », ET14 « L'onglet Réseau, chez toi ») : 11 requêtes secondaires ; la première ligne est la page elle-même, les autres sont les requêtes secondaires (comme 5 requêtes dont 4 secondaires pour le planning).

LISTE 1. Éléments NON DÉDUCTIBLES et RECOPIÉS
Non déductibles : aucun. Réserve sur B07-Q8 (l'inférence « aucun site ne s'ouvre chez elle donc pas l'hébergeur » n'est pas écrite) et sur PR1-4 (« quatre informations » pour cinq lignes demandées à relever).
Recopiés : B07-R1 (ordre de la chaîne et raison écrits tels quels), B07-T1 (la phrase « le site ne répond plus » et l'ordre nslookup puis curl -I sont écrits à ET12), B07-K7 (404 et 503 sont écrits mot pour mot à ET8, sans cas nouveau). Proche de la recopie : PR1-11 (réutilise le Set-Cookie lecteur=a81b de ET10).

LISTE 2. Mots ou notions des questions que le texte ne définit pas

- « Wi-Fi » (utilisé en ET9 et K9) : jamais défini.
- « paquets » (K9, ET9) : seulement nommé en ET2 (« Internet transporte des paquets »), jamais défini.
- « #53 » dans « Address: 192.168.1.1#53 » (PR1-3) : jamais expliqué, sans effet sur la réponse.
- « Tor » (C5, ET11) : seulement « logiciel dédié », sans définition.
- « jeton » : défini en ET10 (« la fiche l'appelle un jeton »), mais PR1-11 et R5 appellent le contenu « petite valeur » ; le lien avec abonne=5be1d2 (jeton ou préférence ?) est à deviner.
- « mise à jour » (PR1-7) : suppose le lien avec la maintenance (503), non écrit mais évident.
- « sous-domaine créé par le propriétaire » (K4) : « paris » et « cours » sont deux sous-domaines à deux niveaux, la règle ne traite que « formation » et « notes ».
- Trait d'union dans « formation-example.org-connexion.example.com » (R6) : la règle des deux derniers morceaux ne dit pas que les tirets ne séparent pas.

LISTE 3. Passages qui renvoient à autre chose que la fiche

- ET2 : « Des deux blocs d'avant » ; « Internet, réseau de réseaux », « Le réseau local et l'accès à Internet » ; adresse IP, DNS, box, terminal « redits » sans autre détail.
- ET2 et ET13 : « Replié sous « Ce qui sera vérifié » » (objectif replié, non affiché).
- ET4 : « le s de https, expliqué plus loin » ; « Les autres mots… expliqués dans les étapes qui suivent ».
- ET8 : « L'étape « Les codes, sans réfléchir » t'y entraîne ».
- ET13, ET17 : « plus bas, dans « Ce qu'on te demande », partie Pratique / Restitution ».
- ET14 : sites externes (Wikipédia, example.com, github.com, service WHOIS de l'AFNIC), « si la page de l'AFNIC a changé d'adresse, cherche WHOIS AFNIC » ; commandes ipconfig /displaydns et nslookup -debug.
- ET15 : séries sur trois jours différents.
- ET16 « La suite » : « Serveur local », « GitHub et hébergement », « Menaces », « Se protéger » ; « À explorer plus tard » (DNS autres types, HTTP récent, négociation TLS, cookies protégés, ordre des résultats).
- ET18 : « Bilan », erreurs critiques, bloc « À reprendre ».

LISTE 4. Passages qui parlent de la fiche au lieu de me parler

- Titre « (version 2) ».
- « [seulement si l'essai p1/p2/p3/p4/p5/p6 est faux] … [la réponse à l'essai p1] » : gabarits et identifiants d'essai que je ne vois nulle part (ET4, ET5, ET8, ET9, ET10, ET11).
- « Essaie avec ton bon sens. Personne ne te note… À la fin de cette étape, la page te montre tes réponses » (ET3) ; « Cet exercice n'est pas noté… le schéma de la fiche s'affiche ensuite, pour comparer » (ET16).
- « Ton pari », « Ton pari, repris », « Ton pari, corrigé », « fais ton pronostic » (ET1, ET12, ET16).
- « Cet identifiant, la fiche l'appelle un jeton » (ET10).
- « L'idée du bloc. », « Ce bloc est le dernier de la partie… Tu es ici. », « À la fin, tu sauras », « À quoi ça sert ».
- « Pour te le représenter… Ce que l'image ne dit pas » : commentaire de méthode sur les analogies (ET4, ET5, ET8, ET9, ET10, ET5 arbre).
- « Deux mots, pour lire », « Les quatre étages, pour lire », « Le code 503, pour lire » : étiquettes d'auteur.
- ET14 : « Un indice / Une piste détaillée / Une partie de la solution / La solution entière », « Ton constat. La page ne voit pas ta machine… Coche ce qui est vrai », « L'aide que tu as prise ».
- ET15 : « Une série est réussie quand… la preuve « Aisance » ».
- ET17 : « Elle se fait sans le cours : dès que tu commences, il est masqué… corrigées à la fin de la série ».
- ET18 : « Celles que la page a repérées dans tes réponses y sont déjà cochées ».
- Marques « [outil interactif : …] » sans contenu visible (deroule, pari, choix, chaine, apparier, releve, nombre, classer, systeme, aisance, schema).
- Consigne « Réponds avec ce qui précède, et seulement avec ça ».
