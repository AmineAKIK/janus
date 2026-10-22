# B02 : réponses de l'apprenant neuf

## Pratique

PR1-6 : déductible (ET8, Tracer) : 17 ans, pas habitant : ligne 1 17 < 4 : FAUX ; ligne 2 17 < 18 OU FAUX : VRAI OU FAUX : VRAI ; ligne 3 pas testée ; affiche « 2 € ». 18 ans, habitant : ligne 1 18 < 4 : FAUX ; ligne 2 18 < 18 OU VRAI : FAUX OU VRAI : VRAI ; ligne 3 pas testée ; affiche « 2 € ». 60 ans, pas habitant : ligne 1 60 < 4 : FAUX ; ligne 2 60 < 18 OU FAUX : FAUX OU FAUX : FAUX ; ligne 3 60 ≥ 60 : VRAI ; affiche « 3 € ».
PR1-2 : déductible (ET6, ET avant OU et Pas à pas) : pas de parenthèses ; comparaisons : 8 < 12 vaut VRAI, 8 ≥ 65 vaut FAUX ; pas de NON ; ET d'abord : FAUX ET résident = FAUX ET FAUX = FAUX ; puis OU : VRAI OU FAUX = VRAI. Le musée est gratuit.
PR1-5 : déductible (ET7, Le ou exclusif) : Oui. C'est une condition pour avoir droit à quelque chose (un compte validé) : remplir les deux ne gêne personne, c'est le OU inclusif, le sens du OU quand rien ne dit le contraire ; VRAI OU VRAI donne VRAI.
PR1-8 : déductible (ET9, Comparer : ===) : « = range 1234 dans code au lieu de comparer, et 1234 compte comme VRAI. » La branche s'exécute donc quelle que soit la valeur de départ de code ; il faut écrire if (code === 1234).
PR1-1 : déductible (ET5, NON, ET et Quatre lignes ; ET6, ET avant OU) : on calcule NON B, puis A ET NON B. A FAUX, B FAUX : NON B VRAI, résultat FAUX. A FAUX, B VRAI : NON B FAUX, résultat FAUX. A VRAI, B FAUX : NON B VRAI, résultat VRAI. A VRAI, B VRAI : NON B FAUX, résultat FAUX.
PR1-7 : déductible (ET8, La chaîne et L'ordre des lignes) : « bas ». 95 ≥ 10 est VRAI dès la première ligne : la chaîne exécute cette branche et sort, les lignes suivantes ne sont pas testées. (La chaîne est mal ordonnée : il fallait commencer par la plus exigeante, ≥ 90.)
PR1-4 : déductible (ET7, La méthode et Les pièges du français) : (jours ≤ 30 OU défectueux) ET NON personnalisé. Le « ou » est inclusif (condition pour avoir droit au remboursement), « sauf » donne ET NON, et les parenthèses gardent le sens : sans elles, ET passerait avant OU et un article personnalisé de moins de 30 jours serait remboursé.
PR1-3 : déductible (ET6, Les parenthèses et Pas à pas) : parenthèses d'abord : connecté OU invité = FAUX OU VRAI = VRAI ; dans la seconde parenthèse, la comparaison articles = 0 : 3 = 0 vaut FAUX ; NON FAUX = VRAI ; enfin ET : VRAI ET VRAI = VRAI. Le bouton Commander s'affiche.
PR2-1 : déductible (ET8, L'ordre des lignes) : 1) points ≥ 1000 : afficher « or » ; 2) points ≥ 500 : afficher « argent » ; 3) points ≥ 100 : afficher « bronze ». On commence par la plus exigeante, celle que le moins de valeurs remplissent.
PR2-2 : déductible (ET4, Comparer ; ET8, Les valeurs limites) : 99 et 100 (pour points ≥ 100), 499 et 500 (pour points ≥ 500), 999 et 1000 (pour points ≥ 1000).
PR2-3 : déductible (ET8, Tracer) : 99 : 99 ≥ 1000 FAUX, 99 ≥ 500 FAUX, 99 ≥ 100 FAUX, SINON : « aucun ». 100 : FAUX, FAUX, 100 ≥ 100 VRAI : « bronze ». 499 : FAUX, FAUX, 499 ≥ 100 VRAI : « bronze ». 500 : FAUX, 500 ≥ 500 VRAI, ligne 3 pas testée : « argent ». 1000 : 1000 ≥ 1000 VRAI, lignes 2 et 3 pas testées : « or ».
PR2-4 : déductible (ET9, Le même code en JavaScript et Le guichet en JavaScript) : if (points >= 1000) { console.log('or') } else if (points >= 500) { console.log('argent') } else if (points >= 100) { console.log('bronze') } else { console.log('aucun') }
PR2-5 : déductible (ET9, Ouvrir la console et Prédire, puis exécuter) : prédiction écrite avant d'exécuter : pour let points = 500, la console affiche « argent », puis undefined (qui n'est pas une erreur) ; pour points = 999 (sans let, sinon « has already been declared »), elle affiche encore « argent », puis undefined. Le résultat réel ne se lit qu'en exécutant dans un navigateur.

## Restitution

B02-R11 : déductible (ET5, NON, OU et Quatre lignes) : A FAUX, B FAUX : NON B VRAI, A OU NON B VRAI. A FAUX, B VRAI : NON B FAUX, condition FAUX. A VRAI, B FAUX : NON B VRAI, condition VRAI. A VRAI, B VRAI : NON B FAUX, condition VRAI.
B02-R8 : déductible (ET6, ET avant OU et Pas à pas) : pas de parenthèses ; comparaison : 12 ≥ 10 vaut VRAI ; NON : NON absent = NON VRAI = FAUX ; ET : bonus ET FAUX = VRAI ET FAUX = FAUX ; OU : VRAI OU FAUX = VRAI. La condition vaut VRAI.
B02-R12 : déductible (ET7, Le ou exclusif) : carte OU pièce d'identité, avec le OU inclusif. C'est une condition pour avoir droit à quelque chose (emprunter) : quelqu'un qui a les deux ne gêne personne, et aucun mot (« au choix », « soit… soit… ») ne fait choisir.
B02-R4 : déductible (ET8, La chaîne) : « 0 € ». La première condition, abonné, est VRAIE : le programme exécute sa branche puis sort de la chaîne ; les conditions suivantes ne sont pas testées, et SINON ne prend que les cas où aucune n'est VRAIE. Une seule branche s'exécute.
B02-R10 : déductible (ET8, L'ordre des lignes et Les valeurs limites) : SI batterie ≥ 80 : afficher « pleine » SINON SI batterie ≥ 40 : afficher « correcte » SINON SI batterie ≥ 10 : afficher « faible » SINON : afficher « à charger ». Valeurs limites : 79 et 80, 39 et 40, 9 et 10.
B02-R13 : déductible (ET9, Les signes de JavaScript et Le guichet en JavaScript) : if (batterie === 100 && !enCharge) { console.log('débranche') }

## Rappel

B02-Q10 : déductible (ET5, ET et OU) : première appli : pluie OU vent fort = VRAI OU VRAI = VRAI, l'alerte part. Seconde : pluie ET froid = VRAI ET FAUX = FAUX, l'alerte ne part pas.
B02-Q9 : déductible (ET6, ET avant OU et Les parenthèses) : A OU B ET C : ET d'abord, B ET C = VRAI ET FAUX = FAUX, puis VRAI OU FAUX = VRAI. (A OU B) ET C : parenthèse d'abord, VRAI OU VRAI = VRAI, puis VRAI ET FAUX = FAUX.
B02-Q11 : déductible (ET8, La chaîne) : elle affiche « épuisé » ; la deuxième ligne n'est pas testée, car la chaîne sort après la première condition VRAIE (0 = 0).
B02-Q13 : déductible (ET9, Variable et égalité et Comparer : ===) : total contient 5 (ranger une autre valeur remplace l'ancienne) ; à total === 0, la console répond false.
B02-Q5 : déductible (ET4, Comparer) : note < 10 vaut FAUX, note ≤ 10 vaut VRAI (quand les deux nombres sont égaux, seuls ≤, ≥ et = donnent VRAI).
B02-Q6 : déductible (ET5, Quatre lignes) : 32 lignes, 2 × 2 × 2 × 2 × 2 : chaque fait vaut VRAI ou FAUX, et chaque fait de plus double le nombre de lignes (4 pour 2, 8 pour 3, 16 pour 4, 32 pour 5).
B02-Q14 : déductible (ET7, Le ou exclusif ; ET6, Les parenthèses) : boisson = VRAI, popcorn = VRAI. Parenthèses : boisson OU popcorn = VRAI OU VRAI = VRAI ; boisson ET popcorn = VRAI ET VRAI = VRAI. NON : NON VRAI = FAUX. ET : VRAI ET FAUX = FAUX. La condition ne l'accepte pas.
B02-Q12 : déductible (ET9, Ouvrir la console) : let prix = 12 : undefined (la ligne range, elle ne calcule rien à montrer) ; prix >= 10 : true ; après prix = 8, prix >= 10 : false.

## Tâches différées

B02-C1 : déductible (ET5, OU ; ET7, Le ou exclusif) : il confond le OU de la logique, inclusif, avec le « ou » exclusif du français (« fromage ou dessert »). Pour Lina : membre OU invité = VRAI OU VRAI = VRAI, elle entre ; et une condition pour entrer est un OU inclusif.
B02-C6 : déductible (ET6, ET avant OU et Les parenthèses) : première : comparaison 20 < 18 = FAUX ; ET : FAUX ET weekend = FAUX ET FAUX = FAUX ; OU : FAUX OU VRAI = VRAI. Seconde : parenthèse d'abord, weekend OU férié = FAUX OU VRAI = VRAI ; comparaison 20 < 18 = FAUX ; ET : FAUX ET VRAI = FAUX. Elles diffèrent parce que sans parenthèses ET passe avant OU ; les parenthèses changent l'ordre de calcul, donc le résultat.
B02-C3 : déductible (ET8, L'ordre des lignes et Les valeurs limites) : pour 100, elle affiche « ralentis » (100 > 50 est VRAI dès la première ligne, « danger » n'est jamais atteint). Correction : SI vitesse > 90, afficher « danger » ; SINON SI vitesse > 50, afficher « ralentis » ; SINON, afficher « ok ». Valeurs limites, avec > et des vitesses entières : 90 et 91, 50 et 51.
B02-C7 : déductible (ET9, Comparer : ===) : = range 20 dans note au lieu de comparer ; 20 est un nombre autre que 0, donc compte comme VRAI, et la branche s'exécute quel que soit l'ancien contenu de note. Correction : if (note === 20) { console.log('parfait') }
B02-C5 : déductible (ET7, Les pièges du français) : avec enfant ET étudiant, seuls ceux qui sont à la fois enfant et étudiant paient demi-tarif (presque personne). La bonne : enfant OU étudiant, car la phrase ajoute deux groupes de clients, et chacun a droit au demi-tarif.
B02-DE8 : déductible (ET5, Quatre lignes) : A FAUX : FAUX FAUX FAUX, FAUX FAUX VRAI, FAUX VRAI FAUX, FAUX VRAI VRAI ; A VRAI : VRAI FAUX FAUX, VRAI FAUX VRAI, VRAI VRAI FAUX, VRAI VRAI VRAI (de 000 à 111). Un quatrième fait peut valoir FAUX ou VRAI dans chacun de ces huit cas : on les écrit une fois avec lui FAUX, une fois avec lui VRAI, soit 16.
B02-DE9 : déductible (ET6, ET avant OU et Les parenthèses) : VRAI OU FAUX ET FAUX : ET d'abord, FAUX ET FAUX = FAUX, puis VRAI OU FAUX = VRAI. (VRAI OU FAUX) ET FAUX : parenthèse d'abord, VRAI OU FAUX = VRAI, puis VRAI ET FAUX = FAUX. Sans parenthèses ET a priorité sur OU ; les parenthèses imposent de faire le OU d'abord.
B02-DE10 : déductible (ET8, L'ordre des lignes) : « assez bien », car 17 ≥ 12 est VRAI dès la première ligne et la chaîne s'arrête là. On met d'abord la plus exigeante, celle que le moins de valeurs remplissent, sinon la ligne la moins exigeante attrape tout et les suivantes ne sont jamais atteintes : SI note ≥ 16 « très bien » SINON SI note ≥ 14 « bien » SINON SI note ≥ 12 « assez bien ».
B02-DE11 : déductible (ET9, Comparer : ===) : = range 3 dans essais, puis le if teste la valeur rangée, 3, un nombre autre que 0, donc VRAI : « bloqué » s'affiche dès le premier essai, et essais vaut ensuite 3. Il faut écrire if (essais === 3) { console.log('bloqué') }
B02-DE12 : déductible (ET7, Le ou exclusif) : le OU de la logique est inclusif, VRAI OU VRAI donne VRAI : jus OU soda. « au choix » fait choisir, c'est un seul des deux, le OU exclusif : (jus OU soda) ET NON (jus ET soda).
B02-DT1 : déductible (ET7, Le ou exclusif et Les pièges du français) : (a) badge OU code : OU inclusif, c'est une condition pour entrer, avoir les deux ne gêne personne. (b) (entrée OU dessert) ET NON (entrée ET dessert) : « au choix » fait choisir, un seul des deux, forme exclusive. (c) âge < 12 OU âge > 65 : un « et » qui veut dire OU, la phrase ajoute deux groupes ; avec ET il faudrait être des deux à la fois, personne.
B02-DT6 : déductible (ET7, La méthode ; ET8, Les valeurs limites) : note ≥ 10 OU (note ≥ 8 ET stage). Valeurs à tester : 7 et 8 (seuil de note ≥ 8), 9 et 10 (seuil de note ≥ 10), chacune deux fois, avec stage VRAI puis stage FAUX.
B02-DT10 : déductible (ET7, Le ou exclusif et Les pièges du français) : la première, grâce à « au choix » : achat ≥ 30 ET (gourde OU sac) ET NON (gourde ET sac). Pour la seconde, c'est une chose offerte sans mot qui fait choisir : je ne devine pas, je demande à celui qui a écrit la règle si les deux sont permis avant d'écrire le code.
B02-DT9 : déductible (ET8, L'ordre des lignes ; ET9, Le même code en JavaScript) : pour age = 8, il affiche « ado », car 8 < 18 est VRAI dès la première ligne. L'erreur : la condition la plus exigeante (age < 12) doit être testée en premier. Correction : if (age < 12) { console.log('enfant') } else if (age < 18) { console.log('ado') } else { console.log('adulte') }
B02-DT8 : déductible (ET9, Les signes de JavaScript et Comparer : ===) : if ((motDePasse === 'secret' && essais < 3) || motDePasse === 'urgence'). === compare (ici des textes entre apostrophes), < est « strictement plus petit que », && est le ET, || est le OU ; les parenthèses gardent le sens : la limite des 3 essais ne porte que sur 'secret', et 'urgence' passe même après 3 essais.

## Cartes

B02-K1 : RECOPIÉE (ET4, VRAI ou FAUX ; ET12, Les mots du bloc) : la valeur d'une condition, VRAI ou FAUX ; 1 ou 0 dans la machine, true ou false en JavaScript.
B02-K2 : RECOPIÉE (ET5, ET) : FAUX ET FAUX = FAUX ; FAUX ET VRAI = FAUX ; VRAI ET FAUX = FAUX ; VRAI ET VRAI = VRAI.
B02-K3 : RECOPIÉE (ET5, OU) : FAUX OU FAUX = FAUX ; FAUX OU VRAI = VRAI ; VRAI OU FAUX = VRAI ; VRAI OU VRAI = VRAI.
B02-K13 : déductible (ET6, ET avant OU) : B ET C, car ET a priorité sur OU.
B02-K5 : RECOPIÉE (ET7, Le ou exclusif ; ET12, Les mots du bloc) : un seul des deux est VRAI ; (A OU B) ET NON (A ET B).
B02-K6 : RECOPIÉE (ET8, La chaîne ; ET12, À retenir) : la première condition VRAIE, et elle seule, choisit la branche qui s'exécute ; SINON si aucune n'est VRAIE.
B02-K7 : RECOPIÉE (ET4, Comparer ; ET12, Les mots du bloc) : une valeur où une condition change : la dernière où elle est FAUSSE et la première où elle est VRAIE (17 et 18 pour âge ≥ 18).
B02-K14 : RECOPIÉE (ET9, Comparer : ===) : JavaScript range 18 dans age, puis teste la valeur rangée, 18, qui compte comme VRAI : la branche s'exécute à chaque fois, quel que soit l'âge de départ.
B02-K11 : RECOPIÉE (ET8, L'ordre des lignes) : que toutes les lignes du dessus, ici la première, sont FAUSSES.
B02-K10 : RECOPIÉE (ET9, Ouvrir la console ; ET12, Les mots du bloc) : dans un onglet vide, Ctrl+Maj+J dans Chrome et Edge, Ctrl+Maj+K dans Firefox, ou F12 puis l'onglet Console ; sur Mac Cmd+Option+J (Chrome), Cmd+Option+K (Firefox), Cmd+Option+C dans Safari après avoir activé les outils pour les développeurs.

## Décompte

52 éléments : 43 déductibles, 9 recopiés, 0 non déductible, 0 hors champ assumé.

## 1. Éléments NON DÉDUCTIBLES, puis RECOPIÉS

NON DÉDUCTIBLES : aucun.

RECOPIÉS :
- B02-K1 : définition du booléen écrite telle quelle (ET4 ; ET12, Les mots du bloc).
- B02-K2 : table de ET écrite telle quelle (ET5, ET).
- B02-K3 : table de OU écrite telle quelle (ET5, OU).
- B02-K5 : définition et formule du OU exclusif écrites telles quelles (ET7 ; ET12, Les mots du bloc).
- B02-K6 : « la première condition VRAIE, et elle seule, choisit ce qui s'exécute » (ET12, À retenir).
- B02-K7 : définition de la valeur limite écrite telle quelle (ET4 ; ET12).
- B02-K14 : le même cas, if (age = 18), est expliqué mot pour mot (ET9, Comparer : ===).
- B02-K11 : « toutes celles du dessus sont FAUSSES » (ET8, L'ordre des lignes).
- B02-K10 : raccourcis de la console listés tels quels (ET9, Ouvrir la console ; ET12).

À la limite : PR1-8 et B02-DE11 et B02-C7 sont le cas if (age = 18) avec un autre nombre, et la question redonne elle-même la règle ; B02-DT6 reprend l'exemple « note ≥ 8 ET stage » de ET8. Je les compte déductibles parce que la règle est écrite et que le cas est nouveau.

## 2. Mots ou notions des questions jamais définis dans le texte

- « compter en binaire » (B02-R11, B02-DE8 par l'ordre des lignes) : la fiche montre 00, 01, 10, 11 et renvoie au bloc précédent, sans l'expliquer. Ça ne bloque pas : les questions redonnent l'ordre.
- undefined (PR2-5) : la fiche dit que ce n'est pas une erreur, mais jamais ce que c'est.
- « dès », « plus de », « sous 30 jours » : la traduction des mots de seuil en <, ≤, >, ≥ n'est jamais posée en règle, seulement montrée sur des exemples (« moins de 26 ans », « plus de 50 € », « 65 ans ou plus », « à partir de »). PR1-4 précise lui-même « sous 30 jours ».
- « session » (B02-DT8), « SMS », « jauge » : mots courants, jamais définis, sans effet sur la réponse.

## 3. Passages qui renvoient hors de la fiche

- ET1, Où tu es : la partie « La machine » et ses autres blocs : « L'information en bits » (prérequis), « L'ordinateur et ses composants », « Du langage machine aux langages de haut niveau ».
- ET1 et ET10 : « Replié sous « Ce qui sera vérifié » », contenu d'interface.
- ET4, VRAI ou FAUX : George Boole et « l'algèbre » qu'il a faite, seulement nommés.
- ET5, ET et OU, à toi : « portes logiques : c'est le bloc suivant ».
- ET9, Les signes de JavaScript : « elles te seront redonnées chaque fois qu'une question transcrit en JavaScript » ; langages plus anciens, PHP.
- ET9, Comparer : === : « Tu croiseras aussi ==… on s'en passe ici ».
- ET9, Ouvrir la console : « reviens ici sur un ordinateur ».
- ET11, Vitesse : « reviens ici les jours suivants » ; la preuve « Aisance » dans les « Cinq preuves » du bloc, jamais montrées.
- ET12, À retenir : « Cette liste te sera redonnée chaque fois qu'une question calcule ».
- ET12, La suite : le bloc suivant (composants, processeur, portes logiques), « puis viendront les langages ».
- ET12, À explorer plus tard : xor en PHP, lois de De Morgan, SI imbriqué, switch, condition ? a : b, == à côté de ===.
- ET13 et ET15 : fonctionnement de la page (cours masqué, correction en fin de série, état « À reprendre ») ; la numérotation saute de ET13 à ET15 (pas d'ET14).
- Tous les [outil interactif : …] : je ne vois pas ce qu'ils montrent ; aucune réponse ci-dessus n'en dépend.
