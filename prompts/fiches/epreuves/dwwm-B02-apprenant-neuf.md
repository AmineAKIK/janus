# B02 : réponses de l'apprenant

## Pratique

PR1-6 : déductible (ET8, Tracer) : 17 ans, pas habitant : ligne 1 17 < 4 FAUX ; ligne 2 17 < 18 OU FAUX = VRAI OU FAUX = VRAI ; ligne 3 pas testée ; affiche « 2 € ». 18 ans, habitant : ligne 1 18 < 4 FAUX ; ligne 2 18 < 18 OU VRAI = FAUX OU VRAI = VRAI ; ligne 3 pas testée ; affiche « 2 € ». 60 ans, pas habitant : ligne 1 60 < 4 FAUX ; ligne 2 60 < 18 OU FAUX = FAUX OU FAUX = FAUX ; ligne 3 60 ≥ 60 VRAI ; affiche « 3 € ».
PR1-2 : déductible (ET6, ET avant OU) : comparaisons d'abord : 8 < 12 = VRAI, 8 ≥ 65 = FAUX ; puis ET : FAUX ET résident = FAUX ET FAUX = FAUX ; puis OU : VRAI OU FAUX = VRAI ; le musée est gratuit.
PR1-5 : déductible (ET7, Le ou exclusif) : Oui. C'est une condition pour avoir droit à quelque chose (valider son compte) et rien ne fait choisir : OU inclusif, VRAI OU VRAI = VRAI.
PR1-8 : déductible (ET9, Variable et égalité) : = range 1234 dans code au lieu de comparer, et 1234, nombre autre que 0, compte comme VRAI dans un if : la branche s'exécute toujours. Il faut écrire if (code === 1234).
PR1-1 : déductible (ET5, ET et Quatre lignes) : A = FAUX, B = FAUX : NON B = VRAI, A ET NON B = FAUX ; A = FAUX, B = VRAI : NON B = FAUX, résultat FAUX ; A = VRAI, B = FAUX : NON B = VRAI, résultat VRAI ; A = VRAI, B = VRAI : NON B = FAUX, résultat FAUX.
PR1-7 : déductible (ET8, La chaîne et L'ordre des lignes) : « bas ». 95 ≥ 10 est VRAI dès la première ligne, la chaîne exécute cette branche et sort : les lignes suivantes ne sont pas testées.
PR1-4 : déductible (ET7, La méthode et Les pièges du français) : (jours ≤ 30 OU défectueux) ET NON personnalisé. Le « ou » donne un droit, donc OU inclusif ; « sauf » donne ET NON ; les parenthèses gardent le sens : sans elles, ET passerait avant OU et un article défectueux personnalisé serait remboursé.
PR1-3 : déductible (ET6, ET avant OU et Les parenthèses) : parenthèses d'abord : connecté OU invité = FAUX OU VRAI = VRAI ; dans la seconde, la comparaison articles = 0 donne 3 = 0 = FAUX ; NON FAUX = VRAI ; VRAI ET VRAI = VRAI : le bouton Commander s'affiche.
PR2-1 : déductible (ET8, L'ordre des lignes) : SI points ≥ 1000 : afficher « or » ; SINON SI points ≥ 500 : afficher « argent » ; SINON SI points ≥ 100 : afficher « bronze » ; SINON : afficher « aucun ». On commence par la condition la plus exigeante, celle que le moins de valeurs remplissent.
PR2-2 : déductible (ET4, Comparer ; ET8, Les valeurs limites) : 99 et 100 (pour points ≥ 100), 499 et 500 (pour points ≥ 500), 999 et 1000 (pour points ≥ 1000).
PR2-3 : déductible (ET8, Tracer) : 99 : ligne 1 FAUX, ligne 2 FAUX, ligne 3 FAUX, SINON : « aucun ». 100 : FAUX, FAUX, 100 ≥ 100 VRAI : « bronze ». 499 : FAUX, FAUX, 499 ≥ 100 VRAI : « bronze ». 500 : FAUX, 500 ≥ 500 VRAI, ligne 3 pas testée : « argent ». 1000 : 1000 ≥ 1000 VRAI, lignes 2 et 3 pas testées : « or ».
PR2-4 : déductible (ET9, Le même code en JavaScript et Le guichet en JavaScript) : if (points >= 1000) { console.log('or') } else if (points >= 500) { console.log('argent') } else if (points >= 100) { console.log('bronze') } else { console.log('aucun') }
PR2-5 : déductible (ET9, Ouvrir la console et Prédire, puis exécuter) : je prédis « argent » pour points = 500 (500 ≥ 1000 FAUX, 500 ≥ 500 VRAI), puis « argent » pour points = 999 (999 ≥ 1000 FAUX, 999 ≥ 500 VRAI), chaque fois suivi de undefined, qui n'est pas une erreur ; pour la deuxième fois j'écris points = 999 sans let, sinon la console répond « has already been declared ».

## Restitution

B02-R9 : RECOPIÉE (ET5, OU et ET) : OU : FAUX FAUX → FAUX ; FAUX VRAI → VRAI ; VRAI FAUX → VRAI ; VRAI VRAI → VRAI. ET : FAUX FAUX → FAUX ; FAUX VRAI → FAUX ; VRAI FAUX → FAUX ; VRAI VRAI → VRAI.
B02-R8 : déductible (ET6, ET avant OU et Pas à pas) : d'abord la comparaison : 12 ≥ 10 = VRAI ; puis NON : NON absent = NON VRAI = FAUX ; puis ET : bonus ET FAUX = VRAI ET FAUX = FAUX ; enfin OU : VRAI OU FAUX = VRAI.
B02-R3 : déductible (ET7, Le ou exclusif) : carte OU identité. Le « ou » est inclusif : c'est une condition pour avoir droit à quelque chose (emprunter), aucun mot ne fait choisir, et avoir les deux ne gêne personne ; c'est le sens du OU quand rien ne dit le contraire.
B02-R4 : déductible (ET8, La chaîne) : « 0 € ». abonné est VRAI à la première ligne : la chaîne exécute cette branche puis sort, les conditions suivantes ne sont même pas testées et SINON ne prend que les cas où aucune n'est VRAIE, donc « 12 € » ne s'affiche pas.
B02-R10 : déductible (ET8, L'ordre des lignes et Les valeurs limites) : SI batterie ≥ 80 : afficher « pleine » ; SINON SI batterie ≥ 40 : afficher « correcte » ; SINON SI batterie ≥ 10 : afficher « faible » ; SINON : afficher « à charger ». Valeurs limites : 79 et 80, 39 et 40, 9 et 10.
B02-R7 : déductible (ET9, Le même code en JavaScript et Variable et égalité) : if (batterie >= 80 && !enCharge) { console.log('débranche') }. Avec if (batterie = 100), le = range 100 dans batterie au lieu de comparer, puis le if teste 100, qui compte comme VRAI car c'est un nombre autre que 0 : « débranche » s'afficherait à chaque fois, quelle que soit la batterie de départ, sans message d'erreur.

## Rappel

B02-Q1 : RECOPIÉE (ET5, OU et Quatre lignes) : VRAI OU VRAI donne VRAI ; VRAI ET FAUX donne FAUX.
B02-Q9 : déductible (ET6, ET avant OU et Les parenthèses) : A OU B ET C : ET d'abord, B ET C = VRAI ET FAUX = FAUX, puis A OU FAUX = VRAI OU FAUX = VRAI. (A OU B) ET C : parenthèse d'abord, VRAI OU VRAI = VRAI, puis VRAI ET FAUX = FAUX.
B02-Q3 : RECOPIÉE (ET8, La chaîne ; ET12, À retenir) : une seule au plus : la branche de la première condition VRAIE, ou celle de SINON si aucune n'est VRAIE ; sans SINON, il se peut qu'aucune ne s'exécute.
B02-Q4 : déductible (ET9, Variable et égalité) : let total = 0 crée la variable total et y range 0 (affectation). total === 0 compare : il teste si total est égal à 0 (égalité stricte), et donne true juste après cette ligne.
B02-Q5 : déductible (ET4, Comparer) : note < 10 vaut FAUX (strictement plus petit, et 10 n'est pas plus petit que 10) ; note ≤ 10 vaut VRAI (quand les deux nombres sont égaux, seuls ≤, ≥ et = donnent VRAI).
B02-Q6 : déductible (ET5, Quatre lignes) : 32 lignes. Chaque fait vaut VRAI ou FAUX, et chaque fait de plus double le nombre de lignes : 2 × 2 × 2 × 2 × 2 = 32, de 00000 à 11111.
B02-Q7 : déductible (ET7, Le ou exclusif ; ET12, Les mots du bloc) : (train OU car) ET NON (train ET car).
B02-Q8 : RECOPIÉE (ET9, Ouvrir la console) : Ctrl+Maj+J dans Chrome et Edge, Ctrl+Maj+K dans Firefox, ou F12 puis l'onglet Console (Windows, Linux) ; Cmd+Option+J dans Chrome, Cmd+Option+K dans Firefox sur Mac ; Safari : activer les outils dans Réglages, Avancés, puis Cmd+Option+C. undefined n'est pas une erreur : la ligne range 5 dans x, elle ne calcule rien à montrer.

## Tâches différées

B02-C1 : déductible (ET5, OU) : il confond le OU de la logique, inclusif, avec le « ou » du français qui interdit parfois les deux. La condition vaut VRAI OU VRAI = VRAI : Lina doit entrer.
B02-C6 : déductible (ET6, ET avant OU et Les parenthèses) : première : comparaison 20 < 18 = FAUX ; ET : FAUX ET weekend = FAUX ET FAUX = FAUX ; OU : FAUX OU férié = FAUX OU VRAI = VRAI. Deuxième : parenthèse d'abord : weekend OU férié = FAUX OU VRAI = VRAI ; comparaison 20 < 18 = FAUX ; FAUX ET VRAI = FAUX. Ils diffèrent parce que, sans parenthèses, ET passe avant OU ; les parenthèses changent l'ordre de calcul, donc le résultat.
B02-C3 : déductible (ET8, L'ordre des lignes et Les valeurs limites) : pour 100, elle affiche « ralentis » (100 > 50 VRAI à la première ligne, la ligne « danger » n'est jamais atteinte). Corrigée : SI vitesse > 90 : afficher « danger » ; SINON SI vitesse > 50 : afficher « ralentis » ; SINON : afficher « ok ». Valeurs limites : 90 et 91 pour vitesse > 90, 50 et 51 pour vitesse > 50.
B02-C4 : déductible (ET9, Variable et égalité) : = range 20 dans note au lieu de comparer, puis le if teste 20, qui compte comme VRAI car c'est un nombre autre que 0 : la branche s'exécute à chaque fois. Correction : if (note === 20) { console.log('parfait') }
B02-C5 : déductible (ET7, Les pièges du français) : avec enfant ET étudiant, seul quelqu'un qui est à la fois enfant et étudiant paie demi-tarif. La bonne : enfant OU étudiant, car le « et » de la phrase ajoute deux groupes de clients, et chacun a droit au demi-tarif.
B02-DE1 : RECOPIÉE (ET5, Quatre lignes) : deux conditions, chacune VRAI ou FAUX : 2 × 2 = 4 cas, comme 2 bits donnent 4 valeurs. On les range comme on compte en binaire : 00, 01, 10, 11. Avec trois faits, il en faut 2 × 2 × 2 = 8, de 000 à 111 : chaque condition de plus double le nombre de lignes.
B02-DE6 : RECOPIÉE (ET6, Les parenthèses) : sans parenthèses, ET passe d'abord : (FAUX ET VRAI) OU VRAI = FAUX OU VRAI = VRAI. Avec parenthèses, elles passent d'abord : FAUX ET (VRAI OU VRAI) = FAUX ET VRAI = FAUX. Les parenthèses changent l'ordre de calcul, donc le résultat.
B02-DE3 : RECOPIÉE (ET8, L'ordre des lignes) : la chaîne s'arrête à la première ligne VRAIE, donc l'ordre change ce qu'elle affiche ; une condition moins exigeante placée avant capte aussi les valeurs de la plus exigeante. Exemple : le thermostat avec SI température ≥ 15 « tiède » avant SINON SI température ≥ 25 « chaud » affiche « tiède » par 30 °C, et la ligne « chaud » n'est jamais atteinte.
B02-DE7 : RECOPIÉE (ET9, Variable et égalité) : JavaScript range 18 dans age, puis teste 18 ; dans un if, un nombre autre que 0 compte comme VRAI, donc la branche s'exécute à chaque fois, quel que soit l'âge de départ. Il faut écrire if (age === 18).
B02-DE5 : RECOPIÉE (ET5, OU ; ET7, Le ou exclusif) : le OU de la logique est inclusif, il accepte les deux à la fois (VRAI OU VRAI donne VRAI) et s'écrit A OU B. Le « ou » de « fromage ou dessert » est exclusif, il interdit les deux, et s'écrit (fromage OU dessert) ET NON (fromage ET dessert).
B02-DT1 : déductible (ET7, Le ou exclusif et Les pièges du français) : (a) badge OU code : OU inclusif, c'est une condition pour avoir droit d'entrer, avoir les deux ne gêne personne. (b) (entrée OU dessert) ET NON (entrée ET dessert) : forme exclusive, car « au choix » fait choisir un seul des deux. (c) âge < 12 OU âge > 65 : OU, car ce « et » ajoute deux groupes ; avec ET il faudrait être des deux groupes à la fois, donc personne.
B02-DT6 : déductible (ET8, Les valeurs limites ; ET6, Les parenthèses) : SI note ≥ 10 OU (note ≥ 8 ET stage) : afficher « admis » ; SINON : afficher « refusé ». Valeurs à tester : 7, 8, 9 et 10, chacune deux fois, avec stage VRAI puis avec stage FAUX (attendu : 7 refusé dans les deux cas ; 8 et 9 admis avec stage, refusés sans ; 10 admis dans les deux cas).
B02-DT3 : déductible (ET7, Le ou exclusif et Les pièges du français) : non, je ne peux pas trancher : c'est une chose offerte, sans mot qui fait choisir, seul celui qui l'offre sait s'il donne les deux. Avant d'écrire le code, je demande à la boutique, qui a écrit la règle, si les deux sont permis.
B02-DT4 : déductible (ET8, L'ordre des lignes ; ET9, Le même code en JavaScript) : pour age = 8, il affiche « ado » : 8 < 18 est VRAI dès la première ligne, et la ligne « enfant » n'est jamais atteinte. L'erreur : la condition la plus exigeante (age < 12, que le moins de valeurs remplissent) doit venir en premier. Correction : if (age < 12) { console.log('enfant') } else if (age < 18) { console.log('ado') } else { console.log('adulte') }
B02-DT8 : déductible (ET9, Le même code en JavaScript et Variable et égalité ; ET6, Les parenthèses) : if ((motDePasse === 'secret' && essais < 3) || motDePasse === 'urgence') : === compare le texte tapé avec 'secret' ou 'urgence' (égalité stricte), < compare essais à 3 (strictement plus petit), && est le ET, || est le OU, et les parenthèses gardent le sens : la limite d'essais ne porte que sur 'secret', pas sur 'urgence'.

## Cartes

B02-K1 : RECOPIÉE (ET4, VRAI ou FAUX ; ET12, Les mots du bloc) : une valeur VRAI ou FAUX, celle d'une condition : 1 ou 0 dans la machine, true ou false en JavaScript.
B02-K2 : RECOPIÉE (ET5, ET) : FAUX ET FAUX = FAUX ; FAUX ET VRAI = FAUX ; VRAI ET FAUX = FAUX ; VRAI ET VRAI = VRAI.
B02-K3 : RECOPIÉE (ET5, OU) : FAUX OU FAUX = FAUX ; FAUX OU VRAI = VRAI ; VRAI OU FAUX = VRAI ; VRAI OU VRAI = VRAI.
B02-K4 : RECOPIÉE (ET6, ET avant OU ; ET12, À retenir) : ce qui est entre parenthèses, puis les comparaisons, puis NON, puis ET, puis OU.
B02-K5 : RECOPIÉE (ET7, Le ou exclusif ; ET12, Les mots du bloc) : un « ou » qui est VRAI quand un seul des deux est VRAI ; il s'écrit (A OU B) ET NON (A ET B).
B02-K6 : RECOPIÉE (ET8, La chaîne ; ET12, À retenir) : la branche de la première condition VRAIE, et elle seule ; SINON si aucune n'est VRAIE.
B02-K7 : RECOPIÉE (ET4, Comparer ; ET12, Les mots du bloc) : une valeur où une condition change : la dernière où elle est FAUSSE et la première où elle est VRAIE, 17 et 18 pour âge ≥ 18.
B02-K12 : RECOPIÉE (ET9, Variable et égalité) : = range 18 dans age au lieu de comparer, puis le if teste 18, et un nombre autre que 0 compte comme VRAI en JavaScript.
B02-K11 : RECOPIÉE (ET8, L'ordre des lignes) : que la condition de la ligne du dessus, la première, est FAUSSE : chaque ligne peut compter sur le fait que toutes celles du dessus sont FAUSSES.
B02-K10 : RECOPIÉE (ET9, Ouvrir la console) : Ctrl+Maj+J dans Chrome et Edge, Ctrl+Maj+K dans Firefox, ou F12 puis l'onglet Console ; sur Mac Cmd+Option+J (Chrome), Cmd+Option+K (Firefox) ; Safari : activer les outils dans Réglages, Avancés, puis Cmd+Option+C.

## Listes finales

### 1. Éléments NON DÉDUCTIBLES, puis éléments RECOPIÉS

NON DÉDUCTIBLES : aucun. Chaque question qui applique une règle à un cas nouveau s'appuie sur une règle écrite dans le texte, et aucune réponse ne dépend d'un outil interactif ou d'une image sans description.

RECOPIÉS (19) : B02-R9, B02-Q1, B02-Q3, B02-Q8, B02-DE1, B02-DE6, B02-DE3, B02-DE7, B02-DE5, B02-K1, B02-K2, B02-K3, B02-K4, B02-K5, B02-K6, B02-K7, B02-K12, B02-K11, B02-K10.

### 2. Mots ou notions employés par les questions et jamais définis par le texte

- undefined (B02-Q8, PR2-5) : seulement expliqué en situation (« ce n'est pas une erreur, la ligne ne calcule rien à montrer »), jamais défini comme valeur de JavaScript.
- « fait » (B02-Q6, B02-DE1, B02-DT1) : décrit à l'ET4 (« la condition la plus simple est un seul fait »), mais absent des Mots du bloc ; la règle du doublement des lignes est écrite avec « condition », la question l'emploie avec « fait ».
- « corrigé » et « sans aide » (PR2-5) : employés comme critère de réussite, jamais définis.
- Aucun terme technique (opérateur, branche, valeur limite, égalité stricte, OU exclusif, etc.) employé dans les questions ne manque de définition ; les autres mots (résident, abonné, défectueux, personnalisé, demi-tarif, code de secours) sont du vocabulaire courant que les questions situent elles-mêmes.

### 3. Passages qui renvoient à autre chose que la fiche

- ET1 : la partie « La machine » et ses quatre blocs ; le bloc précédent « L'information en bits » (prérequis), les blocs suivants « L'ordinateur et ses composants » et « Du langage machine aux langages de haut niveau » ; le métier de développeur web.
- ET1 et ET10 : le contenu « Replié sous « Ce qui sera vérifié » » et la preuve « Aisance ».
- ET4 : George Boole et son algèbre au XIXᵉ siècle.
- ET5 : « Le processeur [...] portes logiques : c'est le bloc suivant ».
- ET8 : le SI imbriqué, « Ce bloc n'en a pas besoin ».
- ET9 : la table JavaScript « te sera redonnée chaque fois qu'une question transcrit » ; les langages plus anciens et PHP ; « Tu croiseras aussi == [...] on s'en passe ici » ; les réglages de Safari.
- ET11 : séries à refaire « trois jours différents », « reviens ici les jours suivants », les « Cinq preuves » du bloc (jamais listées).
- ET12 : « avec les mots du cours » ; « Cette liste te sera redonnée » ; « La suite » (bloc suivant sur les composants, puis les langages) ; « À explorer plus tard » : xor en PHP, lois de De Morgan, SI imbriqué, switch, condition ? a : b, ==.
- ET13 : correction « à la fin de la série » ; ET15 : « les erreurs critiques du bloc » et l'état « À reprendre », jamais détaillés dans la fiche. La numérotation saute de ET13 à ET15 (pas d'ET14).
