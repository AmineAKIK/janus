#!/usr/bin/env bash
# Diagnostic temporaire : demarrages repetes de la pile sur machine vide, journaux complets a chaque echec.
set -uo pipefail
sha=0000000000000000000000000000000000000001
export JANUS_SHA=$sha
install -d -m 0755 /etc/janus
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
c=(docker compose --env-file /etc/janus/janus.env -p janus -f /etc/janus/compose.yml)
echecs=0
for i in $(seq 1 "${1:-20}"); do
  "${c[@]}" down -v >/dev/null 2>&1
  date +%T.%N
  "${c[@]}" up -d --no-build --wait --wait-timeout 120 postgres >/dev/null 2>&1
  "${c[@]}" run --rm --no-deps -T --user root --entrypoint chown api node:node /fiches >/dev/null 2>&1
  if "${c[@]}" up -d --no-build --wait --wait-timeout 120 api web >/tmp/up.log 2>&1; then
    echo "essai $i : ok"
  else
    echecs=$((echecs+1))
    echo "=== essai $i : ECHEC ==="
    cat /tmp/up.log | tail -5
    echo '--- etat de l api'
    docker inspect --format 'etat={{.State.Status}} sortie={{.State.ExitCode}} sante={{.State.Health.Status}} demarre={{.State.StartedAt}} fini={{.State.FinishedAt}} redemarrages={{.RestartCount}}' janus-api-1
    docker inspect --format '{{json .State.Health}}' janus-api-1
    echo '--- journaux api'
    "${c[@]}" logs --no-color --timestamps api | tail -40
    echo '--- journaux postgres'
    "${c[@]}" logs --no-color --timestamps postgres | tail -40
  fi
done
echo "echecs: $echecs"
"${c[@]}" down -v >/dev/null 2>&1
exit 0
