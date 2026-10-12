import { BandeauAlerte } from '@janus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { derniereMiseAJour } from '../donnees/instantane.ts'
import styles from './BandeauHorsConnexion.module.css'
import { useEnLigne } from './useEnLigne.ts'

export const TEXTES_HORS_CONNEXION = {
  titre: 'Hors connexion.',
  donnees: (instant: string) => `Données du ${instant}.`,
  envoi: 'Les réponses seront envoyées dès le retour du réseau.',
} as const

const FORMAT_INSTANT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** « 12 oct., 14:03 » écrit « 12 oct. à 14:03 ». */
export function texteInstant(instant: number): string {
  return FORMAT_INSTANT.format(instant).replace(', ', ' à ')
}

/**
 * Dit que l'appli est hors connexion et de quand date ce qu'elle montre. Rien en ligne : ni bandeau
 * ni réserve de place.
 */
export function BandeauHorsConnexion() {
  const enLigne = useEnLigne()
  const client = useQueryClient()
  if (enLigne) return null
  const instant = derniereMiseAJour(client)
  return (
    <div className={styles['bandeau']}>
      <BandeauAlerte type="info">
        {TEXTES_HORS_CONNEXION.titre}{' '}
        {instant !== null && `${TEXTES_HORS_CONNEXION.donnees(texteInstant(instant))} `}
        {TEXTES_HORS_CONNEXION.envoi}
      </BandeauAlerte>
    </div>
  )
}
