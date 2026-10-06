import type { Manque, Statut } from '@janus/contrats'
import { BadgeStatut, LIBELLES_STATUT } from '@janus/ui'
import styles from './Bloc.module.css'
import { STATUT_SUIVANT, TEXTES_ENCARTS, texteManque } from './textesManquants.ts'

/** À l'étape du bilan : le statut calculé et, une phrase par manque, ce qui reste à faire. */
export function EncartBilan({
  statut,
  manque,
  maintenant,
  erreurEnAttente = false,
}: {
  readonly statut: Statut
  readonly manque: readonly Manque[]
  readonly maintenant: string
  /** Une erreur repérée par l'IA attend la décision d'Amine. */
  readonly erreurEnAttente?: boolean
}) {
  const suivant = STATUT_SUIVANT[statut]
  return (
    <div className={styles['encart']}>
      <p className={`${styles['encartTitre'] ?? ''} texte-corps-16`}>
        {TEXTES_ENCARTS.bilanStatut} <BadgeStatut statut={statut} />
      </p>
      {suivant !== null && (
        <>
          <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>
            {TEXTES_ENCARTS.bilanPour(LIBELLES_STATUT[suivant])}
          </p>
          {manque.length === 0 && !erreurEnAttente ? (
            <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>
              {TEXTES_ENCARTS.bilanRien}
            </p>
          ) : (
            <ul className={`${styles['encartListe'] ?? ''} texte-petit-14`}>
              {erreurEnAttente && <li>{TEXTES_ENCARTS.trancherD}</li>}
              {manque.map((element) => (
                <li
                  key={`${element.code}:${(element.questions ?? element.exercices ?? element.erreurs ?? []).join()}`}
                >
                  {texteManque(element, maintenant)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
