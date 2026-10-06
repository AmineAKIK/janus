import { ROUTES } from '@janus/contrats'
import type { ErreurApi } from '@janus/contrats'
import { Bouton, ChampMotDePasse, Dialogue } from '@janus/ui'
import { useState } from 'react'
import { useEcriture } from '../../api/requetes.tsx'
import styles from '../Parametres.module.css'
import { TEXTES_COMPTE as T } from '../textes.ts'

const octets = (texte: string) => new TextEncoder().encode(texte).length

/** Les erreurs de saisie, champ par champ, avant tout envoi. */
function verifier(ancien: string, nouveau: string, confirmation: string) {
  return {
    ancien: ancien === '' ? T.obligatoire : undefined,
    nouveau:
      nouveau.length < 12
        ? 'Le mot de passe doit faire au moins 12 caractères.'
        : octets(nouveau) > 72
          ? 'Le mot de passe doit faire 72 octets au plus.'
          : undefined,
    confirmation: confirmation === nouveau ? undefined : T.differents,
  }
}

export function ChangerMotDePasse({
  surFermeture,
  surChange,
}: {
  readonly surFermeture: () => void
  readonly surChange: () => void
}) {
  const ecriture = useEcriture(ROUTES['PATCH /moi/mot-de-passe'])
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [tente, setTente] = useState(false)
  const erreurs = verifier(ancien, nouveau, confirmation)
  const refus: ErreurApi | undefined =
    ecriture.error !== null && 'detail' in ecriture.error
      ? (ecriture.error as ErreurApi)
      : undefined

  function envoyer() {
    setTente(true)
    if (erreurs.ancien !== undefined || erreurs.nouveau !== undefined) return
    if (erreurs.confirmation !== undefined) return
    ecriture.mutate({ corps: { ancien, nouveau } }, { onSuccess: surChange })
  }

  const message = (cle: keyof typeof erreurs) => (tente ? erreurs[cle] : undefined)
  const erreurDe = (cle: keyof typeof erreurs) => {
    const texte = message(cle)
    return texte === undefined ? {} : { erreur: true, message: texte }
  }
  return (
    <Dialogue titre={T.changer} surFermeture={surFermeture}>
      <form
        onSubmit={(evenement) => {
          evenement.preventDefault()
          envoyer()
        }}
        noValidate
        className={styles['formulaire']}
      >
        <ChampMotDePasse
          libelle={T.actuel}
          autoComplete="current-password"
          value={ancien}
          onChange={(evenement) => {
            setAncien(evenement.target.value)
          }}
          {...erreurDe('ancien')}
        />
        {refus !== undefined && (
          <p role="alert" className="texte-petit-14">
            {refus.detail}
          </p>
        )}
        <ChampMotDePasse
          libelle={T.nouveau}
          autoComplete="new-password"
          value={nouveau}
          onChange={(evenement) => {
            setNouveau(evenement.target.value)
          }}
          message={message('nouveau') ?? T.nouveauAide}
          erreur={message('nouveau') !== undefined}
        />
        <ChampMotDePasse
          libelle={T.confirmation}
          autoComplete="new-password"
          value={confirmation}
          onChange={(evenement) => {
            setConfirmation(evenement.target.value)
          }}
          {...erreurDe('confirmation')}
        />
        <div className={styles['actions']}>
          <Bouton type="button" variante="secondaire" onClick={surFermeture}>
            {T.annuler}
          </Bouton>
          <Bouton type="submit" variante="principal" disabled={ecriture.isPending}>
            {T.enregistrer}
          </Bouton>
        </div>
      </form>
    </Dialogue>
  )
}
