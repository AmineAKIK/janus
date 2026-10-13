import {
  Bouton,
  CaseACocher,
  ChampTexte,
  ChoixConfiance,
  EditeurCode,
  Selecteur,
  ZoneDeTexte,
} from '@janus/ui'
import type { Confiance } from '@janus/contrats'
import { useState } from 'react'
import seance from '../seance/Seance.module.css'
import { useSaisieReponse } from '../seance/useSaisieReponse.ts'
import { executerCode } from './executeur.ts'
import type { ResultatExecution } from './executeur.ts'
import { LIBELLES_AIDE, TEXTES_VERIFICATION as T, texteEssai } from './textes.ts'
import styles from './Verification.module.css'
import type { Partie, Saisie } from './useVerification.ts'

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
  const { confiance, setConfiance, reponse, colle, vide, champ } = useSaisieReponse()
  const [essaye, setEssaye] = useState(false)
  const explication = partie.type === 'explication'

  return (
    <form
      className={seance['colonne']}
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
        {...champ}
        readOnly={enAttente}
      />
      {colle && (
        <p role="status" className={`${seance['secondaire'] ?? ''} texte-petit-14`}>
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

/** Une tâche par constat : les critères fixés d'avance, que l'apprenant coche, et son niveau d'aide. */
export function PartieConstat({ partie, enAttente, indisponible, envoyer }: Proprietes) {
  const criteres = partie.tache?.mode === 'constat' ? partie.tache.criteres : []
  const [coches, setCoches] = useState<readonly number[]>([])
  const [aide, setAide] = useState('0')

  return (
    <form
      className={seance['colonne']}
      noValidate
      onSubmit={(evenement) => {
        evenement.preventDefault()
        if (enAttente) return
        const niveau = Number(aide)
        envoyer({
          reponse: `Constat : ${String(coches.length)} critère(s) sur ${String(criteres.length)}, aide ${aide}.`,
          confiance: CONFIANCE_TACHE,
          colle: false,
          constat: {
            coches,
            aide: niveau === 1 || niveau === 2 || niveau === 3 || niveau === 4 ? niveau : 0,
          },
        })
      }}
    >
      <p className={`${styles['consigne'] ?? ''} texte-sous-titre-18`}>{partie.consigne}</p>
      <fieldset className={styles['criteres']}>
        <legend className="texte-petit-14">{T.criteres}</legend>
        {criteres.map((critere, rang) => (
          <CaseACocher
            key={rang}
            libelle={critere}
            checked={coches.includes(rang)}
            disabled={enAttente}
            onChange={(evenement) => {
              const cochee = evenement.currentTarget.checked
              setCoches((avant) =>
                cochee ? [...avant, rang] : avant.filter((autre) => autre !== rang),
              )
            }}
          />
        ))}
      </fieldset>
      <p className="texte-petit-14">{T.criteresAide}</p>
      <Selecteur
        libelle={T.niveauAide}
        options={LIBELLES_AIDE.map((libelle, rang) => ({ valeur: String(rang), libelle }))}
        valeur={aide}
        onChange={setAide}
        disabled={enAttente}
      />
      <Indisponible actif={indisponible} />
      <div className={styles['actions']}>
        <Bouton type="submit" variante="principal" chargement={enAttente}>
          {indisponible ? T.reessayer : T.envoyerTache}
        </Bouton>
      </div>
    </form>
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
      className={seance['colonne']}
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
