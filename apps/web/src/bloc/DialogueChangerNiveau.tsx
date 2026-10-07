import { Niveau } from '@janus/contrats'
import { Bouton, Dialogue, GroupeSegmente, LIBELLES_NIVEAU, ZoneDeTexte } from '@janus/ui'
import { useState } from 'react'
import styles from './Bloc.module.css'

const OPTIONS_NIVEAU = Niveau.options.map((valeur) => ({
  valeur,
  libelle: LIBELLES_NIVEAU[valeur],
}))

export function DialogueChangerNiveau({
  enCours = false,
  surValider,
  surFermeture,
}: {
  readonly enCours?: boolean
  readonly surValider: (niveau: Niveau, raison: string) => void
  readonly surFermeture: () => void
}) {
  const [niveau, setNiveau] = useState<Niveau | null>(null)
  const [raison, setRaison] = useState('')
  const valide = niveau !== null && raison.trim().length >= 10

  return (
    <Dialogue titre="Changer le niveau" surFermeture={surFermeture}>
      <form
        className={styles['formulaireTranchage']}
        onSubmit={(evenement) => {
          evenement.preventDefault()
          if (niveau !== null && valide && !enCours) surValider(niveau, raison.trim())
        }}
      >
        <GroupeSegmente
          libelle="Niveau"
          options={OPTIONS_NIVEAU}
          valeur={niveau}
          onChange={setNiveau}
          obligatoire
        />
        <ZoneDeTexte
          libelle="Raison"
          value={raison}
          onChange={(evenement) => {
            setRaison(evenement.currentTarget.value)
          }}
          required
          aria-required="true"
        />
        <Bouton type="submit" variante="principal" disabled={!valide} chargement={enCours}>
          Changer le niveau
        </Bouton>
      </form>
    </Dialogue>
  )
}
