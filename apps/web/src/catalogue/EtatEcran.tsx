import { BandeauAlerte, Bouton } from '@janus/ui'
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

export function Erreur({ reessayer }: { readonly reessayer: () => void }) {
  return (
    <div className={styles['erreur']}>
      <BandeauAlerte type="erreur">{TEXTES.erreur}</BandeauAlerte>
      <Bouton variante="secondaire" onClick={reessayer}>
        {TEXTES.reessayer}
      </Bouton>
    </div>
  )
}
