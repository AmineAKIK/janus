import type { Taille } from '../../theme.ts'
import { GroupeSegmente, type OptionSegmentee } from '../GroupeSegmente/GroupeSegmente.tsx'

export interface ProprietesSelecteurTaille {
  readonly valeur: Taille
  readonly onChange: (taille: Taille) => void
  readonly className?: string
}

const OPTIONS: readonly OptionSegmentee<Taille>[] = [
  { valeur: 'petit', libelle: 'Petit' },
  { valeur: 'standard', libelle: 'Standard' },
  { valeur: 'grand', libelle: 'Grand' },
]

export function SelecteurTaille({ valeur, onChange, className }: ProprietesSelecteurTaille) {
  return (
    <GroupeSegmente
      libelle="Taille du texte"
      options={OPTIONS}
      valeur={valeur}
      onChange={onChange}
      {...(className === undefined ? {} : { className })}
    />
  )
}
