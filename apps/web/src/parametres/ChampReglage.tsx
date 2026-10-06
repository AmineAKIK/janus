import { ModificationReglages } from '@janus/contrats'
import { Bouton, ChampTexte, LigneReglage } from '@janus/ui'
import { useState } from 'react'
import styles from './Parametres.module.css'
import { nombreFrancais, TEXTES_PARAMETRES as T } from './textes.ts'

type CleNombre = 'nouvellesCartesParJour' | 'retentionVisee' | 'questionsDebut'

interface Proprietes {
  readonly cle: CleNombre
  readonly libelle: string
  readonly aide?: string
  readonly valeur: number
  readonly defaut: number
  readonly decimales?: number
  readonly enregistrer: (corps: ModificationReglages) => void
}

/** Un réglage numérique : il s'enregistre à la sortie du champ, borné par le schéma de l'API. */
export function ChampReglage({
  cle,
  libelle,
  aide,
  valeur,
  defaut,
  decimales = 0,
  enregistrer,
}: Proprietes) {
  const affiche = nombreFrancais(valeur, decimales)
  const [saisie, setSaisie] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | undefined>(undefined)

  function valider() {
    if (saisie === null) return
    const nombre = Number(saisie.trim().replace(',', '.'))
    const lecture = ModificationReglages.safeParse({ [cle]: nombre })
    if (saisie.trim() === '' || !lecture.success) {
      setErreur(lecture.success ? 'Saisis un nombre.' : lecture.error.issues[0]?.message)
      return
    }
    setErreur(undefined)
    setSaisie(null)
    if (nombre !== valeur) enregistrer(lecture.data)
  }

  return (
    <div className={styles['reglage']}>
      <LigneReglage
        libelle={libelle}
        {...(aide === undefined ? {} : { aide })}
        controle={
          <ChampTexte
            libelle={libelle}
            inputMode="decimal"
            className={styles['champNombre']}
            value={saisie ?? affiche}
            {...(erreur === undefined ? {} : { erreur: true, message: erreur })}
            onChange={(evenement) => {
              setSaisie(evenement.target.value)
            }}
            onBlur={valider}
          />
        }
      />
      <p className={`${styles['defaut'] ?? ''} texte-legende-12`}>
        {T.parDefaut(nombreFrancais(defaut, decimales))}
        {valeur !== defaut && (
          <Bouton
            type="button"
            variante="texte"
            onClick={() => {
              setErreur(undefined)
              setSaisie(null)
              enregistrer({ [cle]: defaut })
            }}
          >
            {T.revenir}
          </Bouton>
        )}
      </p>
    </div>
  )
}
