import { CloudOff } from '@janus/ui'
import styles from './Bloc.module.css'
import { TEXTES_BLOC } from './textes.ts'

/** Au-dessus de la fiche quand le réseau manque : ce qui est gardé part au retour du réseau. */
export function EncartHorsConnexion({
  derniereReponse,
}: {
  readonly derniereReponse: string | null
}) {
  return (
    <div className={styles['horsConnexion']}>
      <p className={`${styles['envoyee'] ?? ''} texte-corps-16`}>
        <CloudOff aria-hidden="true" className={styles['nuage']} />
        {TEXTES_BLOC.envoyee}
      </p>
      {derniereReponse !== null && (
        <p className={`${styles['gardee'] ?? ''} texte-petit-14`}>{derniereReponse}</p>
      )}
    </div>
  )
}
