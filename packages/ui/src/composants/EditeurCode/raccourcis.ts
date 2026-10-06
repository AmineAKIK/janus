const INDENTATION = '  '

export interface Edition {
  readonly valeur: string
  readonly debut: number
  readonly fin: number
}

function debutDeLigne(valeur: string, position: number): number {
  return valeur.lastIndexOf('\n', position - 1) + 1
}

/** Tab : deux espaces à la position du curseur, ou au début de chaque ligne d'une sélection. */
export function indenter({ valeur, debut, fin }: Edition): Edition {
  if (debut === fin) {
    return {
      valeur: `${valeur.slice(0, debut)}${INDENTATION}${valeur.slice(fin)}`,
      debut: debut + INDENTATION.length,
      fin: debut + INDENTATION.length,
    }
  }
  const premier = debutDeLigne(valeur, debut)
  const lignes = valeur.slice(premier, fin).split('\n')
  const resultat = lignes.map((ligne) => `${INDENTATION}${ligne}`).join('\n')
  return {
    valeur: `${valeur.slice(0, premier)}${resultat}${valeur.slice(fin)}`,
    debut: debut + INDENTATION.length,
    fin: fin + INDENTATION.length * lignes.length,
  }
}

/** Maj+Tab : retire jusqu'à deux espaces au début de la ligne du curseur ou de chaque ligne choisie. */
export function desindenter({ valeur, debut, fin }: Edition): Edition {
  const premier = debutDeLigne(valeur, debut)
  const lignes = valeur.slice(premier, fin).split('\n')
  const retirees = lignes.map((ligne) => /^ {1,2}/.exec(ligne)?.[0].length ?? 0)
  const resultat = lignes.map((ligne, rang) => ligne.slice(retirees[rang] ?? 0)).join('\n')
  const total = retirees.reduce((somme, retrait) => somme + retrait, 0)
  return {
    valeur: `${valeur.slice(0, premier)}${resultat}${valeur.slice(fin)}`,
    debut: Math.max(premier, debut - (retirees[0] ?? 0)),
    fin: Math.max(premier, fin - total),
  }
}
