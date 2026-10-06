import { BandeauAlerte, Bouton, Dialogue, ZoneDeTexte } from '@janus/ui'
import { useState } from 'react'
import styles from './Detail.module.css'
import { RAISON_MIN, TEXTES_PREREQUIS, texteAllerA, texteConseil } from './textes.ts'

/**
 * Ouvrir un bloc dont les prérequis ne sont pas acquis : la méthode le déconseille, Amine peut le
 * faire en disant pourquoi (3 caractères au moins). La raison part avec l'ouverture.
 */
export function DialoguePrerequis({
  manquants,
  enCours,
  echec,
  surOuvrir,
  surAller,
  surFermeture,
}: {
  readonly manquants: readonly string[]
  readonly enCours: boolean
  readonly echec: boolean
  readonly surOuvrir: (raison: string) => void
  readonly surAller: (code: string) => void
  readonly surFermeture: () => void
}) {
  const [raison, setRaison] = useState('')
  const valide = raison.trim().length >= RAISON_MIN
  const premier = manquants[0]

  return (
    <Dialogue
      titre={TEXTES_PREREQUIS.titre}
      libelleFermer={TEXTES_PREREQUIS.fermer}
      surFermeture={surFermeture}
    >
      <form
        className={styles['formulaire']}
        onSubmit={(evenement) => {
          evenement.preventDefault()
          if (valide && !enCours) surOuvrir(raison.trim())
        }}
      >
        <BandeauAlerte type="avertissement">{texteConseil(manquants)}</BandeauAlerte>
        <ZoneDeTexte
          libelle={TEXTES_PREREQUIS.champ}
          placeholder={TEXTES_PREREQUIS.exemple}
          value={raison}
          onChange={(evenement) => {
            setRaison(evenement.target.value)
          }}
          required
          aria-required="true"
        />
        {echec && <BandeauAlerte type="erreur">{TEXTES_PREREQUIS.erreurServeur}</BandeauAlerte>}
        <div className={styles['actions']}>
          <Bouton type="submit" variante="secondaire" disabled={!valide} chargement={enCours}>
            {TEXTES_PREREQUIS.ouvrirQuandMeme}
          </Bouton>
          {premier !== undefined && (
            <Bouton
              onClick={() => {
                surAller(premier)
              }}
            >
              {texteAllerA(premier)}
            </Bouton>
          )}
        </div>
      </form>
    </Dialogue>
  )
}
