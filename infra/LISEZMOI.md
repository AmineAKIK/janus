# Héberger Janus sur un VPS

Tout est dans ce dossier. Sur un autre serveur, il suffit de refaire les étapes ci-dessous.
`DOMAINE` désigne votre domaine (exemple : `exemple.fr`) : l'appli est sur `app.<DOMAINE>`, les
fiches sur `fiches.<DOMAINE>`.

## 1. Préparer le VPS

1. Créez un VPS Debian ou Ubuntu récent et mettez votre **clé SSH** dessus.
2. Coupez la connexion par mot de passe : dans `/etc/ssh/sshd_config`, `PasswordAuthentication no`
   et `PermitRootLogin prohibit-password`, puis `systemctl restart ssh`.
3. Pare-feu : seulement SSH, 80 et 443.
   ```sh
   ufw default deny incoming
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```
4. Mises à jour de sécurité automatiques : `apt install unattended-upgrades`, puis
   `dpkg-reconfigure -plow unattended-upgrades`.
5. Installez Docker et son plugin Compose en suivant https://docs.docker.com/engine/install/ .
6. Récupérez le dépôt : `git clone https://github.com/AmineAKIK/janus.git && cd janus/infra`.

## 2. Les enregistrements DNS

Chez le gestionnaire du domaine, deux enregistrements `A` (et `AAAA` si le VPS a une adresse IPv6)
vers l'adresse du VPS : `app.<DOMAINE>` et `fiches.<DOMAINE>`. Caddy obtient seul les certificats
HTTPS dès que les noms pointent vers le serveur.

## 3. Le fichier `.env`

`cp .env.exemple .env`, puis remplissez chaque variable. Ce fichier n'est jamais dans git.

| Variable                                     | Rôle                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DOMAINE`                                    | Le domaine, sans `app.` ni `https://`.                                                                      |
| `POSTGRES_PASSWORD`                          | Mot de passe du rôle propriétaire de la base. Lettres et chiffres seulement (`openssl rand -hex 24`).       |
| `JANUS_APP_MOT_DE_PASSE`                     | Mot de passe du rôle de l'API, posé sur la base à chaque démarrage. Même forme.                             |
| `DEEPSEEK_API_KEY`                           | La clé du correcteur IA.                                                                                    |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`      | Les clés des notifications. Génération : `npx web-push generate-vapid-keys`.                                |
| `VAPID_SUJET`                                | Un contact, au format `mailto:vous@exemple.fr`.                                                             |
| `RESTIC_REPOSITORY`                          | Où vont les sauvegardes, par exemple `s3:https://s3.eu-west-1.amazonaws.com/mon-seau/janus`.                |
| `RESTIC_PASSWORD`                            | Chiffre les sauvegardes. Gardez-le **aussi ailleurs que sur le serveur** : sans lui, elles sont illisibles. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Les accès au stockage objet.                                                                                |
| `HEURE_SAUVEGARDE` (facultative)             | Heure de la sauvegarde, `03:00` par défaut (fuseau du serveur).                                             |

## 4. Démarrer

```sh
docker compose up -d --build
docker compose ps        # les quatre services doivent être « Up », api « healthy »
curl https://app.<DOMAINE>/api/sante
```

Au démarrage, l'API applique les migrations avec le rôle propriétaire. Si une migration échoue, elle
s'arrête avec l'erreur (`docker compose logs api`) et rien n'est servi : corrigez, puis relancez.
Pour revenir en arrière, redéployez le commit précédent (`git checkout <commit>` puis
`docker compose up -d --build`).

## 5. Créer le compte

```sh
docker compose exec api node src/cli/compteCli.ts <nom>
```

