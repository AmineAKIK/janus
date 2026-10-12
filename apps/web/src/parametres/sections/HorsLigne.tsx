import { Bouton, LigneLectureSeule, LigneReglage } from '@janus/ui'
import { useEffect, useState } from 'react'
import { accorder } from '../../catalogue/calculs.ts'
import { useEnAttente } from '../../envoi/useEnAttente.ts'
import { useInstallation } from '../../pwa/useInstallation.ts'
import { TEXTES_HORS_LIGNE as T, TEXTES_INSTALLATION as I, nombreFrancais } from '../textes.ts'

const OCTETS_PAR_MO = 1_000_000

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

/** Installer l'appli, ou dire qu'elle l'est : rien du tout quand le navigateur ne sait pas l'installer. */
function LigneInstallation() {
  const { etat, installer } = useInstallation()
  switch (etat) {
    case 'installee':
      return <LigneLectureSeule libelle={I.application} valeur={I.installee} />
    case 'installable':
      return (
        <LigneReglage
          libelle={I.installer}
          aide={I.installerAide}
          controle={
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => {
                void installer()
              }}
            >
              {I.bouton}
            </Bouton>
          }
        />
      )
    case 'manuelle':
      return <LigneLectureSeule libelle={I.installer} valeur={I.manuelle} />
    case 'indisponible':
      return null
  }
}

export function SectionHorsLigne() {
  const enAttente = useEnAttente()
  const espace = useEspace()
  return (
    <>
      <LigneInstallation />
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
