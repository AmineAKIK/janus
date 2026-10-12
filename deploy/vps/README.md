# Janus sur le VPS partage

Cette configuration utilise le Nginx deja en service, avec Caddy en HTTP sur
`127.0.0.1:3300`. PostgreSQL reste dans le reseau Docker du projet `janus`.

- Application : `https://janus.akiksystems.fr`.
- Alias avec redirection : `https://janus.akiksystems.com`.
- Fiches sur une origine distincte : `https://fiches.janus.akiksystems.fr`.
- Checkout root : `/var/www/janus`, branche de production `main`.
- Configuration root : `/etc/janus/compose.yml` (copie du depot, validee et reinstallee
  par chaque deploiement). Le `Caddyfile` fait partie de l'image `janus-web` : il suit le SHA deploye.
- Secrets root, mode 0600 : `/etc/janus/janus.env` (modele : `janus.env.exemple`).
- Images : `janus-api:<SHA complet>` et `janus-web:<SHA complet>`.

## Installation et premiere publication

Les scripts `deployer.sh`, `ssh.sh`, `sauvegarder.sh` et `restaurer.sh` doivent etre audites puis
installes par un administrateur sous `/usr/local/bin/janus-deploy`,
`/usr/local/bin/janus-deploy-ssh`, `/usr/local/bin/janus-backup` et
`/usr/local/bin/janus-restore`, en root:root 0755. Seules ces copies administratives sont
executees (elles ne sont pas mises a jour par un deploiement : apres un changement de ces
scripts dans le depot, les recopier). Le checkout ne fournit jamais le script privilegie au
moment du deploiement.

Dossiers a creer une fois : `/etc/janus` (0755), `/var/lib/janus-deploy` et `/var/backups/janus`
(0700). Copier `compose.yml` dans `/etc/janus/`, creer `janus.env` (0600) d'apres
`janus.env.exemple`, cloner le depot dans `/var/www/janus`.

Cles VAPID : `npx web-push generate-vapid-keys`. L'API refuse de demarrer avec des cles
inutilisables. Variables facultatives (journal, modele de correction, suivi d'erreurs) : voir
`janus.env.exemple`.

Le compte `janus-deploy` n'est pas membre du groupe Docker. Sa regle sudo est :

```sudoers
janus-deploy ALL=(root) NOPASSWD: /usr/local/bin/janus-deploy *
```

Cette variante convient a sudo 1.9.9. La commande root valide exactement un SHA
de 40 caracteres hexadecimaux minuscules. Verifier la regle avec `visudo -cf`.
La cle publique dediee est installee dans `authorized_keys` avec
`command="/usr/local/bin/janus-deploy-ssh",restrict`. Le compte doit figurer
dans la directive SSH `AllowUsers` existante. Tester `sshd -t`, recharger SSH et
verifier une nouvelle connexion administrative.

Creer les trois DNS A vers le VPS puis obtenir un certificat couvrant les trois
noms. Auditer et tester le vhost Nginx avant activation ; `nginx.conf.example`
suppose ce certificat deja present. L'automatisation ne modifie jamais Nginx.

Renseigner la cle DeepSeek directement dans le fichier protege. Les mots de passe
PostgreSQL et les cles VAPID sont generes lors de l'installation ; le contact (`VAPID_SUJET`, de la forme
`mailto:<adresse>`) se renseigne dans le meme fichier. Ne rien de cela dans le depot.

Apres CI verte, effectuer la premiere publication manuelle :

```sh
sudo /usr/local/bin/janus-deploy <SHA_COMPLET_VALIDE_SUR_MAIN>
```

Verifier les services, `/api/sante`, les assets, les cookies HTTPS, les origines
des fiches, les connexions et les parcours dans un navigateur. Creer le premier
compte via la CLI interactive existante ; le catalogue et les fiches peuvent
etre importes progressivement. Une application sans compte ni catalogue n'est
pas une recette fonctionnelle complete.

## GitHub Actions

Mettre `main` comme branche par defaut : le workflow `workflow_run` doit y etre
present. Il recoit uniquement une CI reussie issue d'un push sur `main`, puis
transmet son SHA exact au wrapper SSH. Le script refuse les SHA hors `main` et
ignore les anciennes CI qui arriveraient apres une version plus recente.

Dans l'environnement GitHub `production`, creer :

