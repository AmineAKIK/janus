import type { Reglages } from '@janus/contrats'
import { LigneLectureSeule } from '@janus/ui'
import styles from '../Parametres.module.css'
import { lignesRegles, TEXTES_REGLES as T } from '../textes.ts'

export function SectionRegles({ reglages }: { readonly reglages: Reglages }) {
  return (
    <>
      <p className={`${styles['badge'] ?? ''} texte-legende-12`}>{T.badge}</p>
      <p className="texte-petit-14">{T.explication}</p>
      {lignesRegles(reglages).map(({ libelle, valeur }) => (
        <LigneLectureSeule key={libelle} libelle={libelle} valeur={valeur} />
      ))}
    </>
  )
}
