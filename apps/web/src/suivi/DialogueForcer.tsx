import { BandeauAlerte, Bouton, Dialogue, LIBELLES_STATUT, ZoneDeTexte } from '@janus/ui'
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
        <label className={`${styles['champ'] ?? ''} texte-petit-14`}>
          {T.champBloc}
          <select
            value={bloc}
            onChange={(evenement) => {
              setBloc(evenement.target.value)
            }}
          >
            {blocs.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className={`${styles['champ'] ?? ''} texte-petit-14`}>
          {T.champStatut}
          <select
            value={statut}
            onChange={(evenement) => {
              setStatut(Statut.parse(evenement.target.value))
            }}
          >
            {Statut.options.map((valeur) => (
              <option key={valeur} value={valeur}>
                {LIBELLES_STATUT[valeur]}
              </option>
            ))}
          </select>
        </label>
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
