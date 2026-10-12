#!/usr/bin/env bash
# Installe sous root:root (janus-restore). Remplace la base et les fiches par une sauvegarde.
#   janus-restore /var/backups/janus/sauvegarde-... --confirmer
# L'API est arretee et reste arretee : relancer ensuite avec un deploiement ou `docker compose start api`.
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 && $# == 2 && $2 == --confirmer ]] || {
  echo 'Usage : janus-restore <dossier de sauvegarde> --confirmer (remplace la base et les fiches)' >&2
  exit 64
}
sauvegarde=$(realpath -e -- "$1")
[[ $sauvegarde == /var/backups/janus/sauvegarde-* ]] || { echo 'Dossier hors de /var/backups/janus' >&2; exit 64; }
if [[ ${JANUS_VERROU_PRIS:-} != 1 ]]; then
  exec 9>/run/lock/janus.lock
  flock -w 1800 9 || { echo 'Verrou Janus occupe depuis plus de 30 minutes'; exit 1; }
fi
[[ ! -e $sauvegarde/PARTIELLE ]] || { echo 'Sauvegarde incomplete' >&2; exit 1; }
(cd "$sauvegarde" && sha256sum -c SHA256SUMS)
sha=$(cat "$sauvegarde/release-sha")
[[ $sha =~ ^[0-9a-f]{40}$ ]]
export JANUS_SHA="$sha"
composition=(docker compose --env-file /etc/janus/janus.env -p janus -f /etc/janus/compose.yml)
psql=("${composition[@]}" exec -T postgres psql -U janus -v ON_ERROR_STOP=1 -q)

"${composition[@]}" up -d --no-build --wait postgres
"${composition[@]}" stop -t 30 api
# Les roles ne sont pas dans un dump de base : sur un PostgreSQL neuf, `janus_app` doit exister
# avant la restauration pour que ses droits soient rejoues. Son mot de passe est repose par l'API.
"${psql[@]}" -d postgres <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'janus_app') THEN
    CREATE ROLE janus_app LOGIN;
  END IF;
END $$;
DROP DATABASE IF EXISTS janus WITH (FORCE);
CREATE DATABASE janus OWNER janus;
SQL
"${composition[@]}" exec -T postgres pg_restore -U janus -d janus --exit-on-error --no-owner < "$sauvegarde/janus.dump"
migrations=$("${psql[@]}" -d janus -tA -c 'SELECT count(*) FROM drizzle.__drizzle_migrations')
((migrations > 0)) || { echo 'Base restauree sans historique de migrations' >&2; exit 1; }
# Les fiches : le volume est vide puis rempli, au nom de l'utilisateur de l'API (uid 1000).
docker run --rm -i -v janus_fiches:/fiches --entrypoint sh postgres:17 -c \
  'find /fiches -mindepth 1 -delete && tar -xzf - -C /fiches && chown -R 1000:1000 /fiches' \
  < "$sauvegarde/fiches.tar.gz"
logger -t janus-restore -- "Restauration depuis $sauvegarde ($migrations migrations)"
printf 'Restauration terminee depuis %s (%s migrations). L API est arretee.\n' "$sauvegarde" "$migrations"
