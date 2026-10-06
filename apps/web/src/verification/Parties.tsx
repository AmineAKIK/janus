import { Bouton, ChampTexte, ChoixConfiance, EditeurCode, ZoneDeTexte } from '@janus/ui'
import type { Confiance } from '@janus/contrats'
import { useState } from 'react'
import { executerCode } from './executeur.ts'
import type { ResultatExecution } from './executeur.ts'
import { TEXTES_VERIFICATION as T, texteEssai } from './textes.ts'
import styles from './Verification.module.css'
import type { Partie, Saisie } from './useVerification.ts'

const MAX_REPONSE = 2000
const ESSAIS_MAX = 2
/** La partie « tâche » n'a pas de choix de confiance à l'écran : le contrat en exige une. */
const CONFIANCE_TACHE: Confiance = 'hesitant'

interface Proprietes {
  readonly partie: Partie
  readonly enAttente: boolean
  readonly indisponible: boolean
  readonly envoyer: (saisie: Saisie) => void
}

function Indisponible({ actif }: { readonly actif: boolean }) {
  return actif ? (
    <p role="alert" className="texte-petit-14">
      {T.indisponible}
    </p>
  ) : null
}

/** Explication ou transfert : une confiance et une réponse libre ; aucune correction n'est montrée. */
export function PartieTexte({ partie, enAttente, indisponible, envoyer }: Proprietes) {
  const [confiance, setConfiance] = useState<Confiance | null>(null)
  const [reponse, setReponse] = useState('')
  const [colle, setColle] = useState(false)
  const [essaye, setEssaye] = useState(false)
  const vide = reponse.trim() === ''
  const explication = partie.type === 'explication'

  return (
    <form
      className={styles['formulaire']}
      noValidate
      onSubmit={(evenement) => {
        evenement.preventDefault()
        setEssaye(true)
        if (!vide && confiance !== null && !enAttente) envoyer({ reponse, confiance, colle })
      }}
    >
      <p className={`${styles['consigne'] ?? ''} texte-sous-titre-18`}>{partie.consigne}</p>
      {partie.extrait !== undefined && (
        <pre className={styles['extrait']}>
          <code>{partie.extrait}</code>
        </pre>
      )}
      <ChoixConfiance
        libelle={T.confiance}
        valeur={confiance}
        onChange={setConfiance}
        obligatoire
      />
      <ZoneDeTexte
        libelle={explication ? T.reponseLibre : T.ecrisIci}
        {...(explication && !(essaye && vide) ? { message: T.aideExplication } : {})}
        {...(essaye && vide ? { message: T.obligatoire, erreur: true } : {})}
        value={reponse}
        maxLength={MAX_REPONSE}
        readOnly={enAttente}
        onChange={(evenement) => {
          setReponse(evenement.currentTarget.value)
        }}
        onPaste={() => {
          setColle(true)
        }}
      />
      {colle && (
        <p role="status" className={`${styles['secondaire'] ?? ''} texte-petit-14`}>
          {T.collage}
        </p>
      )}
      <Indisponible actif={indisponible} />
      <div className={styles['actions']}>
        <Bouton type="submit" variante="principal" chargement={enAttente}>
          {indisponible ? T.reessayer : T.envoyer}
        </Bouton>
      </div>
    </form>
  )
}

function Cas({ resultat }: { readonly resultat: ResultatExecution }) {
  return (
    <ul className={styles['cas']} aria-label={T.tesCas}>
      {resultat.cas.map((cas, rang) => (
        <li key={rang} className={cas.reussi ? styles['reussi'] : styles['rate']}>
          {cas.erreur === undefined
            ? `${JSON.stringify(cas.obtenu)} ${cas.reussi ? '✓' : '✗'}`
            : `✗ ${cas.erreur === 'temps_depasse' ? 'temps dépassé' : cas.erreur}`}
        </li>
      ))}
    </ul>
  )
}

/** Une tâche : un éditeur de code et ses cas, ou un champ de réponse quand la vérification est exacte. */
export function PartieTache({ partie, enAttente, indisponible, envoyer }: Proprietes) {
  const tache = partie.tache
  const [texte, setTexte] = useState('')
  const [essais, setEssais] = useState(0)
  const [resultat, setResultat] = useState<ResultatExecution | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [essaye, setEssaye] = useState(false)
  const code = tache?.mode === 'code'

  async function tester() {
    if (tache?.mode !== 'code') return null
    setEnCours(true)
    const execution = await executerCode(texte, tache.cas)
    setResultat(execution)
    setEnCours(false)
    return execution
  }

  async function soumettre() {
    setEssaye(true)
    if (texte.trim() === '' || enAttente) return
    if (tache?.mode !== 'code') {
      envoyer({ reponse: texte, confiance: CONFIANCE_TACHE, colle: false })
      return
    }
    // Le code déjà testé n'est pas relancé ; sinon l'envoi le teste une dernière fois.
    const execution = resultat?.code === texte ? resultat : await tester()
    if (execution === null) return
    envoyer({
      reponse: texte,
      confiance: CONFIANCE_TACHE,
      colle: false,
      code: { reussis: execution.reussis, total: execution.cas.length },
    })
  }

  const erreur = essaye && texte.trim() === ''
  return (
    <form
      className={styles['formulaire']}
      noValidate
      onSubmit={(evenement) => {
        evenement.preventDefault()
        void soumettre()
      }}
    >
      <p className={`${styles['consigne'] ?? ''} texte-sous-titre-18`}>{partie.consigne}</p>
      {code ? (
        <EditeurCode libelle={T.ton} value={texte} readOnly={enAttente} onChange={setTexte} />
      ) : (
        <ChampTexte
          libelle={T.taReponse}
          value={texte}
          readOnly={enAttente}
          {...(erreur ? { message: T.obligatoire, erreur: true } : {})}
          onChange={(evenement) => {
            setTexte(evenement.currentTarget.value)
          }}
        />
      )}
      {erreur && code && (
        <p role="alert" className="texte-petit-14">
          {T.obligatoire}
        </p>
      )}
      {resultat !== null && <Cas resultat={resultat} />}
      <Indisponible actif={indisponible} />
      <div className={styles['actions']}>
        {code && (
          <>
            <Bouton
              type="button"
              variante="secondaire"
              chargement={enCours}
              disabled={essais >= ESSAIS_MAX || texte.trim() === '' || enAttente}
              onClick={() => {
                setEssais((avant) => avant + 1)
                void tester()
              }}
            >
              {T.tesCas}
            </Bouton>
            <span className="texte-petit-14">{texteEssai(Math.min(essais + 1, ESSAIS_MAX))}</span>
          </>
        )}
        <Bouton type="submit" variante="principal" chargement={enAttente || enCours}>
          {indisponible ? T.reessayer : T.envoyerTache}
        </Bouton>
      </div>
    </form>
  )
}
