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
# Un seul verrou pour le deploiement, la sauvegarde et la restauration.
exec 9>/run/lock/janus.lock
flock -w 900 9 || { echo 'Un deploiement ou une sauvegarde Janus est deja en cours'; exit 1; }
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
migration=0
sauvegarde=''
phase=initial
restaurer_configuration() {
  [[ ! -f /etc/janus/compose.yml.precedent ]] || cp -p /etc/janus/compose.yml.precedent /etc/janus/compose.yml
}
terminer() {
  local code=$?
  trap - EXIT
  set +e
  if ((code != 0)); then
    journal "Echec phase=$phase sha=$cible"
    if [[ -n $precedent && $phase == bascule ]]; then
      restaurer_configuration
      # Une migration a pu toucher la base : l'ancienne image ne repart que sur la base d'avant.
      if ((migration == 1)) && ! JANUS_VERROU_PRIS=1 /usr/local/bin/janus-restore "$sauvegarde" --confirmer; then
        journal 'ERREUR: base non restauree, ancienne version non relancee, intervention necessaire'
      elif composition "$precedent" up -d --no-build --no-deps api web && verifier "$precedent"; then
        git -C "$depot" checkout --quiet --detach "$precedent"
        journal "Rollback verifie sha=$precedent migration=$migration"
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
  # Une migration nouvelle est appliquee par l'API au demarrage, apres une sauvegarde obligatoire ;
  # si la bascule echoue, la base est restauree depuis cette sauvegarde avant de relancer l'ancienne image.
  if ! git -C "$depot" diff --quiet "$precedent" "$cible" -- apps/api/migrations apps/api/src/base/migrer.ts apps/api/src/base/roleApplication.ts; then
    migration=1
    journal 'Migration detectee: sauvegarde obligatoire, restauration en cas d echec'
  fi
fi
phase=construction
git -C "$depot" checkout --quiet --detach "$cible"
cd "$depot"
# Le suivi d'erreurs du front est fixe a la construction : son adresse vient de janus.env.
sentry=$(sed -n 's/^SENTRY_DSN=//p' /etc/janus/janus.env | tail -n 1 | tr -d "\"'")
docker build --pull --label "org.opencontainers.image.revision=$cible" -f apps/api/Dockerfile -t "janus-api:$cible" .
docker build --pull --label "org.opencontainers.image.revision=$cible" --build-arg "VITE_COMMIT=${cible:0:7}" --build-arg "VITE_SENTRY_DSN=$sentry" -f infra/caddy/Dockerfile -t "janus-web:$cible" .
# Le compose du depot est valide puis installe : plus de copie manuelle. Le Caddyfile est dans l'image.
rm -f /etc/janus/compose.yml.precedent
if [[ -f /etc/janus/compose.yml ]] && ! cmp -s deploy/vps/compose.yml /etc/janus/compose.yml; then
  journal 'Configuration modifiee: compose.yml'
fi
JANUS_SHA="$cible" docker compose --env-file /etc/janus/janus.env -p janus -f deploy/vps/compose.yml config -q
docker run --rm --entrypoint caddy "janus-web:$cible" validate --config /etc/caddy/Caddyfile --adapter caddyfile
if [[ -n $precedent ]]; then
  JANUS_VERROU_PRIS=1 /usr/local/bin/janus-backup
  sauvegarde=$(<"$etat/derniere-sauvegarde")
  [[ $sauvegarde == /var/backups/janus/sauvegarde-* && -f $sauvegarde/SHA256SUMS ]]
fi
phase=bascule
if [[ -f /etc/janus/compose.yml ]]; then cp -p /etc/janus/compose.yml /etc/janus/compose.yml.precedent; fi
install -o root -g root -m 0644 deploy/vps/compose.yml /etc/janus/compose.yml
if [[ -z $precedent ]]; then
  composition "$cible" up -d --no-build --wait --wait-timeout 120 postgres
  composition "$cible" run --rm --no-deps -T --user root --entrypoint chown api node:node /fiches
fi
composition "$cible" up -d --no-build --no-deps api web
verifier "$cible"
printf '%s\n' "$cible" > "$etat/current-sha.tmp"
mv "$etat/current-sha.tmp" "$etat/current-sha"
phase=termine
journal "Deploiement verifie sha=$cible precedent=$precedent migration=$migration"
# Seules l'image en service et la precedente (pour le retour arriere) sont gardees.
for image in janus-api janus-web; do
  while IFS= read -r reference; do
    [[ $reference == "$image:$cible" || $reference == "$image:$precedent" ]] || docker rmi "$reference" || true
  done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' "$image")
done
docker builder prune --force --filter until=168h >/dev/null || true
