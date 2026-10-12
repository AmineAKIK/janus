#!/usr/bin/env bash
# Diagnostic temporaire (2) : a) que dit compose quand l'API meurt au demarrage ? b) pg_isready (socket) devance-t-il le TCP ?
set -uo pipefail
export JANUS_SHA=0000000000000000000000000000000000000001
install -d -m 0755 /etc/janus
install -m 0644 deploy/vps/compose.yml /etc/janus/compose.yml
cles=$(node -e "
const c = require('node:crypto'); const e = c.createECDH('prime256v1'); e.generateKeys()
const b = (x) => x.toString('base64url')
console.log('VAPID_PUBLIC_KEY=' + b(e.getPublicKey())); console.log('VAPID_PRIVATE_KEY=' + b(e.getPrivateKey()))")
{ echo POSTGRES_PASSWORD=essai0postgres; echo JANUS_APP_MOT_DE_PASSE=essai0application; echo DEEPSEEK_API_KEY=essai
  echo VAPID_SUJET=mailto:essai@exemple.fr; echo "$cles"; } > /etc/janus/janus.env
c=(docker compose --env-file /etc/janus/janus.env -p janus -f /etc/janus/compose.yml)

echo '##### A. API qui meurt au demarrage (hote de base inexistant)'
cat > /tmp/panne.yml <<'YML'
services:
  api:
    environment:
      DATABASE_URL_PROPRIETAIRE: postgres://janus:essai0postgres@introuvable:5432/janus
YML
"${c[@]}" -f /tmp/panne.yml down -v >/dev/null 2>&1
"${c[@]}" up -d --no-build --wait --wait-timeout 120 postgres >/dev/null 2>&1
"${c[@]}" run --rm --no-deps -T --user root --entrypoint chown api node:node /fiches >/dev/null 2>&1
date +%T.%N
"${c[@]}" -f /tmp/panne.yml up -d --no-build --wait --wait-timeout 120 api web 2>&1 | tail -6
date +%T.%N
docker inspect --format 'etat={{.State.Status}} sortie={{.State.ExitCode}} sante={{.State.Health.Status}} streak={{.State.Health.FailingStreak}} redemarrages={{.RestartCount}}' janus-api-1
"${c[@]}" logs --no-color api | tail -8

echo '##### B. pg_isready par socket contre TCP, a froid'
for i in $(seq 1 15); do
  "${c[@]}" down -v >/dev/null 2>&1
  "${c[@]}" up -d --no-build postgres >/dev/null 2>&1
  debut=$(date +%s.%N); socket=''; tcp=''
  for t in $(seq 1 400); do
    if [[ -z $socket ]] && docker exec janus-postgres-1 pg_isready -q -U janus -d janus 2>/dev/null; then socket=$(date +%s.%N); fi
    if [[ -z $tcp ]] && docker exec janus-postgres-1 pg_isready -q -h 127.0.0.1 -U janus -d janus 2>/dev/null; then tcp=$(date +%s.%N); fi
    [[ -n $socket && -n $tcp ]] && break
  done
  printf 'essai %s : socket pret a +%.2fs, tcp pret a +%.2fs, ecart %.2fs\n' "$i" "$(echo "$socket - $debut" | bc)" "$(echo "$tcp - $debut" | bc)" "$(echo "$tcp - $socket" | bc)"
done
"${c[@]}" down -v >/dev/null 2>&1
exit 0
