import { Bouton } from '@janus/ui'
import styles from './Bloc.module.css'
import { TEXTES_ERREUR_IA } from './textes.ts'

/** Une erreur critique repérée par l'IA, que seul Amine peut confirmer. */
export function EncartErreurIa({
  code,
  reponse,
  surConfirmer,
  surRejeter,
}: {
  /** Le code du bloc, « B03 ». */
  readonly code: string
  readonly reponse: string
  readonly surConfirmer: () => void
  readonly surRejeter: () => void
}) {
  return (
    <section className={styles['encart']} aria-label={TEXTES_ERREUR_IA.titre}>
      <p className={`${styles['encartTitre'] ?? ''} texte-corps-16`}>{TEXTES_ERREUR_IA.titre}</p>
      {reponse !== '' && (
        <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>« {reponse} »</p>
      )}
      <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>
        {TEXTES_ERREUR_IA.consequence(code)}
      </p>
      <div className={styles['actionsDialogue']}>
        <Bouton variante="secondaire" onClick={surConfirmer}>
          {TEXTES_ERREUR_IA.confirmer}
        </Bouton>
        <Bouton variante="secondaire" onClick={surRejeter}>
          {TEXTES_ERREUR_IA.rejeter}
        </Bouton>
      </div>
    </section>
  )
}
