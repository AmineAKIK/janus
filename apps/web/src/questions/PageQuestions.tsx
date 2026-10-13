import { ROUTES, TAILLE_MAX_REPONSE } from '@janus/contrats'
import type { Confiance } from '@janus/contrats'
import { Bouton, ChoixConfiance, ZoneDeTexte } from '@janus/ui'
import { useId, useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { aller } from '../routes/navigation.ts'
import { DialogueQuitterSeance } from '../seance/DialogueQuitterSeance.tsx'
import { EnteteSeance } from '../seance/EnteteSeance.tsx'
import { titreCourtDuBloc } from '../seance/etapeSuivante.ts'
import seance from '../seance/Seance.module.css'
import { useSaisieReponse } from '../seance/useSaisieReponse.ts'
import { CorrectionAffichee } from './CorrectionAffichee.tsx'
import { FinDeSerie } from './FinDeSerie.tsx'
import styles from './Questions.module.css'
import { JE_NE_SAIS_PAS, TEXTES_QUESTIONS as T, texteRang, texteReprise } from './textes.ts'
import { useSerie } from './useSerie.ts'
import type { EtatQuestion } from './useSerie.ts'

const SEUIL_COMPTEUR = 1800

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
  const { confiance, setConfiance, reponse, colle, vide, champ } = useSaisieReponse(depart)
  const peutCorriger = confiance !== null && !vide && !enAttente
  const idRaison = useId()
  // Ce qui manque quand le bouton est grisé ; rien tant que la correction est en cours.
  let raison: string | null = null
  if (!enAttente && confiance === null) raison = T.manqueConfiance
  else if (!enAttente && vide) raison = T.manqueReponse

  return (
    <form
      className={seance['colonne']}
      onSubmit={(evenement) => {
        evenement.preventDefault()
        if (confiance !== null && peutCorriger) envoyer({ confiance, reponse, colle })
      }}
    >
      <ChoixConfiance valeur={confiance} onChange={setConfiance} obligatoire />
      <ZoneDeTexte
        libelle={T.reponse}
        message={T.aide}
        {...champ}
        {...(reponse.length > SEUIL_COMPTEUR ? { maxCaracteres: TAILLE_MAX_REPONSE } : {})}
        readOnly={enAttente}
      />
      {enAttente && (
        <p role="status" className={`${seance['secondaire'] ?? ''} texte-petit-14`}>
          {T.attente}
        </p>
      )}
      {raison !== null && (
        <p id={idRaison} className={`${seance['secondaire'] ?? ''} texte-petit-14`}>
          {raison}
        </p>
      )}
      <div className={seance['actions']}>
        <Bouton
          type="submit"
          variante="principal"
          disabled={!peutCorriger}
          aria-describedby={raison === null ? undefined : idRaison}
        >
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
            titreBloc={titreCourtDuBloc(aujourdhui.data?.module?.blocs, etat.bloc ?? '')}
            dernier={serie.index === total - 1}
            surSuivante={serie.suivante}
            echange={{
              enAttente: serie.enRelance.has(question.id),
              refus: serie.relancesRefusees[question.id] ?? null,
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
                  {etat.plafond ? T.plafond : T.indisponible}
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
    <div className={seance['page']}>
      <EnteteSeance
        titre={T.titre}
        libelleTitre={`${T.titre}${T.suiteDuTitre}`}
        centre
        colonnes={styles['colonnes']}
        surQuitter={() => {
          setQuitter(true)
        }}
      >
        {total > 0 && (
          <p className={`${seance['secondaire'] ?? ''} texte-petit-14`}>
            {texteRang(Math.min(serie.index + 1, total), total)}
          </p>
        )}
      </EnteteSeance>
      {contenu}
      {quitter && (
        <DialogueQuitterSeance
          titre={T.dialogueTitre}
          texte={texteReprise(Math.min(serie.index + 1, Math.max(total, 1)))}
          libelleSortie={T.reprendrePlusTard}
          surSortie={() => {
            aller('/')
          }}
          surContinuer={() => {
            setQuitter(false)
          }}
        />
      )}
    </div>
  )
}
