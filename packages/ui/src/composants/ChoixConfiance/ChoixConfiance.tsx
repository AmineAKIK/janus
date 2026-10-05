import type { Confiance } from '@janus/contrats'
import { GroupeSegmente, type OptionSegmentee } from '../GroupeSegmente/GroupeSegmente.tsx'

export interface ProprietesChoixConfiance {
  /** `null` : aucun choix fait. */
  readonly valeur: Confiance | null
  readonly onChange: (confiance: Confiance) => void
  /** Le parent empêche l'envoi tant que `valeur` vaut `null`. */
  readonly obligatoire?: boolean
  readonly className?: string
}

const OPTIONS: readonly OptionSegmentee<Confiance>[] = [
  { valeur: 'sur', libelle: 'Sûr' },
  { valeur: 'hesitant', libelle: 'Hésitant' },
  { valeur: 'hasard', libelle: 'Au hasard' },
]

export function ChoixConfiance({
  valeur,
  onChange,
  obligatoire = false,
  className,
}: ProprietesChoixConfiance) {
  return (
    <GroupeSegmente
      libelle="Ta confiance dans cette réponse"
      options={OPTIONS}
      valeur={valeur}
      onChange={onChange}
      obligatoire={obligatoire}
      {...(className === undefined ? {} : { className })}
    />
  )
}
