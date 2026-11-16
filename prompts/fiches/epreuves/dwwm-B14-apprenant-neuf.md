PR1-1 : déductible (ET4 « Le cadenas », ET8 « Chaque attaque, sa propriété ») : le cadenas ne prouve pas « Le site est honnête » ni « Le domaine de la page est celui de sa mutuelle » ; il prouve « Le certificat est lié au domaine de la page », puisqu'un certificat est délivré pour un domaine précis.
PR1-2 : déductible (ET4 « Les pièges de l'adresse », « Le vrai domaine ») : l'hôte est ce qui suit le @, donc verif-suivi.example ; ce qui précède est un identifiant ; le domaine est verif-suivi.example.
PR1-3 : déductible (ET5 « Les indices ») : indice : adresse d'expéditeur (horizon-assurance-suivi.example, pas assurance-horizon.example) ; indice : menace de résiliation ce soir ; indice : demande de 38 euros ; ne prouve rien : français correct ; indice : « Cher client » ; indice : lien vers le domaine paiement-securise.example, autre que celui de l'assurance ; ne prouve rien : message court.
PR1-4 : déductible (ET6 « Deux questions pour un programme ») : ver pour sa propagation (il se copie seul par le réseau), ransomware pour son effet (il chiffre et demande une rançon).
PR1-5 : déductible (ET7 « Zombies et botnet ») : PC du comptable = zombie ; les 40 000 appareils pilotés ensemble = botnet ; serveur de l'association = cible ; caméra infectée = zombie.
PR1-6 : déductible (ET7 « Un DDoS ne vole rien ») : la première réponse : rien ne prouve le vol, un DDoS ne vole ni n'efface rien ; il faudrait vérifier si une autre attaque a eu lieu (diversion).
PR1-7 : déductible (ET5 « Un message qui te connaît ») : du spear phishing (phishing ciblé, avec des informations vraies sur Lina).
PR1-8 : déductible (ET8 « Chaque attaque, sa propriété », « Ce qui se range à part ») : chiffrement des dossiers de la mairie = disponibilité ; mot de passe donné à un inconnu = confidentialité ; numéro de compte changé = intégrité ; billetterie saturée = disponibilité.
B14-R1 : déductible (ET4 « Le cadenas ») : le cadenas dit seulement que l'échange avec le domaine de la page est chiffré ; le domaine ici est verif-paiement.example (billets-vite est un sous-domaine), qui n'est pas prouvé être celui du vrai site ; il faut lire le domaine, pas se fier au cadenas.
B14-R2 : déductible (ET6 « Le ransomware ») : non, ransomware nomme ce que fait le programme (il chiffre et demande une rançon), pas comment il se propage ; ici il est arrivé par une pièce jointe (le vecteur) ; on ne sait pas s'il se propage comme un virus.
B14-R3 : déductible (ET7 « Zombies et botnet ») : il faut écrire « 3 000 zombies d'un même botnet » : un zombie est une machine, le botnet est l'ensemble.
B14-R4 : déductible (ET7 « Un DDoS ne vole rien ») : rien ne prouve cela ; un DDoS rend un service indisponible et ne copie rien ; il faudrait chercher une autre attaque éventuelle.
B14-R5 : déductible (ET5 « Un message qui te connaît ») : spear phishing : phishing ciblé qui se fait passer pour la directrice en citant des faits vrais (date de stage) pour obtenir 60 euros ; l'adresse a le domaine formation-horizon-pro.example, différent de formation-horizon.example.
B14-R6 : déductible (ET8 « Chaque attaque, sa propriété ») : l'intégrité : les notes existent et se lisent mais ne sont plus exactes ; la pièce jointe n'est que le vecteur.
B14-Q1 : déductible (ET4 « Le vrai domaine », « Le cadenas ») : le domaine de l'hôte, en lisant de droite à gauche : verif-client.example (compte-banque est un sous-domaine) ; le cadenas ne le dit pas.
B14-Q2 : déductible (ET5 « Les indices ») : 1) adresse d'expéditeur transports-rapide-suivi.example, pas transports-rapide.example ; 2) urgence : « URGENT », « ce soir » ; 3) salutation générique « Cher client » ; 4) demande de paiement de 12 euros ; 5) lien vers paiement-colis.example, domaine différent ; en plus : pièce jointe inattendue facture.exe, faute « fesons ».
B14-Q3 : déductible (ET4 « Qui écrit vraiment ? », « Où mène ce lien ? ») : sur ordinateur, elle touche ou survole le nom de l'expéditeur pour voir l'adresse, puis pose le pointeur (survol) sur le bouton et lit l'adresse affichée, sans cliquer.
B14-Q4 : déductible (ET6 « Virus, ver, trojan », « Le ransomware ») : propagation : virus (il se greffe sur un fichier transmis) ; effet : ransomware.
B14-Q5 : déductible (ET7 « Zombies et botnet ») : 1 100 zombies (400 + 700) et 2 botnets, un par attaquant.
B14-Q6 : déductible (ET7 « Trop de requêtes ») : un DDoS, car les requêtes viennent de nombreuses sources (9 000 adresses différentes), pas d'une seule.
B14-C1 : déductible (ET4 « Le cadenas ») : faux : le cadenas ne dit que l'échange avec le domaine est chiffré ; un faux site peut avoir un cadenas ; il faut lire le domaine.
B14-C2 : déductible (ET6 « Le ransomware ») : faux : virus, ver et trojan disent comment un programme se propage, ransomware dit ce qu'il fait ; seul le virus est un virus.
B14-C3 : déductible (ET7 « Un DDoS ne vole rien ») : la partie zombies/botnet/saturation est juste, mais « volé les données » est faux : un DDoS ne vole rien ; si des données ont été volées, c'est une autre attaque, et le titre ne devrait pas dire « c'est un DDoS » pour le vol.
B14-T1 : déductible (ET4 « Le vrai domaine », « Le cadenas ») : son erreur : le domaine est remboursement-vite.example, mutuelle-horizon n'est qu'un sous-domaine, et le cadenas ne prouve pas que le site est celui de la mutuelle ; il aurait dû lire le domaine et ne pas saisir sa carte.
B14-T2 : déductible (ET6 « Virus, ver, trojan », « Le ransomware ») : erreur : un programme qui se copie seul par le réseau est un ver, pas un virus ; correction : ver pour la propagation, ransomware pour l'effet.
B14-T3 : déductible (ET7 « Trop de requêtes ») : un DoS, car toutes les requêtes viennent d'une seule source (une même adresse).
B14-T4 : RECOPIÉE (ET7 « Trop de requêtes ») : non, un 404 touche une page seulement, un DDoS touche tout le service ; la réponse est écrite dans la question et dans l'explication.
B14-K1 : déductible (ET5 « Un message qui te connaît ») : le second est du spear phishing : il cite des faits vrais sur Samir (prénom, commande) ; le premier est de masse (« Cher client »).
B14-K2 : déductible (ET5 « Par SMS ») : phishing pour l'e-mail, smishing pour le SMS.
B14-K3 : déductible (ET4 « Le vrai domaine ») : domaine suivi-rapide.example ; sous-domaine mutuelle-horizon.
B14-K4 : déductible (ET4 « Les pièges de l'adresse ») : l'hôte est suivi-dossier.example ; ce qui précède @ est un identifiant, pas l'hôte.
B14-K5 : déductible (ET6 « La pièce jointe ») : vecteur : le fichier joint ouvert ; effet : le chiffrement de ses documents.
B14-K6 : déductible (ET6 « Virus, ver, trojan ») : le premier est le virus (il passe quand elle ouvre un fichier) ; le second est le ver (il se copie seul par le réseau).
B14-K7 : déductible (ET6 « Virus, ver, trojan ») : un trojan, car Samir l'a installé lui-même en le croyant utile ; il ne se copie pas seul.
B14-K8 : déductible (ET8 « Trois propriétés », ET7) : la disponibilité ; non, aucune donnée volée : les réservations sont revenues et un DDoS ne vole pas.
B14-K9 : déductible (ET8 « Chaque attaque, sa propriété ») : la confidentialité : l'attaquant lit des informations réservées.

LISTE 1 : éléments NON DÉDUCTIBLES : aucun. Éléments RECOPIÉS : B14-T4 (la réponse « 404 = une page, pas le service » est dans la consigne de la question et dans l'explication de ET7). Quasi recopiées, à surveiller : B14-C2 et B14-R2 (même idée que la correction de Farid « ce n'est pas un virus »), B14-K9 et PR1-7 (cas déjà montré tel quel, seul le contexte change).

LISTE 2 : mots ou notions employés par les questions sans définition dans le texte :

- « adresse » au sens de machine source (B14-Q6 « 9 000 adresses différentes ») : on suppose adresse = source, jamais écrit.
- « URL » (dans « Ce qui sera vérifié ») : jamais défini.
- « ANSSI » : cité plusieurs fois, jamais expliqué.
- « tiers de confiance » : utilisé dans la définition du phishing, jamais expliqué.
- « exécuter » (un fichier) : employé sans définition.
- « virement », « résilier », « diversion » (définie seulement en ET8) : mots de contexte non définis ou définis tard.
- « cible » : glosée en ET7 (« le service attaqué ») mais redéfinie dans PR1-5.
- « propagation » en tant que nom : défini seulement par « se propager », et dans ET11.

LISTE 3 : passages qui renvoient à autre chose que la fiche :

- « Le bloc suivant, sur les parades, répondra à chaque menace » (ET2, ET11) ; « À explorer plus tard » (parades, autres malwares, phishing par appel, domaines à extension en deux parties, après une attaque) ; « Ce bloc n'enseigne pas les parades ».
- « la fiche sur l'hameçonnage de cybermalveillance.gouv.fr » (ET5) ; « définition de l'ANSSI », « d'après l'ANSSI », « guide de l'ANSSI » (ET6, ET7).
- « Ce bloc ouvre la partie “Le cadre du métier” » avec quatre familles de règles (ET2).
- « Replié sous “Ce qui sera vérifié” » (ET2, ET9) ; « plus bas, dans “Ce qu'on te demande” » (ET9, ET12).
- « À l'écran suivant, tu nommes une autre attaque » (ET11).
- ET10 exige un vrai message, une messagerie et un papier : impossible à faire ici.

LISTE 4 : passages qui parlent de la fiche au lieu de m'en parler :

- Étiquettes « Pour lire : » répétées partout, y compris dans chaque question.
- « [seulement si l'essai p1 est faux ou passé] … [la réponse à l'essai p1] » (ET4), « p2 » (ET6), « p3 » (ET7) : consignes d'auteur et variables non remplies, visibles dans le texte.
- Numéros d'étape « ET1 » à « ET13 » et titres « Ce que la fiche enseigne » ; « Regarde seulement ce qu'elle fait : tu n'as rien à retenir ici » (ET1).
- « Replié sous “Ce qui sera vérifié” » : la liste de vérification est copiée telle quelle deux fois (ET2, ET9).
- « Ce schéma montre un seul chemin… », « Cette chaîne montre un seul cas… » : remarques de conception.
- « Essaie d'abord seul, jusqu'à avoir fait un geste… : les coups de pouce viennent après » ; « J'ai essayé seul, et je suis bloqué / Un indice / Une piste détaillée / Une partie de la solution » ; « L'aide que tu as prise : Aucune aide… La solution entière » ; « Ton constat. La page ne voit pas ta machine » ; « Personne ne te note » ; « Tu es ici : » (ET10) ; « Elle se fait sans le cours : dès que tu commences, il est masqué… corrigées à la fin de la série » (ET12) ; « Celles que la page a repérées dans tes réponses y sont déjà cochées » (ET13).
- Les 13 « [outil interactif : … ] » (deroule, pari, choix, saisie, apparier, classer, schema) : je ne vois pas ce qu'ils montrent ; j'ai répondu uniquement avec le texte écrit autour.
