#!/usr/bin/env bash
# Essai de deployer.sh sans Docker ni reseau : le script installe tourne tel quel, sur de vrais chemins
# (/var/www/janus, /etc/janus, /usr/local/bin/janus-*), avec un depot git local et de fausses commandes
# docker, curl et df. Verifie le deploiement, la version deja en service, l'ancienne CI, la sauvegarde,
# le retour arriere (sans et avec migration), le refus d'une migration quand les scripts installes
# different, l'espace disque et l'argument.
# A lancer en root sur une machine jetable (CI) : il refuse de tourner si l'un de ces chemins existe deja.
# shellcheck disable=SC2329  # les fonctions sont appelees par trap ou par verifier
set -Eeuo pipefail
[[ $(id -u) == 0 ]]
racine=$(cd "$(dirname "$0")/../.." && pwd)
depot=/var/www/janus
etat=/var/lib/janus-deploy
faux=/run/janus-essai
chemins=("$depot" "$etat" /etc/janus /var/backups/janus "$faux"
  /usr/local/bin/janus-deploy /usr/local/bin/janus-deploy-ssh /usr/local/bin/janus-backup
  /usr/local/bin/janus-restore /usr/local/bin/docker /usr/local/bin/curl /usr/local/bin/df
  /usr/local/bin/git /usr/local/bin/logger)
for chemin in "${chemins[@]}"; do
  [[ ! -e $chemin ]] || { echo "Refus : $chemin existe deja (machine jetable uniquement)" >&2; exit 2; }
done
origine=$(mktemp -d)
nettoyer() {
  local code=$?
  rm -rf "${chemins[@]}" "$origine"
  exit "$code"
}
trap nettoyer EXIT

echo '== Mise en place'
install -d -m 0755 /etc/janus /usr/local/bin
install -d -m 0700 "$etat" /var/backups/janus "$faux"
echo 'SENTRY_DSN=' > /etc/janus/janus.env
: > "$faux/appels"
: > "$faux/images"

# Les fausses commandes ecrivent leurs appels dans $faux/appels et obeissent aux fichiers de $faux.
cat > /usr/local/bin/docker <<'FAUX'
#!/usr/bin/env bash
faux=/run/janus-essai
printf 'docker %s\n' "$*" >> "$faux/appels"
case $1 in
  build)
    marque=''
    for argument in "$@"; do [[ $marque == -t ]] && { grep -qxF "$argument" "$faux/images" || echo "$argument" >> "$faux/images"; }; marque=$argument; done ;;
  compose)
    sous=''
    for argument in "$@"; do
      case $argument in up|ps|config|run) sous=$argument; break ;; esac
    done
    case $sous in
      up)
        [[ ! -f $faux/echec-up || ${JANUS_SHA:-} != "$(<"$faux/echec-up")" ]] || exit 1
        [[ " $* " != *' api web'* ]] || echo "$JANUS_SHA" > "$faux/en-service" ;;
      ps) echo "${*: -1}" ;;
    esac ;;
  inspect)
    case $3 in
      *Health*) echo healthy ;;
      *Config.Image*) echo "janus-$4:$(<"$faux/en-service")" ;;
    esac ;;
  image) grep "^$5:" "$faux/images" || true ;;
  rmi) grep -vxF "$2" "$faux/images" > "$faux/images.tmp" || true; mv "$faux/images.tmp" "$faux/images" ;;
esac
exit 0
FAUX
cat > /usr/local/bin/curl <<'FAUX'
#!/usr/bin/env bash
exit 0
FAUX
cat > /usr/local/bin/logger <<'FAUX'
#!/usr/bin/env bash
exit 0
FAUX
cat > /usr/local/bin/df <<'FAUX'
#!/usr/bin/env bash
echo 'Filesystem 1024-blocks Used Available Capacity Mounted'
echo "/dev/essai 100 0 $(<"${faux:-/run/janus-essai}/libre") 0% /"
FAUX
echo $((50 * 1024 * 1024)) > "$faux/libre"
# git est le vrai, sauf que le depot « GitHub » est ici un depot local.
cat > /usr/local/bin/git <<FAUX
#!/usr/bin/env bash
arguments=()
for argument in "\$@"; do
  if [[ \$argument == origin && " \$* " == *' fetch '* ]]; then argument=$origine/origine.git; fi
  arguments+=("\$argument")
