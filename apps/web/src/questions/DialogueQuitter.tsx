import { Bouton, Dialogue } from '@janus/ui'
import styles from './Questions.module.css'
import { TEXTES_QUESTIONS as T, texteReprise } from './textes.ts'

export function DialogueQuitter({
  rang,
  surContinuer,
}: {
  readonly rang: number
  readonly surContinuer: () => void
}) {
  return (
    <Dialogue titre={T.dialogueTitre} surFermeture={surContinuer}>
      <p className="texte-corps-16">{texteReprise(rang)}</p>
      <div className={styles['actions']}>
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => {
            window.location.hash = '/'
          }}
        >
          {T.reprendrePlusTard}
        </Bouton>
        <Bouton type="button" variante="principal" data-focus-initial onClick={surContinuer}>
          {T.continuer}
        </Bouton>
      </div>
    </Dialogue>
  )
}
