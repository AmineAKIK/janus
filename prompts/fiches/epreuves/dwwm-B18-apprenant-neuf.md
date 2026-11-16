PR1-1 : déductible (ET6, « Primaire ou secondaire » et « Le CERT-FR est la source primaire de ses avis », ET6 « Recouper ») : annonce php.net par l'équipe de PHP = primaire ; billet de blog qui commente = secondaire ; avis publié sur le site du CERT-FR = primaire ; forum qui recopie un avis = secondaire (relais, forum).
PR1-4 : déductible (ET7, « Un numéro pour une faille » ; la réponse se lit aussi dans l'extrait de la question) : CVE-2026-13312.
PR1-3 : déductible (ET7, « Avis, alerte, actualité ») : un bulletin d'actualité, car il liste les vulnérabilités de la semaine et renvoie vers les avis.
PR1-5 : déductible (ET8, « Citer sans source ni date ») : la première phrase, qui donne l'émetteur (la CNIL), l'adresse, la date de publication (9 novembre 2026) et la date de consultation (16 novembre 2026).
PR1-7 : RECOPIÉE (ET13 « À retenir », ligne « Les sigles » ; aussi ET5 « Le CERT-FR et la CNIL » et ET7) : Really Simple Syndication = RSS ; Common Vulnerabilities and Exposures = CVE ; Commission nationale de l'informatique et des libertés = CNIL ; French Computer Emergency Response Team = CERT-FR ; Mozilla Developer Network = MDN.
PR1-2 : déductible (ET6, « Un blog n'est pas une source officielle ») : non, ce n'est pas une source officielle ; une page qui cite la CNIL parle d'elle, elle n'est pas publiée par la CNIL.
PR1-6 : déductible (ET9, « Adopter, tester ou ignorer » : « une version expérimentale utile plus tard se teste sur une copie ») : tester la version sur une copie de son site, sans toucher au site réel.
B18-R1 : déductible (ET4, « Un fichier à une adresse » et « Trouver l'adresse du flux ») : elle colle l'adresse (URL) du fichier du flux, pas celle de la page d'accueil ; elle la trouve par un lien ou une icône RSS sur le site, par la balise link rel="alternate" de l'en-tête (Ctrl+U), ou par une page du site qui liste ses flux.
B18-R2 : déductible (ET6, « Primaire ou secondaire » et « Les quatre critères ») : source secondaire (un relais qui reprend MDN, sans date ni lien) ; pour vérifier, elle remonte à la source primaire (la page de MDN), regarde l'émetteur, la date, la référence ou la version, et recoupe avec un autre émetteur.
B18-R3 : déductible (ET5, « Le CERT-FR et la CNIL ») : (a) chez le CERT-FR, dans un avis qui donne les systèmes affectés et les versions ; (b) chez la CNIL, sur cnil.fr, qui publie ses actualités, règles et sanctions.
B18-R4 : déductible (ET7, « Avis, alerte, actualité » et « Un numéro pour une faille ») : l'avis (AVI) donne les systèmes affectés, le risque et la solution, ce que le bulletin ne dit pas ; en cherchant le CVE, on retrouve tous les documents sur la même faille (avis, alertes, annonce de l'éditeur) et on peut les recouper.
B18-R5 : déductible (ET8, « Ce que porte une fiche ») : date de publication 11 novembre 2026 et date de consultation 16 novembre 2026 ; la date de publication dit l'âge de l'information.
B18-R6 : déductible (ET9, « Cinq questions pour une nouveauté » et « Adopter, tester ou ignorer ») : statut, date, compatibilité, recoupement, impact ; décision la plus probable : adopter (version stable, de l'éditeur, qui touche son projet), si la compatibilité et le recoupement sont bons.
B18-Q1 : déductible (ET4, « Un fichier à une adresse ») : il ajoute l'adresse du fichier du flux du blog ; c'est l'agrégateur qui interroge le site par HTTP à intervalles réguliers, le blog ne prévient personne.
B18-Q2 : déductible (ET6, « Un blog n'est pas une source officielle ») : il a tort ; « officielle » dit au nom de qui la page parle, pas si elle est bien écrite ; la meilleure source sur la CNIL est cnil.fr, dont l'émetteur est la CNIL.
B18-Q3 : déductible (ET7, « Avis, alerte, actualité ») : non, ALE est une alerte, pas un bulletin ; elle prévient d'un danger immédiat (faille exploitée) et se lit sans attendre, avant les avis et les bulletins.
B18-Q4 : déductible (ET8, « Citer sans source ni date ») : l'émetteur (le CERT-FR), l'adresse de la page, la date de publication (13 novembre 2026) et la date de consultation (16 novembre 2026).
B18-Q5 : déductible (ET9, « Adopter, tester ou ignorer ») : elle teste la préversion sur une copie, sans toucher à son site réel, car elle est expérimentale et utile plus tard.
B18-Q6 : déductible (ET10, « Quand la veille ne répond pas ») : il manque par exemple les versions et l'environnement, le message d'erreur exact, le code minimal (aussi : titre précis, résultat attendu, ce qui a été essayé).
B18-C1 : déductible (ET6, « Un blog n'est pas une source officielle ») : non ; un blog personnel n'est pas officiel même quand il cite le CERT-FR ; l'émetteur est Théo, pas le CERT-FR ; la source officielle est la page publiée par le CERT-FR.
B18-C2 : déductible (ET8, « Citer sans source ni date ») : il manque l'adresse de la page et la date de consultation (l'émetteur et la date de publication sont déjà là) ; sans elles le lecteur ne retrouve pas la page et ne sait pas si elle a changé depuis.
B18-C3 : déductible (ET7, « Avis, alerte, actualité ») : c'est faux, car le bulletin informe et renvoie vers les avis ; c'est l'avis qui dit les systèmes affectés et la mesure à appliquer.
B18-X1 : déductible (ET7, exemple de l'alerte ALE-014 : dates données, calcul simple) : 6 jours (du 21 au 27 octobre 2026).
B18-X2 : déductible (ET4, « Trouver l'adresse du flux ») : https://cuisine-du-lundi.example/recettes/rss.xml (la valeur de href).
B18-X3 : RECOPIÉE (ET7, « Un numéro pour une faille » ; ET13 « À retenir ») : Common Vulnerabilities and Exposures.
B18-T1 : déductible (ET6, « Un blog n'est pas une source officielle ») : Léa croit que le mot « CNIL » dans les titres rend le blog officiel ; c'est l'émetteur qui compte ; elle aurait dû citer la page publiée par la CNIL sur cnil.fr.
B18-T2 : RECOPIÉE (ET8, « Citer sans source ni date », dernière phrase du paragraphe) : la date de publication reste le 11 novembre 2026 ; la date de consultation devient le 16 novembre 2026.
B18-T3 : déductible (ET7, « Avis, alerte, actualité ») : une alerte se lit sans attendre, avant les avis et les bulletins ; elle ne doit pas attendre le bulletin de la semaine.
B18-T4 : déductible (ET7, « Lire un avis », « antérieures à ») : 8.3.30 est plus ancienne que 8.3.36, donc affectée ; elle doit lire l'avis (le bulletin renvoie vers les avis), suivre le renvoi vers l'éditeur sur php.net, et passer à 8.3.36 ; elle n'est alors plus dans « antérieures à 8.3.36 », donc plus affectée (conclusion tirée de la lecture de « antérieures », jamais écrite telle quelle).
B18-K1 : RECOPIÉE (ET4, « Un fichier à une adresse ») : un fichier publié à une URL qui liste les derniers éléments (titre, lien, date) ; l'agrégateur le redemande à intervalles réguliers par HTTP, le site ne prévient personne.
B18-K2 : RECOPIÉE (ET4, « Trouver l'adresse du flux ») : lien ou icône RSS (souvent en bas de page), balise link de l'en-tête (Ctrl+U), ou page du site qui liste ses flux.
B18-K3 : RECOPIÉE (ET5, tableau « Les cinq flux de Jade » ; ET12) : MDN, php.net, CERT-FR, VS Code, CNIL.
B18-K4 : déductible (ET6, « Primaire ou secondaire ») : une source primaire est émise par l'organisme qui produit l'information ; son article, qui résume l'annonce de php.net, est une source secondaire ; pour citer, il remonte à php.net.
B18-K5 : RECOPIÉE (ET6, « Les quatre critères ») : l'émetteur, la date, la référence ou la version, le recoupement.
B18-K6 : RECOPIÉE (ET7, « Un numéro pour une faille ») : une faille publique, de façon unique ; le même numéro dans deux documents désigne la même faille.
B18-K7 : RECOPIÉE (ET8, « Ce que porte une fiche » ; ET13) : titre de la page, émetteur, adresse, date de publication, date de consultation, résumé en deux phrases, conséquence pour le projet.
B18-K8 : RECOPIÉE (ET9, « Cinq questions pour une nouveauté ») : statut, date, compatibilité, recoupement, impact.
B18-K9 : RECOPIÉE (ET10, « Quand la veille ne répond pas ») : titre précis, versions et environnement, code minimal, résultat attendu, résultat obtenu avec le message d'erreur exact, ce qui a été essayé.
B18-K10 : RECOPIÉE (ET5, « Le CERT-FR et la CNIL » ; ET13) : le CERT-FR suit les failles et incidents informatiques et publie des avis, alertes et bulletins ; la CNIL protège les données personnelles et publie ses actualités, règles et sanctions.

## Les quatre listes

1. Éléments NON DÉDUCTIBLES : aucun. Seule réserve : B18-T4 demande ce que devient la situation après 8.3.36 ; je l'ai conclu de « antérieures à 8.3.36 », mais le texte n'écrit jamais que la version corrigée n'est plus affectée. B18-X1 suppose une soustraction de dates que le texte ne montre pas.
   Éléments RECOPIÉS (12) : PR1-7, B18-X3, B18-T2, B18-K1, B18-K2, B18-K3, B18-K5, B18-K6, B18-K7, B18-K8, B18-K9, B18-K10. Ce sont des questions de rappel pur, dont la réponse est écrite telle quelle (ET4, ET5, ET6, ET7, ET8, ET9, ET10, ET13 « À retenir »). B18-R1 et B18-R4 sont très proches du texte mais appliquées à un cas, donc je les ai laissées déductibles.
2. Mots employés par les questions que le texte ne définit pas, ou seulement dans la question elle-même :
   - « sigle » : défini seulement dans le « Pour lire » de PR1-7 et B18-X3, jamais dans l'explication.
   - « préversion » (Q5) : défini seulement entre parenthèses dans la question ; le texte parle de « version candidate » et « expérimentale ».
   - « compatibilité » : seulement glosé comme « marche-t-elle avec ton projet ».
   - « recoupement » est défini, mais « environnement » et « code minimal » le sont à peine (une parenthèse).
   - « systèmes affectés » : jamais défini formellement (compris par l'exemple de l'avis).
   - « exploitée » : défini en passant (« ils s'en servent ») dans ET7 et dans la question.
   - « Pinceau » (Q5) : produit inventé, jamais présenté (ET9 l'utilise sans dire ce que c'est).

3. Passages qui renvoient à autre chose que la fiche :
   - ET2 : « Ce bloc est le dernier de la partie « Le cadre du métier ». Tu y as appris à reconnaître les menaces… » (autres blocs) ; « Ce que tu lis dans une veille nourrit les autres blocs ».
   - ET2 : « l'atelier te dit quoi noter à la place » (autre partie).
   - « Replié sous « Ce qui sera vérifié » » (ET2 et ET11) ; « plus bas, dans « Ce qu'on te demande », partie Pratique / Restitution » (ET11, ET14).
   - ET12 : sites externes inoreader.com et cert.cyber.gouv.fr/flux-rss ; php -v sur la machine.
   - ET13 « La suite » : « À explorer plus tard » (autres flux du CERT-FR, newsletters, notes de version en détail) ; « À l'écran suivant, tu en remplis une pour un autre cas ».
   - ET15 Bilan : « erreurs critiques du bloc » cochées par « la page ».
   - ET5 : « celle du CERT-FR se copie sur sa page des flux » (renvoi à un site, adresse jamais donnée dans le tableau).

4. Passages qui parlent de la fiche au lieu de me parler :
   - « Regarde seulement ce qu'elle fait : tu n'as rien à retenir ici » ; « Toujours seulement un regard : tu n'as rien à retenir encore ».
   - « Essaie avec ton bon sens. Personne ne te note : réponds comme tu penses ».
   - Les étiquettes « Pour lire : » partout ; « Ce qui sera vérifié » ; « Tu es ici : … ».
   - Les marqueurs de gabarit non résolus : « [seulement si l'essai p1 est faux] … [la réponse à l'essai p1] », idem p2 et p3 (ET6, ET8, ET7).
   - « Ce schéma montre un seul chemin… Il ne dit pas encore comment juger une source » ; « Cette chaîne montre un seul cas… » (ET2, ET9, ET13).
   - « Voici de nouveau la question de ton pari, posée au début du bloc » ; « Ton pari, repris / corrigé ».
   - « Essaie d'abord seul, jusqu'à avoir fait un geste… les coups de pouce viennent après » ; « Ton constat. La page ne voit pas ta machine » ; « L'aide que tu as prise » ; ET14 (« Elle se fait sans le cours… masqué… corrigées à la fin de la série »).
   - Les numéros d'étapes ET1 à ET15 que je ne vois pas dans la fiche elle-même (utilisés ici seulement pour citer).
   - Incohérence relevée : « Ce qui sera vérifié » parle de « blog de la CNIL » comme source primaire, alors que ET6 dit qu'un blog n'est pas officiel et qu'on prend les actualités sur cnil.fr.