done
exec /usr/bin/git "\${arguments[@]}"
FAUX
# La sauvegarde et la restauration sont fausses aussi : elles notent leur passage.
cat > "$origine/sauvegarder.sh" <<'FAUX'
#!/usr/bin/env bash
mkdir -p /var/backups/janus/sauvegarde-essai
: > /var/backups/janus/sauvegarde-essai/SHA256SUMS
echo /var/backups/janus/sauvegarde-essai > /var/lib/janus-deploy/derniere-sauvegarde
echo sauvegarde >> /run/janus-essai/appels
FAUX
cat > "$origine/restaurer.sh" <<'FAUX'
#!/usr/bin/env bash
echo "restauration $*" >> /run/janus-essai/appels
FAUX
chmod 0755 /usr/local/bin/{docker,curl,logger,df,git}

git_() { /usr/bin/git -C "$origine/travail" "$@"; }
git init -q -b main "$origine/travail"
git_ config user.email essai@exemple.fr
git_ config user.name Essai
mkdir -p "$origine/travail/deploy/vps" "$origine/travail/apps/api/migrations"
cp "$racine/deploy/vps/deployer.sh" "$racine/deploy/vps/ssh.sh" "$origine/travail/deploy/vps/"
cp "$origine/sauvegarder.sh" "$origine/restaurer.sh" "$origine/travail/deploy/vps/"
echo 'services: {}' > "$origine/travail/deploy/vps/compose.yml"
echo 0 > "$origine/travail/note"
validation() { git_ add -A && git_ commit -q -m "$1" && git_ rev-parse HEAD; }
A=$(validation A)
echo 1 > "$origine/travail/note"; B=$(validation B)
echo 2 > "$origine/travail/note"; D=$(validation D)
echo 'select 1;' > "$origine/travail/apps/api/migrations/0001.sql"; validation M >/dev/null
echo 3 > "$origine/travail/note"; E=$(validation E)
git_ checkout -q -b autre "$A"; echo x > "$origine/travail/hors-main"; X=$(validation X)
git_ checkout -q main
/usr/bin/git clone -q --bare "$origine/travail" "$origine/origine.git"
/usr/bin/git clone -q "$origine/origine.git" "$depot"
/usr/bin/git -C "$depot" remote set-url origin https://github.com/AmineAKIK/janus.git
/usr/bin/git -C "$depot" checkout -q --detach "$A"
installer() { install -o root -g root -m 0755 "$depot/deploy/vps/$1" "/usr/local/bin/$2"; }
installer deployer.sh janus-deploy
installer ssh.sh janus-deploy-ssh
installer sauvegarder.sh janus-backup
installer restaurer.sh janus-restore
install -m 0644 "$depot/deploy/vps/compose.yml" /etc/janus/compose.yml

echec=0
sortie=''
code=0
lancer() {
  : > "$faux/appels.avant"
  cp "$faux/appels" "$faux/appels.avant"
  set +e
  sortie=$(/usr/local/bin/janus-deploy "$1" 2>&1)
  code=$?
  set -e
  appels=$(diff "$faux/appels.avant" "$faux/appels" | sed -n 's/^> //p' || true)
}
verifier() {
  local description=$1
  shift
  if "$@"; then echo "  ok  $description"; else echo "  ECHEC  $description" >&2; echec=1; fi
}
code_est() { [[ $code == "$1" ]]; }
sortie_dit() { [[ $sortie == *"$1"* ]]; }
appels_dit() { [[ $appels == *"$1"* ]]; }
appels_ne_dit_pas() { [[ $appels != *"$1"* ]]; }
en_service() { [[ $(<"$etat/current-sha") == "$1" ]]; }
tete_est() { [[ $(/usr/bin/git -C "$depot" rev-parse HEAD) == "$1" ]]; }

echo '== Premier deploiement (aucune version en service)'
lancer "$A"
verifier 'sort en 0' code_est 0
verifier 'construit les deux images' appels_dit "-t janus-api:$A"
verifier 'construit l image web' appels_dit "-t janus-web:$A"
verifier 'pas de sauvegarde sans version precedente' appels_ne_dit_pas sauvegarde
verifier 'prepare la base et les fiches' appels_dit 'run --rm --no-deps -T --user root --entrypoint chown api node:node /fiches'
verifier 'note la version en service' en_service "$A"
verifier 'journalise le deploiement' sortie_dit "Deploiement verifie sha=$A precedent= migration=0"

