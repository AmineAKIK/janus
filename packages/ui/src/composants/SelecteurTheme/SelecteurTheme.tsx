import type { Theme } from '../../theme.ts'
import { GroupeSegmente, type OptionSegmentee } from '../GroupeSegmente/GroupeSegmente.tsx'

export interface ProprietesSelecteurTheme {
  readonly valeur: Theme
  readonly onChange: (theme: Theme) => void
  readonly className?: string
}

const OPTIONS: readonly OptionSegmentee<Theme>[] = [
  { valeur: 'clair', libelle: 'Clair' },
  { valeur: 'sombre', libelle: 'Sombre' },
  { valeur: 'systeme', libelle: 'Système' },
]

export function SelecteurTheme({ valeur, onChange, className }: ProprietesSelecteurTheme) {
  return (
    <GroupeSegmente
      libelle="Thème"
      options={OPTIONS}
      valeur={valeur}
      onChange={onChange}
      {...(className === undefined ? {} : { className })}
    />
  )
}
