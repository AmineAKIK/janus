#!/bin/bash
# Restaure la dernière sauvegarde dans une base vide et vérifie qu'elle contient les mêmes
# migrations que la base en service. Ne touche pas à la base en service. Lancé à la main
# (`docker compose exec sauvegarde essai-restauration.sh`) et par la CI.
set -euo pipefail

essai="janus_essai_restauration"
serveur="${DATABASE_URL_PROPRIETAIRE%/*}"
base_en_service="${DATABASE_URL_PROPRIETAIRE}"

psql "$base_en_service" -qc "DROP DATABASE IF EXISTS $essai"
psql "$base_en_service" -qc "CREATE DATABASE $essai"
trap 'psql "$base_en_service" -qc "DROP DATABASE IF EXISTS $essai" > /dev/null' EXIT

restic dump latest janus.dump --tag janus | pg_restore --dbname "$serveur/$essai" --no-owner --exit-on-error

requete="SELECT count(*) FROM drizzle.__drizzle_migrations"
attendu=$(psql "$base_en_service" -Atc "$requete")
obtenu=$(psql "$serveur/$essai" -Atc "$requete")
if [ "$attendu" != "$obtenu" ] || [ "$obtenu" -lt 1 ]; then
  echo "Restauration incomplète : $obtenu migrations au lieu de $attendu." >&2
  exit 1
fi
echo "Restauration réussie : $obtenu migrations retrouvées dans une base vide."