echo '== Meme version : rien a refaire'
lancer "$A"
verifier 'sort en 0' code_est 0
verifier 'dit qu elle est deja en service' sortie_dit 'Version deja en service'
verifier 'ne construit rien' appels_ne_dit_pas 'docker build'

echo '== Mise a jour sans migration'
lancer "$B"
verifier 'sort en 0' code_est 0
verifier 'sauvegarde avant de basculer' appels_dit sauvegarde
verifier 'note la nouvelle version' en_service "$B"
verifier 'sans migration' sortie_dit "precedent=$A migration=0"

echo '== Ancienne CI (un commit deja depasse)'
lancer "$A"
verifier 'sort en 0' code_est 0
verifier 'l ignore' sortie_dit 'Ancienne CI ignoree'
verifier 'garde la version en service' en_service "$B"
verifier 'ne construit rien' appels_ne_dit_pas 'docker build'

echo '== Echec de la bascule, sans migration : retour a la version precedente'
echo "$D" > "$faux/echec-up"
lancer "$D"
rm "$faux/echec-up"
verifier 'sort en erreur' code_est 1
verifier 'journalise l echec' sortie_dit "Echec phase=bascule sha=$D"
verifier 'verifie le retour arriere' sortie_dit "Rollback verifie sha=$B migration=0"
verifier 'ne restaure pas la base' appels_ne_dit_pas restauration
verifier 'garde la version precedente' en_service "$B"
verifier 'remet le depot sur la version precedente' tete_est "$B"

echo '== Echec de la bascule avec migration : la base est restauree d abord'
echo "$E" > "$faux/echec-up"
lancer "$E"
rm "$faux/echec-up"
verifier 'sort en erreur' code_est 1
verifier 'detecte la migration' sortie_dit 'Migration detectee'
verifier 'restaure la sauvegarde confirmee' appels_dit 'restauration /var/backups/janus/sauvegarde-essai --confirmer'
verifier 'verifie le retour arriere' sortie_dit "Rollback verifie sha=$B migration=1"
verifier 'garde la version precedente' en_service "$B"
verifier 'remet le depot sur la version precedente' tete_est "$B"

echo '== Migration refusee quand la sauvegarde installee n est pas celle du depot'
echo '# autre version' >> /usr/local/bin/janus-backup
lancer "$E"
verifier 'sort en erreur' code_est 1
verifier 'refuse la migration' sortie_dit 'Migration refusee'
verifier 'ne construit rien' appels_ne_dit_pas 'docker build'
verifier 'garde la version precedente' en_service "$B"
verifier 'remet le depot sur la version precedente' tete_est "$B"
installer sauvegarder.sh janus-backup

echo '== Mise a jour avec migration'
lancer "$E"
verifier 'sort en 0' code_est 0
verifier 'sauvegarde avant la migration' appels_dit sauvegarde
verifier 'ne restaure rien' appels_ne_dit_pas restauration
verifier 'note la nouvelle version' en_service "$E"
verifier 'journalise la migration' sortie_dit "precedent=$B migration=1"
images_sont() { [[ $(sort "$faux/images" | tr '\n' ' ') == "$*" ]]; }
verifier 'ne garde que l image en service et la precedente' images_sont "janus-api:$B janus-api:$E janus-web:$B janus-web:$E "

echo '== Refus : commit hors de main, argument invalide, disque presque plein'
lancer "$X"
verifier 'un commit qui n est pas dans main est refuse' code_est 1
verifier 'et ne change rien' en_service "$E"
lancer 'pas-un-sha'
verifier 'un argument qui n est pas un SHA sort en 64' code_est 64
echo $((5 * 1024 * 1024)) > "$faux/libre"
lancer "$D"
verifier 'moins de 10 Gio : refuse' code_est 1
verifier 'le dit' sortie_dit 'Moins de 10 Gio'
echo $((50 * 1024 * 1024)) > "$faux/libre"

if ((echec == 0)); then echo 'deployer.sh : tous les essais passent.'; else echo 'deployer.sh : des essais ont echoue.' >&2; fi
exit "$echec"
