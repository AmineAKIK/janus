#!/bin/bash
# Lance une sauvegarde chaque nuit à HEURE_SAUVEGARDE (hh:mm, fuseau du serveur, 03:00 par défaut).
set -euo pipefail
heure="${HEURE_SAUVEGARDE:-03:00}"

# Prépare le dépôt restic au premier lancement.
restic cat config > /dev/null 2>&1 || restic init

while true; do
  maintenant=$(date +%s)
  prochaine=$(date -d "$(date +%F) $heure" +%s)
  if [ "$prochaine" -le "$maintenant" ]; then prochaine=$((prochaine + 86400)); fi
  echo "Prochaine sauvegarde dans $((prochaine - maintenant)) s."
  sleep $((prochaine - maintenant))
  sauvegarder.sh || echo "La sauvegarde a échoué." >&2
done
