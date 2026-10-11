# Janus sur le VPS partage

Cette configuration utilise le Nginx deja en service, avec Caddy en HTTP sur
`127.0.0.1:3300`. PostgreSQL reste dans le reseau Docker du projet `janus`.

- Application : `https://janus.akiksystems.fr`.
- Alias avec redirection : `https://janus.akiksystems.com`.
- Fiches sur une origine distincte : `https://fiches.janus.akiksystems.fr`.
- Checkout root : `/var/www/janus`, branche de production `main`.
- Configuration root : `/etc/janus/compose.yml`, `/etc/janus/Caddyfile`.
- Secrets root, mode 0600 : `/etc/janus/janus.env`.
- Images : `janus-api:<SHA complet>` et `janus-web:<SHA complet>`.

## Installation et premiere publication

Les scripts `deployer.sh`, `ssh.sh` et `sauvegarder.sh` doivent etre audites puis
installes par un administrateur sous `/usr/local/bin/janus-deploy`,
`/usr/local/bin/janus-deploy-ssh` et `/usr/local/bin/janus-backup`, en root:root 0755.
Seules ces copies administratives sont executees. Le checkout ne fournit jamais
le script privilegie au moment du deploiement.

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
PostgreSQL et les cles VAPID sont generes lors de l'installation ; le contact est
`mailto:thedonkami@gmail.com`. Ne pas les mettre dans le depot.

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
- Variable `VPS_HOTE` : `79.137.34.84`.
- Variable `VPS_PORT` : `4242`.
- Variable `VPS_UTILISATEUR` : `janus-deploy`.
- Variable `VPS_KNOWN_HOSTS` : ligne ed25519 avec `[79.137.34.84]:4242`,
  verifiee contre la cle d'hote locale du serveur.

La cle privee ne doit pas etre affichee dans les journaux ou une conversation.
Activer le workflow seulement apres validation de la premiere publication.

## Sauvegardes locales et retour arriere

`janus-backup` conserve un dump PostgreSQL au format custom et une archive des
fiches dans un nouveau dossier `/var/backups/janus/sauvegarde-*`, avec SHA-256 et
SHA de release. Il suspend brievement l'API pour garantir leur coherence et un
trap redemarre l'API en cas de succes ou d'echec. Les fichiers sont prives ; il
n'y a aucun nettoyage automatique des anciennes sauvegardes.

Avant activation du timer quotidien a 03:00 Europe/Paris, executer une sauvegarde
et valider sa restauration dans un PostgreSQL isole, puis verifier les checksums
et le contenu des fiches. Le timer ne s'active pas automatiquement dans cette PR.
Ces copies sont locales : la perte du VPS entrainerait aussi leur perte.

Le deploiement suivant sauvegarde avant bascule. Si les controles echouent,
il relance les images precedentes et verifie leur sante ; le job reste en echec.
Les mises a jour touchant les migrations ou leur execution sont refusees avant
toute bascule. Elles exigent une validation isolee de la migration et une procedure
de retour arriere adaptee. Revenir a une image precedente ne restaure pas le schema.

La restauration destructive de la base n'est jamais automatique. La procedure
exacte doit etre eprouvee sur la premiere sauvegarde avant l'activation.
