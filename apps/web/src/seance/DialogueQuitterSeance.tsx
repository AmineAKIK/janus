import { Bouton, Dialogue } from '@janus/ui'
import styles from './Seance.module.css'
import { TEXTES_SEANCE as T } from './textes.ts'

/**
 * La question posée quand on quitte une séance en cours : rester (le bouton qui a le focus) ou
 * partir. Le libellé de la sortie dit ce qu'elle garde (« Quitter », « Reprendre plus tard »).
 */
export function DialogueQuitterSeance({
  titre,
  texte,
  libelleSortie = T.quitter,
  boutonsEtires = false,
  surSortie,
  surContinuer,
}: {
  readonly titre: string
  readonly texte: string
  readonly libelleSortie?: string
  /** Les deux boutons se partagent la largeur du dialogue. */
  readonly boutonsEtires?: boolean
  readonly surSortie: () => void
  readonly surContinuer: () => void
}) {
  return (
    <Dialogue titre={titre} surFermeture={surContinuer}>
      <p className="texte-corps-16">{texte}</p>
      <div className={`${styles['actions'] ?? ''} ${boutonsEtires ? (styles['etire'] ?? '') : ''}`}>
        <Bouton type="button" variante="secondaire" onClick={surSortie}>
          {libelleSortie}
        </Bouton>
        <Bouton type="button" variante="principal" data-focus-initial onClick={surContinuer}>
          {T.continuer}
        </Bouton>
      </div>
    </Dialogue>
  )
}
