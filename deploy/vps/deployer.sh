#!/usr/bin/env bash
# Installe sous root:root, jamais execute depuis le checkout.
if [[ ${JANUS_ENV_PROPRE:-} != 1 ]]; then
  exec /usr/bin/env -i JANUS_ENV_PROPRE=1 HOME=/root LC_ALL=C PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin /bin/bash "$0" "$@"
fi
set -Eeuo pipefail
umask 077
readonly depot=/var/www/janus etat=/var/lib/janus-deploy configuration=/etc/janus/compose.yml
[[ $(id -u) == 0 && $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] || exit 64
cible=$1
exec 9>/run/lock/janus-deploy.lock
flock -n 9 || { echo 'Un deploiement Janus est deja en cours'; exit 1; }
journal() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; logger -t janus-deploy -- "$*" || true; }
composition() { JANUS_SHA="$1" docker compose --env-file /etc/janus/janus.env -p janus -f "$configuration" "${@:2}"; }
verifier() {
  local sha=$1 limite id statut
  limite=$(($(date +%s)+120))
  while (( $(date +%s) < limite )); do
    id=$(composition "$sha" ps -q api)
    statut=$(docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || true)
    if [[ $statut == healthy ]]; then
      [[ $(docker inspect --format '{{.Config.Image}}' "$id") == "janus-api:$sha" ]] || return 1
      id=$(composition "$sha" ps -q web)
      [[ $(docker inspect --format '{{.Config.Image}}' "$id") == "janus-web:$sha" ]] || return 1
      curl -fsS --max-time 5 -H 'Host: janus.akiksystems.fr' http://127.0.0.1:3300/api/sante >/dev/null &&
      curl -fsS --max-time 5 -H 'Host: janus.akiksystems.fr' http://127.0.0.1:3300/ >/dev/null && return 0
    fi
    sleep 2
  done
  return 1
}
precedent=''
phase=initial
terminer() {
  local code=$?
  trap - EXIT
  set +e
  if ((code != 0)); then
    journal "Echec phase=$phase sha=$cible"
    if [[ -n $precedent && $phase == bascule ]]; then
      if composition "$precedent" up -d --no-build --no-deps api web && verifier "$precedent"; then
        git -C "$depot" checkout --quiet --detach "$precedent"
        journal "Rollback verifie sha=$precedent"
      else
        journal 'ERREUR: rollback non verifie, intervention necessaire'
      fi
    elif [[ -n $precedent && $phase == construction ]]; then
      git -C "$depot" checkout --quiet --detach "$precedent" || journal 'ERREUR: checkout non restaure'
    fi
  fi
  exit "$code"
}
trap terminer EXIT
[[ $(git -C "$depot" remote get-url origin) == https://github.com/AmineAKIK/janus.git ]]
[[ -z $(git -C "$depot" status --porcelain) ]]
libre=$(df -Pk /var/lib/docker | awk 'NR==2 {print $4}')
((libre > 10*1024*1024)) || { journal 'Moins de 10 Gio disponibles'; exit 1; }
git -C "$depot" fetch --quiet origin '+refs/heads/main:refs/remotes/origin/main'
git -C "$depot" cat-file -e "$cible^{commit}"
git -C "$depot" merge-base --is-ancestor "$cible" origin/main
if [[ -f $etat/current-sha ]]; then
  precedent=$(<"$etat/current-sha")
  [[ $precedent =~ ^[0-9a-f]{40}$ ]]
  if [[ $precedent == "$cible" ]] && verifier "$cible"; then journal 'Version deja en service'; exit 0; fi
  if git -C "$depot" merge-base --is-ancestor "$cible" "$precedent"; then journal 'Ancienne CI ignoree'; exit 0; fi
  # Le rollback automatique est garanti uniquement sans changement de schema.
  # Toute migration nouvelle exige une validation isolee et une bascule manuelle.
  if ! git -C "$depot" diff --quiet "$precedent" "$cible" -- apps/api/migrations apps/api/src/base/migrer.ts apps/api/src/base/roleApplication.ts; then
    journal 'STOP: migrations modifiees, validation manuelle necessaire avant bascule'
    exit 1
  fi
fi
phase=construction
git -C "$depot" checkout --quiet --detach "$cible"
cd "$depot"
docker build --pull --label "org.opencontainers.image.revision=$cible" -f apps/api/Dockerfile -t "janus-api:$cible" .
docker build --pull --label "org.opencontainers.image.revision=$cible" -f infra/caddy/Dockerfile -t "janus-web:$cible" .
if [[ -n $precedent ]]; then
  /usr/local/bin/janus-backup
fi
phase=bascule
if [[ -z $precedent ]]; then
  composition "$cible" up -d --no-build --wait --wait-timeout 120 postgres
fi
composition "$cible" up -d --no-build --no-deps api web
verifier "$cible"
printf '%s\n' "$cible" > "$etat/current-sha.tmp"
mv "$etat/current-sha.tmp" "$etat/current-sha"
phase=termine
journal "Deploiement verifie sha=$cible precedent=$precedent"
