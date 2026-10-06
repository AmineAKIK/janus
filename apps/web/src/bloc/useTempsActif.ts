import { nouvelId } from '@janus/contrats'
import { useEffect, useRef } from 'react'
import { instantReel } from '../demo/horlogeDemo.ts'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import { creerCompteurTempsActif } from '../envoi/tempsActif.ts'

/** Le temps actif d'une page de bloc, envoyé toutes les minutes et quand la page se ferme. */
export function useTempsActif(bloc: string) {
  const boite = useBoiteEnvoi()
  const compteur = useRef(
    creerCompteurTempsActif({
      maintenantMs: () => Date.parse(instantReel()),
      visible: () => document.visibilityState === 'visible',
    }),
  )

  useEffect(() => {
    const { current } = compteur
    const envoyer = () => {
      const secondes = current.prendre()
      if (secondes < 1) return
      const id = nouvelId(Date.parse(instantReel()))
      void boite.ajouter({
        id,
        route: 'POST /evenements',
        corps: { id, type: 'temps.actif', bloc, secondes },
      })
    }
    const battement = setInterval(() => {
      current.battre()
    }, 1000)
    const minute = setInterval(envoyer, 60_000)
    const activite = () => {
      current.activite()
    }
    window.addEventListener('keydown', activite)
    window.addEventListener('pointerdown', activite)
    window.addEventListener('pagehide', envoyer)
    return () => {
      clearInterval(battement)
      clearInterval(minute)
      window.removeEventListener('keydown', activite)
      window.removeEventListener('pointerdown', activite)
      window.removeEventListener('pagehide', envoyer)
      envoyer()
    }
  }, [boite, bloc])

  return {
    signalerActivite: () => {
      compteur.current.activite()
    },
  }
}
