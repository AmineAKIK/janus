import { BandeauAlerte, Bouton } from '@janus/ui'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import type { MiseAJourAppli } from './miseAJour.ts'
import styles from './MiseAJour.module.css'

export const TEXTES_MISE_A_JOUR = {
  prete: 'Une nouvelle version est prête.',
  metteAJour: 'Mettre à jour',
  apresEnvoi: 'La mise à jour se fera dès que tes réponses seront envoyées.',
} as const

/**
 * Le bandeau « Une nouvelle version est prête. ». Mettre à jour recharge la page : seulement
 * quand la boîte d'envoi est vide, sinon dès que le dernier message est parti.
 */
export function MiseAJour({ miseAJour }: { readonly miseAJour: MiseAJourAppli }) {
  const boite = useBoiteEnvoi()
  const prete = useSyncExternalStore(miseAJour.abonner, miseAJour.versionPrete)
  const [demandee, setDemandee] = useState(false)
  const [entrees, setEntrees] = useState<number | null>(null)

  useEffect(() => {
    let actif = true
    const relire = () => {
      void boite.entrees().then((courantes) => {
        if (actif) setEntrees(courantes.length)
      })
    }
    relire()
    const arreter = boite.abonner(relire)
    return () => {
      actif = false
      arreter()
    }
  }, [boite])

  const videe = entrees === 0
  useEffect(() => {
    if (demandee && videe) void miseAJour.appliquer()
  }, [demandee, videe, miseAJour])

  if (!prete) return null
  return (
    <div className={styles['bandeau']}>
      <BandeauAlerte type="info">
        <span>{TEXTES_MISE_A_JOUR.prete}</span>{' '}
        {demandee ? (
          <span>{TEXTES_MISE_A_JOUR.apresEnvoi}</span>
        ) : (
          <Bouton
            type="button"
            variante="texte"
            onClick={() => {
              setDemandee(true)
            }}
          >
            {TEXTES_MISE_A_JOUR.metteAJour}
          </Bouton>
        )}
      </BandeauAlerte>
    </div>
  )
}
