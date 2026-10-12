import { BandeauAlerte, Bouton, Dialogue, LIBELLES_STATUT, Selecteur, ZoneDeTexte } from '@janus/ui'
import { Statut } from '@janus/contrats'
import { useState } from 'react'
import styles from './Suivi.module.css'
import { RAISON_FORCAGE_MIN, TEXTES_SUIVI as T } from './textes.ts'

export function DialogueForcer({
  blocs,
  enCours,
  echec,
  surForcer,
  surFermeture,
}: {
  readonly blocs: readonly string[]
  readonly enCours: boolean
  readonly echec: boolean
  readonly surForcer: (bloc: string, statut: Statut, raison: string) => void
  readonly surFermeture: () => void
}) {
  const [bloc, setBloc] = useState(blocs[0] ?? '')
  const [statut, setStatut] = useState<Statut>('acquis')
  const [raison, setRaison] = useState('')
  const valide = bloc !== '' && raison.trim().length >= RAISON_FORCAGE_MIN

  return (
    <Dialogue titre={T.dialogueTitre} libelleFermer={T.fermer} surFermeture={surFermeture}>
      <form
        className={styles['formulaire']}
        onSubmit={(evenement) => {
          evenement.preventDefault()
          if (valide && !enCours) surForcer(bloc, statut, raison.trim())
        }}
      >
        <Selecteur
          libelle={T.champBloc}
          valeur={bloc}
          options={blocs.map((code) => ({ valeur: code, libelle: code }))}
          onChange={setBloc}
          data-focus-initial
        />
        <Selecteur
          libelle={T.champStatut}
          valeur={statut}
          options={Statut.options.map((valeur) => ({ valeur, libelle: LIBELLES_STATUT[valeur] }))}
          onChange={(valeur) => {
            setStatut(Statut.parse(valeur))
          }}
        />
        <ZoneDeTexte
          libelle={T.champRaison}
          message={T.raisonAide}
          value={raison}
          onChange={(evenement) => {
            setRaison(evenement.target.value)
          }}
          required
          aria-required="true"
        />
        {echec && <BandeauAlerte type="erreur">{T.erreurServeur}</BandeauAlerte>}
        <Bouton type="submit" variante="principal" disabled={!valide} chargement={enCours}>
          {T.valider}
        </Bouton>
      </form>
    </Dialogue>
  )
}
