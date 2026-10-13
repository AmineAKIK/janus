#!/usr/bin/env bash
# Usage : bench/grille.sh <fichier de sortie .jsonl> [étiquette]
# Lance chaque scénario pour 1k, 10k, 100k et 1M faits, un processus Node par mesure, avec un délai maximal.
# Un scénario qui dépasse le délai pour une taille n'est pas relancé pour les tailles supérieures.
set -u
cd "$(dirname "$0")/.."
sortie="$1"
delai="${DELAI:-90}"
tailles="${TAILLES:-1000 10000 100000 1000000}"
scenarios="${SCENARIOS:-jourDe jourDe_1000_dates calculerBloc_un calculerBloc_tous tableau journal lignesDuJournal ligneDuJournal export revueMethode autonomie retention calibration_tout calibration_30j erreursRecurrentes fiabilite depenseDuMois aisanceDesBlocs seances questionsDebut fileDuJour echeances_tous blocEnCours cartesDuJour apercuCarte noterCarte tirerDifferee}"
: > "$sortie"
for s in $scenarios; do
  depasse=0
  for n in $tailles; do
    if [ "$depasse" = 1 ]; then
      echo "{\"scenario\":\"$s\",\"n\":$n,\"ms\":null,\"note\":\"non lancé (taille inférieure déjà trop lente)\"}" >> "$sortie"
      continue
    fi
    ligne=$(timeout "$delai" node --max-old-space-size=8192 bench/lancer.ts "$s" "$n" 50 1500 2>/dev/null | tail -1)
    if [ -z "$ligne" ]; then
      echo "{\"scenario\":\"$s\",\"n\":$n,\"ms\":null,\"note\":\"> ${delai} s ou erreur\"}" >> "$sortie"
      depasse=1
    else
      echo "$ligne" >> "$sortie"
    fi
  done
done
