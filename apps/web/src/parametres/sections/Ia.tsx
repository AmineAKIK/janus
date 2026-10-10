import { ROUTES } from '@janus/contrats'
import type { ModificationReglages, Reglages } from '@janus/contrats'
import { BandeauAlerte, Bouton, ChampTexte, LigneLectureSeule, LigneReglage } from '@janus/ui'
import { useState } from 'react'
import { useLecture } from '../../api/requetes.tsx'
import { euros } from '../../suivi/textes.ts'
import styles from '../Parametres.module.css'
import { nombreFrancais, TEXTES_IA as T, TEXTES_PARAMETRES as TP } from '../textes.ts'

const MILLIONIEMES = 1_000_000
const PLAFOND_MAX_EUROS = 100
const DEFAUT_MILLIONIEMES = 10_000_000

interface Proprietes {
  readonly reglages: Reglages
  readonly enregistrer: (corps: ModificationReglages) => void
}

export function SectionIa({ reglages, enregistrer }: Proprietes) {
  const tableau = useLecture(ROUTES['GET /tableau-de-bord'], { requete: {} })
  const [saisie, setSaisie] = useState<string | null>(null)
  const [erreur, setErreur] = useState(false)
  const plafond = reglages.plafondIaMillioniemes
  const depense = tableau.data?.cout_ia.depense_millioniemes

  function valider() {
    if (saisie === null) return
    const euros = Number(saisie.trim().replace(',', '.'))
    if (saisie.trim() === '' || !(euros >= 0 && euros <= PLAFOND_MAX_EUROS)) {
      setErreur(true)
      return
    }
    setErreur(false)
    setSaisie(null)
    const millioniemes = Math.round(euros * MILLIONIEMES)
    if (millioniemes !== plafond) enregistrer({ plafondIaMillioniemes: millioniemes })
  }

  return (
    <>
      {depense !== undefined && plafond > 0 && depense >= plafond && (
        <BandeauAlerte type="erreur">{T.plafondAtteint}</BandeauAlerte>
      )}
      {depense !== undefined && (
        <LigneLectureSeule libelle={T.depense} valeur={`${euros(depense)} sur ${euros(plafond)}`} />
      )}
      <div className={styles['reglage']}>
        <LigneReglage
          libelle={T.plafond}
          controle={
            <ChampTexte
              libelle={T.plafond}
              libelleMasque
              inputMode="decimal"
              className={styles['champNombre']}
              value={saisie ?? nombreFrancais(plafond / MILLIONIEMES, 2)}
              {...(erreur ? { erreur: true, message: T.plafondErreur } : {})}
              onChange={(evenement) => {
                setSaisie(evenement.target.value)
              }}
              onBlur={valider}
            />
          }
        />
        <p className={`${styles['defaut'] ?? ''} texte-legende-12`}>
          {TP.parDefaut(euros(DEFAUT_MILLIONIEMES))}
          {plafond !== DEFAUT_MILLIONIEMES && (
            <Bouton
              type="button"
              variante="texte"
              onClick={() => {
                setErreur(false)
                setSaisie(null)
                enregistrer({ plafondIaMillioniemes: DEFAUT_MILLIONIEMES })
              }}
            >
              {TP.revenir}
            </Bouton>
          )}
        </p>
      </div>
      <LigneLectureSeule libelle={T.limite} valeur={T.limiteValeur(reglages.appelsIaParHeure)} />
      <p className="texte-petit-14">{T.confidentialite}</p>
    </>
  )
}
