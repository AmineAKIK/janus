import { ErreurApi, ROUTES } from '@janus/contrats'
import { Bouton, ChampMotDePasse, Dialogue } from '@janus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useEcriture } from '../../api/requetes.tsx'
import { supprimerStockageIndexedDB } from '../../envoi/stockageEnvoi.ts'
import styles from '../Parametres.module.css'
import { TEXTES_COMPTE, TEXTES_ZONE as T } from '../textes.ts'

export function SupprimerCompte({ surFermeture }: { readonly surFermeture: () => void }) {
  const client = useQueryClient()
  const suppression = useEcriture(ROUTES['DELETE /compte'])
  const [motDePasse, setMotDePasse] = useState('')
  const [tente, setTente] = useState(false)
  const manquant = tente && motDePasse === ''
  const refus = suppression.error instanceof ErreurApi ? suppression.error.detail : undefined

  return (
    <Dialogue titre={T.titreDialogue} surFermeture={surFermeture}>
      <form
        noValidate
        className={styles['formulaire']}
        onSubmit={(evenement) => {
          evenement.preventDefault()
          setTente(true)
          if (motDePasse === '') return
          suppression.mutate(
            { corps: { mot_de_passe: motDePasse } },
            {
              onSuccess: () => {
                client.clear()
                void supprimerStockageIndexedDB().then(() => {
                  window.location.hash = '/connexion'
                })
              },
            },
          )
        }}
      >
        <ul className={styles['liste']}>
          {T.liste.map((ligne) => (
            <li key={ligne} className="texte-corps-16">
              {ligne}
            </li>
          ))}
        </ul>
        <div>
          <p className="texte-petit-14">{T.avant}</p>
          <p className="texte-legende-12">{T.exporte}</p>
        </div>
        <ChampMotDePasse
          libelle={T.motDePasse}
          autoComplete="current-password"
          value={motDePasse}
          onChange={(evenement) => {
            setMotDePasse(evenement.target.value)
          }}
          {...(manquant
            ? { erreur: true, message: TEXTES_COMPTE.obligatoire }
            : refus === undefined
              ? {}
              : { erreur: true, message: refus })}
        />
        <div className={styles['actions']}>
          <Bouton type="button" variante="secondaire" onClick={surFermeture}>
            {T.annuler}
          </Bouton>
          <Bouton type="submit" variante="danger" chargement={suppression.isPending}>
            {T.definitivement}
          </Bouton>
        </div>
      </form>
    </Dialogue>
  )
}
