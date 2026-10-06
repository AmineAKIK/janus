import { useEffect, useRef, useState } from 'react'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import {
  blocDeEntree,
  derniereReponseGardee,
  etatIndicateur,
  reponsesGardees,
} from '../envoi/indicateur.ts'
import type { EtatIndicateur } from '../envoi/indicateur.ts'
import type { EntreeEnvoi } from '../envoi/stockageEnvoi.ts'

/** Ce que la boîte d'envoi sait d'un bloc : l'indicateur, les réponses gardées, le stockage. */
export function useEtatEnvoi(bloc: string) {
  const boite = useBoiteEnvoi()
  const [entrees, setEntrees] = useState<readonly EntreeEnvoi[]>([])
  const [reseauManque, setReseauManque] = useState(boite.reseauManque())
  const precedent = useRef<EtatIndicateur>('enregistre')

  useEffect(() => {
    let actif = true
    const relire = () => {
      setReseauManque(boite.reseauManque())
      void boite.entrees().then((courantes) => {
        if (actif) setEntrees(courantes)
      })
    }
    relire()
    const arreter = boite.abonner(relire)
    return () => {
      actif = false
      arreter()
    }
  }, [boite])

  const gardees = reponsesGardees(entrees, bloc)
  const etat = etatIndicateur({
    reseauManque,
    gardees: gardees.length,
    enAttente: entrees.filter((entree) => blocDeEntree(entree) === bloc).length,
    precedent: precedent.current,
  })
  precedent.current = etat
  return {
    etat,
    gardees: gardees.length,
    derniereReponse: derniereReponseGardee(entrees, bloc),
    stockageIndisponible: boite.stockageIndisponible(),
  }
}
