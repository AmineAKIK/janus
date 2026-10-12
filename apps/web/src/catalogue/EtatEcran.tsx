import { BandeauAlerte, Bouton } from '@janus/ui'
import { adresse } from '../routes/navigation.ts'
import styles from './Catalogue.module.css'
import { TEXTES } from './textes.ts'

/** Squelette aux dimensions d'une carte : la page ne saute pas quand le contenu arrive. */
export function Chargement({ nombre = 1 }: { readonly nombre?: number }) {
  return (
    <div className={styles['liste']} aria-busy="true">
      <p className={styles['cache']} role="status">
        {TEXTES.chargement}
      </p>
      {Array.from({ length: nombre }, (_, index) => (
        <div key={index} className={styles['squelette']} aria-hidden="true" />
      ))}
    </div>
  )
}

export function Erreur({
  reessayer,
  introuvable = false,
}: {
  readonly reessayer: () => void
  /** Le serveur ne connaît pas cette adresse : pas de nouvel essai, un chemin de sortie. */
  readonly introuvable?: boolean
}) {
  if (introuvable) {
    return (
      <div className={styles['erreur']}>
        <BandeauAlerte type="erreur">{TEXTES.introuvable}</BandeauAlerte>
        <a href={adresse('/formations')}>{TEXTES.retourAuxFormations}</a>
      </div>
    )
  }
  return (
    <div className={styles['erreur']}>
      <BandeauAlerte type="erreur">{TEXTES.erreur}</BandeauAlerte>
      <Bouton variante="secondaire" onClick={reessayer}>
        {TEXTES.reessayer}
      </Bouton>
    </div>
  )
}