- Secret `VPS_CLE_SSH` : cle privee dediee Janus.
- Variable `VPS_HOTE` : l'adresse du VPS.
- Variable `VPS_PORT` : le port SSH du serveur.
- Variable `VPS_UTILISATEUR` : `janus-deploy`.
- Variable `VPS_KNOWN_HOSTS` : ligne ed25519 avec `[<adresse>]:<port>`,
  verifiee contre la cle d'hote locale du serveur.

La cle privee ne doit pas etre affichee dans les journaux ou une conversation.
Activer le workflow seulement apres validation de la premiere publication.

## Migrations et retour arriere

Le deploiement applique les migrations (l'API les lance au demarrage). Quand le depot en
contient de nouvelles :

1. une sauvegarde verifiee est prise avant la bascule (obligatoire, sinon le deploiement s'arrete) ;
2. la nouvelle version demarre et migre ;
3. si les controles echouent, `janus-restore` remet la base et les fiches de cette sauvegarde,
   puis les images precedentes sont relancees et verifiees. Le journal (`logger -t janus-deploy`)
   dit `migration=1` et `Rollback verifie`.

Si la restauration elle-meme echoue, l'ancienne version n'est pas relancee et le journal dit
`intervention necessaire` : restaurer a la main (ci-dessous). Ecrire de preference des
migrations qui laissent l'ancienne image compatible (ajouter avant de retirer).

Chaque deploiement valide aussi `compose.yml` (`docker compose config`) et le Caddyfile de
l'image (`caddy validate`) avant de basculer, installe le nouveau `compose.yml`, garde l'ancien
(`compose.yml.precedent`) pour le retour arriere, puis ne conserve que l'image en service et la
precedente (les autres images et le cache de construction de plus de 7 jours sont supprimes).

## Sauvegardes

`janus-backup` (timer quotidien a 03:00 Europe/Paris, et avant chaque deploiement) ecrit dans
`/var/backups/janus/sauvegarde-*` un dump PostgreSQL au format custom, l'archive des fiches,
`SHA256SUMS` et le SHA de release. L'API est suspendue brievement pour garder base et fiches
coherentes ; un trap la relance. Le marqueur `PARTIELLE` reste dans un dossier tant que la
sauvegarde n'est pas verifiee.

Retention : 14 jours, et les 3 plus recentes ne sont jamais supprimees. Une sauvegarde interrompue
depuis plus d'un jour est retiree. Le deploiement, la sauvegarde et la restauration partagent
`/run/lock/janus.lock` : ils s'attendent au lieu de se couper l'un l'autre.

Installer le timer :

```sh
sudo cp janus-backup.service janus-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now janus-backup.timer
systemctl list-timers janus-backup.timer
```

Ces copies sont locales : la perte du VPS entrainerait aussi leur perte. Une copie chiffree hors
du VPS (restic ou rclone vers un stockage objet, mot de passe hors du VPS) reste a decider.

## Restauration

```sh
sudo /usr/local/bin/janus-restore /var/backups/janus/sauvegarde-<date> --confirmer
```

Verifie les SHA-256, recree la base `janus` (le role `janus_app` est cree s'il manque), rejoue le
dump, controle l'historique des migrations, remet les fiches, et laisse l'API arretee. La relancer :
`sudo /usr/local/bin/janus-deploy <SHA>` (ou `docker compose -p janus -f /etc/janus/compose.yml
--env-file /etc/janus/janus.env up -d api web` avec `JANUS_SHA` du fichier `release-sha`).
Cette procedure est essayee a chaque CI sur une machine vide (`essai-hebergement.sh`). A refaire a
la main chaque mois sur une base d'essai.

## Suivi d'erreurs

Renseigner `SENTRY_DSN` (API et front, fixe a la construction) et `SENTRY_ORIGINE` (l'origine du
service, ex. `https://o123.ingest.sentry.io`, autorisee par la politique de securite du front)
dans `janus.env`, puis deployer. Sans DSN, rien n'est envoye.

## Ce qui est volontairement tel quel

- Les domaines sont ecrits en dur (`Caddyfile`, `deployer.sh`) : un seul VPS partage.
- Les fiches hors ligne en production reposent sur le cache HTTP du navigateur (`immutable`, un an) :
  elles sont servies par un autre sous-domaine que celui du service worker.
- La sonde de disponibilite externe n'est pas configuree ; `/api/sante` (base) existe.
