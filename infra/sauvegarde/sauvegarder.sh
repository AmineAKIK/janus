#!/bin/bash
# Un instantané de la base (pg_dump), chiffré et envoyé par restic, puis la rétention :
# 7 jours, 4 semaines, 12 mois.
set -euo pipefail

pg_dump --format=custom --dbname "$DATABASE_URL_PROPRIETAIRE" \
  | restic backup --stdin --stdin-filename janus.dump --tag janus
restic forget --tag janus --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
echo "Sauvegarde terminée."
