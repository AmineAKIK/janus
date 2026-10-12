#!/usr/bin/env bash
# Installe sous root:root (janus-backup). Sauvegarde base et fiches, verifie, puis purge les anciennes.
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]]
readonly racine=/var/backups/janus etat=/var/lib/janus-deploy
# Une sauvegarde est gardee au moins 14 jours ; les 3 plus recentes ne sont jamais purgees.
readonly conservation_jours=14 conservation_minimale=3
# Un seul verrou pour le deploiement, la sauvegarde et la restauration. Le deploiement, qui le
# tient deja, lance la sauvegarde avec JANUS_VERROU_PRIS=1.
if [[ ${JANUS_VERROU_PRIS:-} != 1 ]]; then
  exec 9>/run/lock/janus.lock
  flock -w 1800 9 || { echo 'Verrou Janus occupe depuis plus de 30 minutes'; exit 1; }
fi
sha=$(cat "$etat/current-sha")
[[ $sha =~ ^[0-9a-f]{40}$ ]]
composition=(docker compose --env-file /etc/janus/janus.env -p janus -f /etc/janus/compose.yml)
export JANUS_SHA="$sha"
mkdir -p "$racine"
chmod 0700 "$racine"
destination=$(mktemp -d "$racine/sauvegarde-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
chmod 0700 "$destination"
# Tant que ce marqueur est la, la sauvegarde est incomplete : elle ne sert pas et sera purgee.
touch "$destination/PARTIELLE"
# Un arret bref ferme les ecritures pour garder base et fiches coherentes.
redemarrer() { local code=$?; trap - EXIT; "${composition[@]}" start api || code=1; exit "$code"; }
trap redemarrer EXIT
"${composition[@]}" stop -t 30 api
"${composition[@]}" exec -T postgres pg_dump -U janus -d janus --format=custom > "$destination/janus.dump"
"${composition[@]}" run --rm --no-deps -T --entrypoint tar web -C /fiches -czf - . > "$destination/fiches.tar.gz"
"${composition[@]}" exec -T postgres pg_restore --list < "$destination/janus.dump" >/dev/null
gzip -t "$destination/fiches.tar.gz"
(cd "$destination"; sha256sum janus.dump fiches.tar.gz > SHA256SUMS; sha256sum -c SHA256SUMS)
printf '%s\n' "$sha" > "$destination/release-sha"
rm "$destination/PARTIELLE"
printf '%s\n' "$destination" > "$etat/derniere-sauvegarde.tmp"
mv "$etat/derniere-sauvegarde.tmp" "$etat/derniere-sauvegarde"
logger -t janus-backup -- "Sauvegarde verifiee $destination"
printf 'Sauvegarde verifiee: %s\n' "$destination"

purger() {
  local dossier valides=() i
  # Une sauvegarde interrompue depuis plus d'un jour n'est plus en cours : on la retire.
  while IFS= read -r dossier; do
    [[ -e $dossier/PARTIELLE ]] && rm -rf -- "$dossier"
  done < <(find "$racine" -mindepth 1 -maxdepth 1 -type d -name 'sauvegarde-*' -mtime +0 | sort)
  # Une sauvegarde encore marquee PARTIELLE n'est pas une sauvegarde : elle ne protege aucune autre.
  while IFS= read -r dossier; do
    [[ -e $dossier/PARTIELLE ]] || valides+=("$dossier")
  done < <(find "$racine" -mindepth 1 -maxdepth 1 -type d -name 'sauvegarde-*' | sort)
  for ((i = 0; i < ${#valides[@]} - conservation_minimale; i++)); do
    dossier=${valides[i]}
    [[ -n $(find "$dossier" -maxdepth 0 -mtime +"$conservation_jours") ]] || continue
    rm -rf -- "$dossier"
    logger -t janus-backup -- "Sauvegarde purgee $dossier"
  done
}
purger
