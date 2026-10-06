import { ROUTES } from '@janus/contrats'
import { Bouton, ChoixConfiance, ZoneDeTexte } from '@janus/ui'
import type { Confiance } from '@janus/contrats'
import { useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { CorrectionAffichee } from './CorrectionAffichee.tsx'
import { DialogueQuitter } from './DialogueQuitter.tsx'
import { FinDeSerie } from './FinDeSerie.tsx'
import styles from './Questions.module.css'
import { TEXTES_QUESTIONS as T, texteRang } from './textes.ts'
import { useSerie } from './useSerie.ts'
import type { EtatQuestion } from './useSerie.ts'

const MAX_REPONSE = 2000
const SEUIL_COMPTEUR = 1800
const JE_NE_SAIS_PAS = 'Je ne sais pas'

function Saisie({
  etat,
  enAttente,
  envoyer,
}: {
  readonly etat: EtatQuestion
  readonly enAttente: boolean
  readonly envoyer: (saisie: { confiance: Confiance; reponse: string; colle: boolean }) => void
}) {
  const depart = etat.phase === 'saisie' || etat.phase === 'corrigee' ? null : etat
  const [confiance, setConfiance] = useState<Confiance | null>(depart?.confiance ?? null)
  const [reponse, setReponse] = useState(depart?.reponse ?? '')
  const [colle, setColle] = useState(depart?.colle ?? false)
  const peutCorriger = confiance !== null && reponse.trim() !== '' && !enAttente

  return (
    <form
      className={styles['formulaire']}
      onSubmit={(evenement) => {
        evenement.preventDefault()
        if (confiance !== null && peutCorriger) envoyer({ confiance, reponse, colle })
      }}
    >
      <ChoixConfiance valeur={confiance} onChange={setConfiance} obligatoire />
      <ZoneDeTexte
        libelle={T.reponse}
        message={T.aide}
        value={reponse}
        maxLength={MAX_REPONSE}
        {...(reponse.length > SEUIL_COMPTEUR ? { maxCaracteres: MAX_REPONSE } : {})}
        readOnly={enAttente}
        onChange={(evenement) => {
          setReponse(evenement.currentTarget.value)
        }}
        onPaste={() => {
          setColle(true)
        }}
      />
      {enAttente && (
        <p role="status" className={`${styles['attente'] ?? ''} texte-petit-14`}>
          {T.attente}
        </p>
      )}
      <div className={styles['actions']}>
        <Bouton type="submit" variante="principal" disabled={!peutCorriger}>
          {T.corriger}
        </Bouton>
        <Bouton
          type="button"
          variante="secondaire"
          disabled={enAttente}
          onClick={() => {
            envoyer({ confiance: 'hasard', reponse: JE_NE_SAIS_PAS, colle: false })
          }}
        >
          {T.jeNeSaisPas}
        </Bouton>
      </div>
    </form>
  )
}

export function PageQuestions() {
  const serie = useSerie()
  const aujourdhui = useLecture(ROUTES['GET /aujourdhui'], {})
  const [quitter, setQuitter] = useState(false)
  const total = serie.questions.length

  let contenu
  if (serie.phase === 'erreur') contenu = <Erreur reessayer={serie.recharger} />
  else if (serie.phase === 'chargement') contenu = <Chargement nombre={2} />
  else if (total === 0) contenu = <p className="texte-corps-16">{T.aucune}</p>
  else if (serie.index >= total) {
    contenu = (
      <FinDeSerie
        questions={serie.questions}
        etats={serie.etats}
        {...(aujourdhui.data === undefined ? {} : { aujourdhui: aujourdhui.data })}
      />
    )
  } else {
    const question = serie.questions[serie.index]
    const etat = serie.etats[serie.index]
    if (question !== undefined && etat !== undefined) {
      contenu =
        etat.phase === 'corrigee' ? (
          <CorrectionAffichee
            etat={etat}
            titreBloc={
              aujourdhui.data?.module?.blocs.find(({ bloc }) => bloc === etat.bloc)?.titre_court ??
              ''
            }
            dernier={serie.index === total - 1}
            surSuivante={serie.suivante}
            echange={{
              enAttente: serie.enRelance.has(question.id),
              relancer: (texte, conteste) => {
                serie.relancer(question, etat, texte, conteste)
              },
              donnerAccord: (accord) => {
                serie.donnerAccord(etat.correction.id, accord)
              },
            }}
          />
        ) : (
          <>
            <p className={`${styles['enonce'] ?? ''} texte-sous-titre-18`}>{question.question}</p>
            {etat.phase === 'indisponible' && (
              <div className={styles['indisponible']}>
                <p role="alert" className="texte-petit-14">
                  {T.indisponible}
                </p>
                <Bouton
                  type="button"
                  variante="secondaire"
                  onClick={() => {
                    serie.envoyer(question, {
                      confiance: etat.confiance,
                      reponse: etat.reponse,
                      colle: etat.colle,
                    })
                  }}
                >
                  {T.reessayer}
                </Bouton>
              </div>
            )}
            <Saisie
              key={`${question.id}:${etat.phase}`}
              etat={etat}
              enAttente={etat.phase === 'attente'}
              envoyer={(saisie) => {
                serie.envoyer(question, saisie)
              }}
            />
          </>
        )
    }
  }

  return (
    <div className={styles['page']}>
      <header className={styles['entete']}>
        <button
          type="button"
          className={`${styles['quitter'] ?? ''} texte-petit-14`}
          onClick={() => {
            setQuitter(true)
          }}
        >
          <span aria-hidden="true">×</span> {T.quitter}
        </button>
        <h1
          tabIndex={-1}
          aria-label={`${T.titre}${T.suiteDuTitre}`}
          className={`${styles['titre'] ?? ''} texte-sous-titre-18`}
        >
          {T.titre}
        </h1>
        {total > 0 && (
          <p className={`${styles['rang'] ?? ''} texte-petit-14`}>
            {texteRang(Math.min(serie.index + 1, total), total)}
          </p>
        )}
      </header>
      {contenu}
      {quitter && (
        <DialogueQuitter
          rang={Math.min(serie.index + 1, Math.max(total, 1))}
          surContinuer={() => {
            setQuitter(false)
          }}
        />
      )}
    </div>
  )
}
