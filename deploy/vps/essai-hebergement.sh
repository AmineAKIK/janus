#!/usr/bin/env bash
# Essai de l'hebergement du VPS sur une machine vide (CI) : memes fichiers, memes scripts, memes
# chemins que la production. Demarre la pile, verifie les en-tetes, sauvegarde, purge, restaure.
# A lancer en root depuis la racine du depot, apres la construction des images janus-api:$SHA et janus-web:$SHA.
set -Eeuo pipefail
[[ $(id -u) == 0 ]]
sha=${1:?SHA de 40 caracteres hexadecimaux}
[[ $sha =~ ^[0-9a-f]{40}$ ]]
depot=$PWD
[[ -f $depot/deploy/vps/compose.yml ]]
export JANUS_SHA=$sha
hote=(-H 'Host: janus.akiksystems.fr')
composition=(docker compose --env-file /etc/janus/janus.env -p janus -f /etc/janus/compose.yml)

echo '== Installation (comme le README)'
install -d -m 0755 /etc/janus
install -d -m 0700 /var/lib/janus-deploy /var/backups/janus
install -m 0644 deploy/vps/compose.yml /etc/janus/compose.yml
cles=$(node -e "
const c = require('node:crypto'); const e = c.createECDH('prime256v1'); e.generateKeys()
const b = (x) => x.toString('base64url')
console.log('VAPID_PUBLIC_KEY=' + b(e.getPublicKey())); console.log('VAPID_PRIVATE_KEY=' + b(e.getPrivateKey()))")
{
  echo POSTGRES_PASSWORD=essai0postgres
  echo JANUS_APP_MOT_DE_PASSE=essai0application
  echo DEEPSEEK_API_KEY=essai
  echo VAPID_SUJET=mailto:essai@exemple.fr
  echo "$cles"
} > /etc/janus/janus.env
chmod 0600 /etc/janus/janus.env
printf '%s\n' "$sha" > /var/lib/janus-deploy/current-sha

echo '== Demarrage'
"${composition[@]}" config -q
"${composition[@]}" up -d --no-build --wait --wait-timeout 120 postgres
"${composition[@]}" run --rm --no-deps -T --user root --entrypoint chown api node:node /fiches
"${composition[@]}" up -d --no-build --wait --wait-timeout 120 api web

echo '== /api/sante et la page'
curl -fsS "${hote[@]}" http://127.0.0.1:3300/api/sante >/dev/null
curl -fsS "${hote[@]}" http://127.0.0.1:3300/ >/dev/null

echo '== Les formations du depot sont publiees par le demarrage'
[[ $("${composition[@]}" exec -T postgres psql -U janus -d janus -tAc "SELECT count(*) FROM formations WHERE code = 'DWWM'") == 1 ]]

echo '== En-tetes de securite de l appli et de l executeur de code'
executeur=$(curl -fsSI "${hote[@]}" http://127.0.0.1:3300/executeur.html | tr -d '\r')
appli=$(curl -fsSI "${hote[@]}" http://127.0.0.1:3300/ | tr -d '\r')
echo "$executeur" | grep -i '^content-security-policy:' | grep -q "frame-ancestors 'self'"
echo "$executeur" | grep -i '^content-security-policy:' | grep -q "connect-src 'none'"
echo "$appli" | grep -i '^content-security-policy:' | grep -q "frame-src 'self' https://fiches.janus.akiksystems.fr"
echo "$appli" | grep -i '^content-security-policy:' | grep -q "frame-ancestors 'none'"

echo '== Un fichier d assets absent est un 404 franc, pas la page d accueil'
code=$(curl -s -o /dev/null -w '%{http_code}' "${hote[@]}" http://127.0.0.1:3300/assets/absent.js)
[[ $code == 404 ]] || { echo "attendu 404, recu $code"; exit 1; }
code=$(curl -s -o /dev/null -w '%{http_code}' "${hote[@]}" http://127.0.0.1:3300/une/route/de/lappli)
[[ $code == 200 ]] || { echo "attendu 200 pour une route de l appli, recu $code"; exit 1; }

echo '== Les fichiers de l appli sont servis en brotli quand le navigateur le sait, en gzip sinon'
asset=$(curl -fsS "${hote[@]}" http://127.0.0.1:3300/ | grep -o '/assets/index-[^"]*\.js' | head -1)
[[ -n $asset ]]
entetes_br=$(curl -fsSI "${hote[@]}" -H 'Accept-Encoding: br, gzip' "http://127.0.0.1:3300$asset" | tr -d '\r')
echo "$entetes_br" | grep -qi '^content-encoding: br$'
echo "$entetes_br" | grep -i '^vary:' | grep -qi 'accept-encoding'
echo "$entetes_br" | grep -qi '^cache-control: public, max-age=31536000, immutable$'
entetes_gz=$(curl -fsSI "${hote[@]}" -H 'Accept-Encoding: gzip' "http://127.0.0.1:3300$asset" | tr -d '\r')
echo "$entetes_gz" | grep -qi '^content-encoding: gzip$'
taille_br=$(curl -fsS -o /dev/null -w '%{size_download}' "${hote[@]}" -H 'Accept-Encoding: br' "http://127.0.0.1:3300$asset")
taille_gz=$(curl -fsS -o /dev/null -w '%{size_download}' "${hote[@]}" -H 'Accept-Encoding: gzip' "http://127.0.0.1:3300$asset")
(( taille_br < taille_gz )) || { echo "brotli ($taille_br) devrait peser moins que gzip ($taille_gz)"; exit 1; }

echo '== Sauvegarde'
"${composition[@]}" exec -T postgres psql -U janus -d janus -qc 'CREATE TABLE essai_marqueur (v text); INSERT INTO essai_marqueur VALUES (1)' >/dev/null
"${composition[@]}" run --rm --no-deps -T --user root --entrypoint sh api -c 'echo avant > /fiches/essai.txt'
# Les fiches du depot sont deja publiees dans /fiches : la restauration doit rendre ce dossier tel quel.
fiches_sauvees=$("${composition[@]}" run --rm --no-deps -T --entrypoint sh web -c 'cat /fiches/essai.txt; find /fiches | sort')
[[ $fiches_sauvees == $'avant\n'*/fiches/essai.txt* ]]
bash deploy/vps/sauvegarder.sh
sauvegarde=$(cat /var/lib/janus-deploy/derniere-sauvegarde)
[[ -f $sauvegarde/janus.dump && -f $sauvegarde/fiches.tar.gz && ! -e $sauvegarde/PARTIELLE ]]
# L'API a ete relancee par la sauvegarde : on attend qu'elle soit saine.
"${composition[@]}" up -d --no-build --wait --wait-timeout 120 api
curl -fsS "${hote[@]}" http://127.0.0.1:3300/api/sante >/dev/null

echo '== Retention : les vieilles sauvegardes partent, les 3 plus recentes restent'
for rang in 1 2 3 4 5; do
  vieille=/var/backups/janus/sauvegarde-2020010${rang}T000000Z-fausse
  mkdir "$vieille"
  touch -d '400 days ago' "$vieille"
done
mkdir /var/backups/janus/sauvegarde-20200101T000000Z-partielle
touch /var/backups/janus/sauvegarde-20200101T000000Z-partielle/PARTIELLE
touch -d '3 days ago' /var/backups/janus/sauvegarde-20200101T000000Z-partielle
bash deploy/vps/sauvegarder.sh
"${composition[@]}" up -d --no-build --wait --wait-timeout 120 api
restantes=$(find /var/backups/janus -mindepth 1 -maxdepth 1 -type d -name 'sauvegarde-*' | wc -l)
anciennes=$(find /var/backups/janus -mindepth 1 -maxdepth 1 -type d -name 'sauvegarde-2020*' | wc -l)
[[ ! -e /var/backups/janus/sauvegarde-20200101T000000Z-partielle ]] || { echo 'sauvegarde partielle gardee'; exit 1; }
((restantes >= 3 && anciennes <= 1)) || { echo "purge incorrecte: $restantes restantes dont $anciennes anciennes"; exit 1; }

echo '== Restauration dans une base abimee'
"${composition[@]}" exec -T postgres psql -U janus -d janus -qc 'DROP TABLE essai_marqueur; CREATE TABLE intrus (v text)' >/dev/null
"${composition[@]}" run --rm --no-deps -T --user root --entrypoint sh api -c 'echo apres > /fiches/essai.txt; echo x > /fiches/intrus.txt'
bash deploy/vps/restaurer.sh "$sauvegarde" --confirmer
[[ $("${composition[@]}" exec -T postgres psql -U janus -d janus -tAc 'SELECT v FROM essai_marqueur') == 1 ]]
[[ $("${composition[@]}" exec -T postgres psql -U janus -d janus -tAc "SELECT to_regclass('intrus')") == '' ]]
[[ $("${composition[@]}" run --rm --no-deps -T --entrypoint sh web -c 'cat /fiches/essai.txt; find /fiches | sort') == "$fiches_sauvees" ]]
"${composition[@]}" up -d --no-build --wait --wait-timeout 120 api
curl -fsS "${hote[@]}" http://127.0.0.1:3300/api/sante >/dev/null
echo '== Hebergement OK'
