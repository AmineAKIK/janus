import { useEffect, useState } from 'react'
import { useBoiteEnvoi } from './FournisseurEnvoi.tsx'

/** Les réponses qui attendent dans la boîte d'envoi, relues à chaque changement. */
export function useEnAttente(): number {
  const boite = useBoiteEnvoi()
  const [nombre, setNombre] = useState(0)
  useEffect(() => {
    let actif = true
    const relire = () => {
      void boite.entrees().then((entrees) => {
        if (actif) setNombre(entrees.length)
      })
    }
    relire()
    const arreter = boite.abonner(relire)
    return () => {
      actif = false
      arreter()
    }
  }, [boite])
  return nombre
}