Deux mots de passe sont demandés (ils ne s'affichent pas).

## 6. Importer le catalogue et les fiches

Les fiches sont écrites dans le volume `fiches`, que Caddy sert sur `fiches.<DOMAINE>`. Copiez les
fichiers dans le conteneur, puis importez :

```sh
docker compose cp catalogue.json api:/tmp/catalogue.json
docker compose exec api node src/cli/importerCatalogue.ts /tmp/catalogue.json
docker compose cp fiche-b01.html api:/tmp/fiche-b01.html
docker compose exec api node src/cli/importerFiche.ts /tmp/fiche-b01.html
```

Chaque commande liste les problèmes trouvés et sort en erreur si l'import est refusé.

## 7. Les sauvegardes

Le service `sauvegarde` exporte la base chaque nuit (`pg_dump`), la chiffre et l'envoie par restic
vers le stockage objet. Il garde 7 sauvegardes quotidiennes, 4 hebdomadaires et 12 mensuelles.

- Lancer une sauvegarde maintenant : `docker compose exec sauvegarde sauvegarder.sh`
- Voir les sauvegardes : `docker compose exec sauvegarde restic snapshots`
- **Vérifier qu'on sait restaurer** (à faire après la première sauvegarde, puis de temps en temps) :
  ```sh
  docker compose exec sauvegarde essai-restauration.sh
  ```
  Le script restaure la dernière sauvegarde dans une base vide temporaire, compare les migrations
  avec la base en service, puis supprime la base temporaire. Elle ne touche pas à la vraie base.

### Restaurer pour de vrai (base perdue)

1. Arrêtez l'API : `docker compose stop api`.
2. Videz et recréez la base :
   ```sh
   docker compose exec postgres psql -U janus -d postgres -c 'DROP DATABASE janus WITH (FORCE)' -c 'CREATE DATABASE janus'
   ```
3. Restaurez la dernière sauvegarde (ou donnez un identifiant à la place de `latest`) :
   ```sh
   docker compose exec sauvegarde sh -c 'restic dump latest janus.dump | pg_restore --no-owner --dbname "$DATABASE_URL_PROPRIETAIRE"'
   ```
4. Relancez l'API : `docker compose start api`. Elle rejoue les migrations manquantes et repose le
   mot de passe du rôle de l'API.

Les fiches (volume `fiches`) ne sont pas dans la sauvegarde : réimportez-les depuis leurs fichiers
sources.

## 8. Déployer depuis GitHub

Le workflow **Déployer** (onglet Actions, bouton « Run workflow », ou en poussant une étiquette `v*`
comme `v1.0.0`) construit les trois images, les publie sur `ghcr.io/amineakik/janus-*`, puis se
connecte au VPS en SSH, met le dépôt sur le bon commit, lance `docker compose pull` et `up -d`, et
attend jusqu'à 60 secondes que `https://app.<DOMAINE>/api/sante` réponde 200. Sinon, le workflow est
rouge et les derniers journaux de l'API s'affichent dans l'étape.

À préparer une fois :

1. **Les secrets** du dépôt (Settings, Secrets and variables, Actions) : `VPS_HOTE` (adresse du
   serveur), `VPS_UTILISATEUR` (l'utilisateur SSH, membre du groupe `docker`) et `VPS_CLE_SSH`
   (la clé privée dédiée au déploiement ; sa clé publique va dans `~/.ssh/authorized_keys` du VPS).
2. **Le dépôt sur le VPS**, dans `~/janus` (étape 1.6), avec son `infra/.env`.
3. **Le droit de télécharger les images** : soit rendre les paquets `janus-api`, `janus-caddy` et
   `janus-sauvegarde` publics (GitHub, onglet Packages), soit se connecter une fois sur le VPS avec
   un jeton `read:packages` : `docker login ghcr.io -u <utilisateur>`.
4. Facultatif : la variable de dépôt `SENTRY_DSN` (ci-dessous), écrite dans le front à la construction.

Le déploiement redémarre les conteneurs : il y a une courte interruption (pas de déploiement sans
coupure).

## 9. Suivre les erreurs (facultatif)

Sans configuration, rien n'est envoyé. Pour recevoir les erreurs inattendues, créez un projet chez
Sentry (formule gratuite) ou sur un GlitchTip auto-hébergé, puis :

- `.env` du VPS : `SENTRY_DSN` (l'adresse du projet) et `SENTRY_ORIGINE` (son origine, par exemple
  `https://o123.ingest.sentry.io`), pour l'API et pour la politique de sécurité du front ;
- variable de dépôt GitHub `SENTRY_DSN` (la même adresse), pour que le front l'ait à sa construction.

L'API envoie le type, la pile, la méthode et le modèle de route. Le front envoie le type et la pile.
Jamais le message de l'erreur, une réponse ou un texte saisi.

## 10. Surveiller de l'extérieur

Un service gratuit au choix (UptimeRobot, Better Stack, Healthchecks.io, etc.) peut interroger
`https://app.<DOMAINE>/api/sante` toutes les 5 minutes et vous écrire s'il n'obtient pas 200. Cette
adresse répond 200 seulement si la base répond : c'est la bonne sonde. Créez-la une fois le domaine en
service, avec votre adresse e-mail comme destinataire.
