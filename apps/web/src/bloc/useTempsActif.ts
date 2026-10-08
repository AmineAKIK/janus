import { nouvelId } from '@janus/contrats'
import type { TypeEtape } from '@janus/contrats'
import { useCallback, useEffect, useRef } from 'react'
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

  const etape = useRef<TypeEtape | undefined>(undefined)
  const envoyerRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const { current } = compteur
    const envoyer = () => {
      const secondes = current.prendre()
      if (secondes < 1) return
      const id = nouvelId(Date.parse(instantReel()))
      void boite.ajouter({
        id,
        route: 'POST /evenements',
        corps: {
          id,
          type: 'temps.actif',
          bloc,
          secondes,
          ...(etape.current === undefined ? {} : { etape: etape.current }),
        },
      })
    }
    envoyerRef.current = envoyer
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

  /** À chaque changement d'étape : le temps déjà compté part avec l'étape quittée. */
  const changerEtape = useCallback((suivante: TypeEtape | undefined) => {
    envoyerRef.current()
    etape.current = suivante
  }, [])

  return {
    changerEtape,
    signalerActivite: () => {
      compteur.current.activite()
    },
  }
}
