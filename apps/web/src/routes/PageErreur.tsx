import { BandeauAlerte, Bouton } from '@janus/ui'
import { PageSimple } from './PageSimple.tsx'

/** Frontière d'erreur : un bandeau et un bouton pour recharger la page. */
export function PageErreur() {
  return (
    <>
      <PageSimple titre="Une erreur est survenue" />
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
