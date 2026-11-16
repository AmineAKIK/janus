# Rapport de l'apprenant neuf, B15 version 3

PR1-1 : déductible (ET4, « Combien de caractères ? ») : 12 caractères au moins pour un mot de passe seul. « la-pluie-tombe-sur-le-jardin » (28) est assez long, « Kx9#mQ2vLp7w » (12) est assez long, « Mot2Passe! » (10) est trop court.
PR1-4 : déductible (ET6, « Ce que filtre un pare-feu » et ET9, table « Quatre autres parades ») : le pare-feu décide d'après l'adresse, le port et le protocole. Il peut décider de la connexion venue d'une adresse interdite et de l'échange par un protocole interdit. Il ne peut pas décider du texte de l'e-mail ni de la pièce jointe .exe, qui sont du contenu (la pièce jointe est une déduction : le texte dit « contenu des e-mails », pas « pièces jointes »).
PR1-6 : déductible (ET7, « Les cinq gestes » et « Restaurer en dernier » ; ET5, « Une sauvegarde utile ») : à faire : débrancher du réseau, prévenir l'informatique, déposer plainte, restaurer depuis une sauvegarde saine une fois la machine remise en état. À éviter : payer la rançon, relier le disque de sauvegarde pour y copier les fichiers chiffrés (une sauvegarde reliée est atteinte aussi).
PR1-2 : déductible (ET4, « L'application et les codes de récupération ») : une application de codes, avec la liste de codes imprimée et rangée à part dans un lieu fermé (pas le SMS, pas une photo sur le téléphone).
PR1-3 : déductible (ET6, « Ce que protège un VPN » et « Ce qu'un VPN ne protège pas ») : le VPN protège le trajet du trafic jusqu'au serveur VPN, pas ce qu'est le programme installé. Il ne protège ni d'un logiciel malveillant ni d'un site qui vole des données.
PR1-5 : déductible (ET5, « La sauvegarde et le DDoS » et « Une sauvegarde utile ») : le ransomware seulement. La sauvegarde rend les données et ne retire aucune requête du DDoS.
PR1-7 : déductible (ET9, tables des parades ; ET5 ; ET4 « Un compte, un mot de passe ») : site piraté et même mot de passe : un mot de passe unique par compte. Fichiers chiffrés : sauvegarde saine, à part. Pièce jointe avis_taxe.docx.exe : vérifier l'expéditeur, le contexte et l'extension (la dernière est .exe, donc c'est un programme déguisé). Faille corrigée un mois plus tôt : installer les mises à jour.
PR1-8 : déductible (ET4, « La limite du second facteur ») : c'est faux. La double authentification limite les dégâts d'un mot de passe volé, mais elle ne rend pas un hameçonnage inoffensif : un relais en temps réel passe les deux facteurs.
B15-R1 : déductible (ET4, « Combien de caractères ? ») : « Chat2020! » fait 9 caractères, c'est trop court. Un chiffre et un symbole n'y changent rien. Il faut 12 caractères au moins, par exemple une phrase de passe, parce que chaque caractère de plus multiplie les combinaisons à essayer.
B15-R2 : déductible (ET6, « Ce qu'un VPN ne protège pas » ; ET3, « Le VPN de Samir ») : non, il faut garder la consigne. Le VPN protège le trajet du trafic, pas le contenu d'un fichier ouvert. Une pièce jointe piégée reste piégée avec ou sans VPN.
B15-R3 : déductible (ET6, « Ce que filtre un pare-feu ») : elle se trompe. Le pare-feu juge l'origine, le port et le protocole, il ne lit pas le contenu. Une pièce jointe piégée envoyée depuis un partenaire autorisé passe. Il faut aussi vérifier les pièces jointes.
B15-R4 : déductible (ET5, « La sauvegarde et le DDoS ») : une sauvegarde ne retire aucune requête. Le DDoS vise la disponibilité, pas les données. Il doit prévenir l'hébergeur, qui peut filtrer les requêtes, et la sauvegarde horaire ne servirait à rien contre ça.
B15-R5 : déductible (ET7, « Les cinq gestes » et « Restaurer en dernier ») : ne pas payer, car payer ne garantit pas que les criminels donnent la clé. Ne pas restaurer tout de suite, car le programme resté sur le poste rechiffre les fichiers restaurés. Il reste à signaler ou déposer plainte, puis à restaurer en dernier, depuis une sauvegarde saine, sur un poste remis en état.
B15-R6 : déductible (ET6, « Ce que protège un VPN » et ET9, « Une consigne qu'on peut suivre ») : « Sur un Wi-Fi public, active ton VPN : sinon les autres clients peuvent observer ce que tu envoies. » Il n'arrête pas un hameçonnage ni un logiciel malveillant.
B15-Q1 : déductible (ET4, « Le gestionnaire ») : la phrase de cinq mots, jamais utilisée ailleurs. Le mot de passe maître doit être le plus long et le plus solide, et utilisé nulle part ailleurs. Si la clé est faible, tout le coffre l'est.
B15-Q2 : déductible (ET4, « L'application et les codes de récupération ») : il se connecte avec un code de récupération de la copie imprimée dans le tiroir fermé. Ensuite il range les codes sur papier, à part du téléphone, dans un lieu fermé, jamais dans une note du téléphone ni dans le compte qu'ils protègent.
B15-Q3 : déductible (ET5, « Les mises à jour ») : la faille corrigée était publiée donc connue de tous, attaquants compris. Faute d'installer la mise à jour, elle est restée ouverte et un attaquant l'a exploitée pour copier les ventes.
B15-Q4 : déductible (ET5, « La pièce jointe ») : il regarde l'expéditeur, si le message était attendu et la vraie extension. La dernière est .exe, donc c'est un programme déguisé en document. Il ne l'ouvre pas et signale le message à la personne qui s'occupe de l'informatique.
B15-Q5 : déductible (ET8, « La CNIL et cybermalveillance.gouv.fr ») : cybermalveillance.gouv.fr, le dispositif d'assistance aux victimes, parce qu'il s'adresse à ceux qui n'ont pas de service informatique.
B15-Q6 : déductible (ET5, « La sauvegarde et le DDoS » ; ET12, « Ton pari, corrigé ») : elle règle le dossier supprimé par erreur, car elle rend les données. Elle ne règle pas le DDoS, qui vise la disponibilité et pas les données. Elle ne règle pas le mot de passe volé, car elle ne ferme pas un compte ouvert.
B15-C1 : déductible (ET4, « Combien de caractères ? ») : 10 caractères est moins que 12. Chaque caractère de plus multiplie le nombre de combinaisons, et un programme en teste des milliards par seconde. Majuscule, chiffre et symbole ne remplacent pas la longueur.
B15-C2 : déductible (ET4, « Deux facteurs » et « La limite du second facteur ») : le voleur entre pour celle qui a saisi mot de passe et code sur la fausse page, car la page les relaie au vrai site avant l'expiration du code. Pour l'autre, le mot de passe volé ne suffit pas : il lui manque le code.
B15-C3 : déductible (ET5, « Une sauvegarde utile » ; ET7, « Restaurer en dernier ») : la copie de lundi midi, faite avant l'ouverture du message piégé lundi soir, donc saine. Celle de mardi 8 h copie l'infection. Il remet le poste en état d'abord : le programme resté dessus rechiffrerait les fichiers restaurés, et le poste relié au réseau peut atteindre d'autres machines.
B15-T1 : déductible (ET6, deux sections ; ET9, tables) : l'erreur est de croire que le VPN et le pare-feu arrêtent un fichier piégé. Le VPN protège le trajet, le pare-feu juge adresses, ports et protocoles. Aucun ne lit ce que contient le fichier. Correction : ils ne protègent pas d'une pièce jointe piégée, il faut aussi vérifier les pièces jointes et garder une sauvegarde saine.
B15-T2 : déductible (ET5, « La sauvegarde et le DDoS ») : la consigne reste juste pour le ransomware, et la copie à part sert aussi pour le disque en panne (perte de données, la sauvegarde les rend). Face au DDoS, la sauvegarde ne fait rien : elle ne retire aucune requête, il faut prévenir l'hébergeur.
B15-T3 : déductible (ET7, « Les cinq gestes » ; définitions de la question) : non. Un 404 est la réponse normale d'un site à une adresse inexistante. Aucun fichier n'est chiffré et aucune rançon n'est demandée, donc il n'y a ni ransomware ni conduite à appliquer.
B15-K1 : déductible (ET4, « Combien de caractères ? ») : « le-chat-dort-sur-mon-clavier » : 28 caractères, au-dessus de 12. Les 10 caractères au hasard sont trop courts.
B15-K2 : déductible (ET4, « Un compte, un mot de passe » et « Le gestionnaire ») : elle se trompe. Réutiliser un mot de passe est un défaut grave : un site piraté ouvre tous les comptes. Il faut un mot de passe unique par compte, et le gestionnaire permet de n'en retenir qu'un.
B15-K3 : déductible (ET4, « Deux facteurs ») : non. Empreinte et visage sont deux fois « ce que tu es », la même catégorie. Il faut deux facteurs de catégories différentes.
B15-K4 : déductible (ET4, « L'application et les codes de récupération ») : celle qui utilise le SMS. Il voyage par le numéro de téléphone, qu'un attaquant peut se faire attribuer ou intercepter. Le code de l'application reste sur l'appareil.
B15-K5 : déductible (ET5, « Les mises à jour ») : elle ne clique pas. Une mise à jour s'installe depuis la source officielle du logiciel, jamais depuis une fenêtre affichée par un site : une fausse fenêtre installe un logiciel malveillant.
B15-K6 : déductible (ET5, « Une sauvegarde utile ») : il lui manque d'être à part (hors ligne, débranchée), régulière (un an, c'est trop vieux), testée par une restauration, et saine.
B15-K7 : déductible (ET6, « Ce que protège un VPN » et « Ce qu'un VPN ne protège pas ») : face au voisin, il ne voit qu'un trafic chiffré jusqu'au serveur VPN. Face au faux site, rien : le mot de passe arrive chiffré jusqu'à la fausse page. Il faut lire le domaine.
B15-K8 : déductible (ET6, « Ce que filtre un pare-feu ») : non. Le site est autorisé et le pare-feu ne regarde ni le contenu ni le fichier téléchargé. Il ne juge que l'adresse, le port et le protocole.
B15-K9 : déductible (ET8, « L'ANSSI et le CERT-FR ») : le CERT-FR, le centre de veille et de réponse aux incidents de l'ANSSI, qui publie des alertes et des avis sur les failles et les attaques en cours.
B15-K10 : déductible (ET8, « La CNIL et cybermalveillance.gouv.fr ») : la CNIL, l'autorité de protection des données personnelles, qui veille au respect des règles sur les fichiers de personnes.

## Les quatre listes

### 1. NON DÉDUCTIBLES et RECOPIÉS

- NON DÉDUCTIBLES : aucun.
- RECOPIÉS : aucun mot pour mot. Quasi-copies, où la réponse reprend le cas déjà travaillé : PR1-3 (même scène que « Le VPN de Samir »), PR1-5 (même cas qu'Inès et Farid), PR1-8 (même cas que « La limite du second facteur »), B15-R4 (même cas que le DDoS d'Inès), K9 et K10 (quasi la phrase de présentation de l'organisme).
- Deux réponses reposent sur un petit saut d'inférence : PR1-4 (« pièce jointe .exe » comme contenu d'e-mail, alors que le texte dit « contenu des e-mails ») et B15-T2 (« Que devient la consigne » est ambigu).

### 2. Mots employés par les questions et jamais définis

- Aucun mot technique important manquant.
- « Infection » et « infecter » sont définis seulement par « machine infectée ».
- « Remise en état » est défini dans « Restaurer en dernier » mais est utilisé en PR1-6, qui ne le définit pas.
- « Partenaires » (R3) et « logiciel de caisse » (Q3) sont du vocabulaire courant, non défini.
- Le détail de « hameçonnage relayé » est défini en ET4 et rappelé dans les questions.

### 3. Passages qui renvoient à autre chose que la fiche

- ET2 : « Le premier [bloc] apprend à reconnaître les menaces… Les suivants portent sur les données personnelles, le droit d'auteur et la veille », et « chaque parade reliée à la menace du bloc précédent » (mots du bloc précédent non montrés ici).
- ET7 : le sixième réflexe (notifier la CNIL) « s'apprend avec les données personnelles ».
- ET11 : « Tu peux vérifier leur rôle sur leurs sites : cybermalveillance.gouv.fr, cyber.gouv.fr, cert.ssi.gouv.fr et cnil.fr ».
- ET11 : l'exercice sur tes propres comptes suppose l'accès à de vrais paramètres de sécurité.
- ET12 : « À l'écran suivant, tu relies une parade à une menace, sur un autre cas », « La suite » (le bloc suivant sur les données personnelles) et « À explorer plus tard » (clés d'accès, filtres de messagerie, antivirus, notification d'une violation de données).
- ET10 et ET13 : « plus bas, dans "Ce qu'on te demande" ».
- ET2 et ET10 : le texte « Ce qui sera vérifié » est coupé en plein mot (« qu'elle contre ») et ne se lit pas en entier.

### 4. Passages qui parlent de la fiche au lieu de parler à l'apprenant

- ET1 : « Regarde seulement ce qu'elle voit : tu n'as rien à retenir ici. »
- Tout au long : les étiquettes « Pour lire : », « Tu es ici : » et « J'ai essayé seul, et je suis bloqué / Un indice / Une piste détaillée / Une partie de la solution ».
- ET3 : « Essaie avec ton bon sens. Personne ne te note. »
- ET2 : « Ce schéma montre un seul chemin, celui du cas de Lina : il ne dit pas encore quelles autres parades existent. »
- ET5 : « Cette chaîne montre le seul cas de Farid : une autre parade suivrait la même route ».
- ET4, ET5 et ET6 : les gabarits non remplis « [seulement si l'essai p1 est faux ou passé] … Tu avais répondu [la réponse à l'essai p1] » (p1, p2, p3, p4).
- ET4, ET6 et ET8 : « Ce que l'image ne montre pas », des remarques sur l'image mentale.
- ET9 : « Voici le début de la table de Yasmine ».
- ET11 : « La page ne voit pas ta machine : c'est toi qui dis ce que tu as fait. Coche ce qui est vrai ».
- ET11 : « Les quatre organismes sont nommés dans la consigne plus bas : à toi de leur attribuer ces rôles. »
- ET12 : « Tu as déjà vu deux chaînes remplies… Voici maintenant celle de Noah, à remplir ».
- ET13 : « Elle se fait sans le cours : dès que tu commences, il est masqué… ».
- ET14 : « Celles que la page a repérées dans tes réponses y sont déjà cochées ».
- Plusieurs mentions « Pour lire » contiennent une partie de la réponse, et les éléments PR1-1 et PR1-4 donnent une ligne déjà classée.
