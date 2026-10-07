import { LigneLectureSeule } from '@janus/ui'
import { useEffect, useState } from 'react'
import { accorder } from '../../catalogue/calculs.ts'
import { useBoiteEnvoi } from '../../envoi/FournisseurEnvoi.tsx'
import { TEXTES_HORS_LIGNE as T, nombreFrancais } from '../textes.ts'

const OCTETS_PAR_MO = 1_000_000

/** Les réponses qui attendent dans la boîte d'envoi, relues à chaque changement. */
function useEnAttente(): number {
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

/** L'espace utilisé en octets ; `undefined` quand le navigateur ne le mesure pas (ni jsdom). */
const mesurer = (stockage: StorageManager | undefined) =>
  stockage?.estimate().then(({ usage }) => usage)

function useEspace(): number | null {
  const [octets, setOctets] = useState<number | null>(null)
  useEffect(() => {
    let actif = true
    void mesurer(globalThis.navigator.storage)?.then((usage) => {
      if (actif && usage !== undefined) setOctets(usage)
    })
    return () => {
      actif = false
    }
  }, [])
  return octets
}

export function SectionHorsLigne() {
  const enAttente = useEnAttente()
  const espace = useEspace()
  return (
    <>
      <LigneLectureSeule
        libelle={T.synchronisation}
        valeur={
          enAttente === 0
            ? T.synchronise
            : accorder(enAttente, 'réponse en attente', 'réponses en attente')
        }
      />
      <LigneLectureSeule
        libelle={T.espace}
        valeur={
          espace === null
            ? T.espaceInconnu
            : T.espaceValeur(nombreFrancais(espace / OCTETS_PAR_MO, 1))
        }
      />
    </>
  )
}
