#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]]
exec 8>/run/lock/janus-backup.lock
flock -n 8 || exit 1
sha=$(cat /var/lib/janus-deploy/current-sha)
[[ $sha =~ ^[0-9a-f]{40}$ ]]
composition=(docker compose --env-file /etc/janus/janus.env -p janus -f /etc/janus/compose.yml)
export JANUS_SHA="$sha"
destination=$(mktemp -d /var/backups/janus/sauvegarde-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX)
chmod 0700 "$destination"
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
logger -t janus-backup -- "Sauvegarde verifiee $destination"
printf 'Sauvegarde verifiee: %s\n' "$destination"
