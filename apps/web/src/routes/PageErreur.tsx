import { BandeauAlerte, Bouton } from '@janus/ui'
import { PageProvisoire } from './PageProvisoire.tsx'

/** Frontière d'erreur : un bandeau et un bouton pour recharger la page. */
export function PageErreur() {
  return (
    <>
      <PageProvisoire titre="Une erreur est survenue" />
      <BandeauAlerte type="erreur">
        <p>Quelque chose s’est mal passé. Recharge la page pour réessayer.</p>
        <Bouton
          variante="secondaire"
          onClick={() => {
            window.location.reload()
          }}
        >
          Recharger
        </Bouton>
      </BandeauAlerte>
    </>
  )
}
