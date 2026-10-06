import { Bouton, Dialogue } from '@janus/ui'
import styles from './Bloc.module.css'
import { TEXTES_REVOIR_COURS } from './textes.ts'

/** Quitter une série en cours pour revoir le cours : la page marque elle-même le retour au cours. */
export function DialogueRevoirCours({
  surRester,
  surRevoir,
}: {
  readonly surRester: () => void
  readonly surRevoir: () => void
}) {
  return (
    <Dialogue
      titre={TEXTES_REVOIR_COURS.titre}
      libelleFermer={TEXTES_REVOIR_COURS.fermer}
      surFermeture={surRester}
    >
      <p className="texte-corps-16">{TEXTES_REVOIR_COURS.corps}</p>
      <div className={styles['actionsDialogue']}>
        <Bouton data-focus-initial onClick={surRester}>
          {TEXTES_REVOIR_COURS.rester}
        </Bouton>
        <Bouton variante="secondaire" onClick={surRevoir}>
          {TEXTES_REVOIR_COURS.revoir}
        </Bouton>
      </div>
    </Dialogue>
  )
}
