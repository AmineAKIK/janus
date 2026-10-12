import { ROUTES } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { Selecteur } from '@janus/ui'
import { useEcriture, useLecture } from '../api/requetes.tsx'
import styles from './SelecteurFormation.module.css'

/**
 * Choisit la formation que l'appli affiche (Aujourd'hui, Suivi, révisions). L'autre est gelée :
 * son temps s'arrête et reprend à sa réouverture. Rien ne s'affiche tant qu'il n'y en a qu'une.
 */
export function SelecteurFormation() {
  const client = useQueryClient()
  const formations = useLecture(ROUTES['GET /formations'], {})
  const reglages = useLecture(ROUTES['GET /reglages'], {})
  const ecriture = useEcriture(ROUTES['PATCH /reglages'])

  const liste = formations.data?.formations ?? []
  if (liste.length < 2 || reglages.data === undefined) return null
  const active = liste.find(({ active: estActive }) => estActive) ?? liste[0]

  return (
    <div className={styles['zone']}>
      <Selecteur
        libelle="Formation"
        options={liste.map(({ id, titre }) => ({ valeur: id, libelle: titre }))}
        valeur={active?.id ?? ''}
        disabled={ecriture.isPending}
        onChange={(formationActive) => {
          ecriture.mutate(
            { corps: { formationActive } },
            {
              // Tout ce qu'on affiche dépend de la formation active : on relit tout.
              onSuccess: () => void client.invalidateQueries(),
            },
          )
        }}
      />
      {ecriture.isError && (
        <p role="alert" className="texte-petit-14">
          Impossible de changer de formation. Réessaie.
        </p>
      )}
    </div>
  )
}
