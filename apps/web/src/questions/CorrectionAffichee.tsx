import { BadgeNeComptePas, Bouton, BulleCorrection, LIBELLES_NIVEAU, ZoneDeTexte } from '@janus/ui'
import { useState } from 'react'
import seance from '../seance/Seance.module.css'
import {
  JE_NE_SAIS_PAS,
  TEXTES_QUESTIONS as T,
  texteNiveauEtConfiance,
  texteSource,
  texteVenaitDe,
} from './textes.ts'
import type { EtatQuestion } from './useSerie.ts'

type Corrigee = Extract<EtatQuestion, { phase: 'corrigee' }>

/** Une erreur annoncée sûre : la dernière réponse est ratée et Amine était sûr. */
export function erreurEnEtantSur({ confiance, correction }: Corrigee): boolean {
  return (
    confiance === 'sur' && (correction.niveau === 'fragile' || correction.niveau === 'pas_encore')
  )
}

function estJeNeSaisPas({ confiance, reponse }: Corrigee): boolean {
  return confiance === 'hasard' && reponse === JE_NE_SAIS_PAS
}

export function niveauAffiche(etat: Corrigee): string {
  return etat.correction.certitude === 'non_verifie'
    ? T.aVerifier
    : LIBELLES_NIVEAU[etat.correction.niveau]
}

/** Ce que l'écran offre en plus pour échanger avec le tuteur ; absent en lecture seule. */
export interface Echange {
  readonly enAttente: boolean
  /** La dernière relance a été refusée : pourquoi. */
  readonly refus: 'plafond' | 'indisponible' | null
  readonly relancer: (texte: string, conteste: boolean) => void
  readonly donnerAccord: (accord: boolean) => void
}

const MAX_RELANCES = 4
const PREFIXE_CONTESTATION = 'Je conteste ta correction : '

function Relances({
  correction,
  echange,
}: {
  readonly correction: Corrigee['correction']
  readonly echange: Echange
}) {
  const [ouvert, setOuvert] = useState(false)
  const [conteste, setConteste] = useState(false)
  const [texte, setTexte] = useState('')
  const [accordDonne, setAccordDonne] = useState(false)
  const restantes = MAX_RELANCES - (correction.tour - 1)

  return (
    <div>
      {correction.echantillon && !accordDonne && (
        <div role="group" aria-label={T.accordQuestion}>
          <p className="texte-petit-14">{T.accordQuestion}</p>
          {[true, false].map((accord) => (
            <Bouton
              key={String(accord)}
              type="button"
              variante="secondaire"
              onClick={() => {
                setAccordDonne(true)
                echange.donnerAccord(accord)
              }}
            >
              {accord ? T.oui : T.non}
            </Bouton>
          ))}
        </div>
      )}
      {restantes > 0 ? (
        <>
          <div className={seance['actions']}>
            <Bouton
              type="button"
              variante="texte"
              aria-expanded={ouvert}
              onClick={() => {
                setOuvert(!ouvert)
                if (ouvert) setConteste(false)
              }}
            >
              {`${ouvert ? '−' : '+'} ${T.repondreAuTuteur}`}
            </Bouton>
            {!ouvert && (
              <Bouton
                type="button"
                variante="texte"
                onClick={() => {
                  setOuvert(true)
                  setConteste(true)
                  setTexte(PREFIXE_CONTESTATION)
                }}
              >
                {T.pasDAccord}
              </Bouton>
            )}
          </div>
          {echange.refus !== null && !ouvert && (
            <p role="alert" className="texte-petit-14">
              {echange.refus === 'plafond' ? T.relancePlafond : T.relanceIndisponible}
            </p>
          )}
          {ouvert && (
            <form
              className={seance['colonne']}
              onSubmit={(evenement) => {
                evenement.preventDefault()
                if (texte.trim() === '' || echange.enAttente) return
                echange.relancer(texte, conteste)
                setTexte('')
                setOuvert(false)
                setConteste(false)
              }}
            >
              <ZoneDeTexte
                libelle={T.reponseAuTuteur}
                message={T.noteRelance}
                value={texte}
                readOnly={echange.enAttente}
                onChange={(evenement) => {
                  setTexte(evenement.currentTarget.value)
                }}
              />
              <Bouton
                type="submit"
                variante="principal"
                disabled={texte.trim() === '' || echange.enAttente}
              >
                {T.envoyerAuTuteur}
              </Bouton>
            </form>
          )}
        </>
      ) : (
        <p className="texte-petit-14">{T.pourAllerPlusLoin}</p>
      )}
    </div>
  )
}

/** La correction d'une question : niveau et confiance, message du tuteur, source et bloc d'origine. */
export function CorrectionAffichee({
  etat,
  titreBloc,
  dernier,
  surSuivante,
  echange,
}: {
  readonly etat: Corrigee
  readonly titreBloc: string
  readonly dernier: boolean
  /** Absent en lecture seule (bilan de fin de série). */
  readonly surSuivante?: () => void
  readonly echange?: Echange
}) {
  const { correction } = etat
  const nonVerifiee = correction.certitude === 'non_verifie'
  return (
    <section className={seance['colonne']}>
      <p className={`${seance['secondaire'] ?? ''} texte-petit-14`}>
        {texteNiveauEtConfiance(niveauAffiche(etat), etat.confiance)}
      </p>
      {estJeNeSaisPas(etat) && <p className="texte-corps-16">{T.tuAsChoisi}</p>}
      {estJeNeSaisPas(etat) && <h2 className="texte-sous-titre-18">{T.indice}</h2>}
      <BulleCorrection
        niveau={correction.niveau}
        message={correction.message}
        source={correction.source}
        nonVerifie={nonVerifiee}
      />
      {nonVerifiee && <p className="texte-petit-14">{T.nonVerifiee}</p>}
      {erreurEnEtantSur(etat) && <p className="texte-petit-14">{T.tuEtaisSur}</p>}
      {!correction.compte && correction.raison_non_compte !== undefined && (
        <BadgeNeComptePas raison={correction.raison_non_compte} />
      )}
      {correction.ref !== '' && etat.bloc !== null && (
        <p className={`${seance['secondaire'] ?? ''} texte-legende-12`}>
          {texteSource(etat.bloc, correction.ref)}
        </p>
      )}
      {etat.bloc !== null && (
        <p className={`${seance['secondaire'] ?? ''} texte-legende-12`}>
          {texteVenaitDe(etat.bloc, titreBloc)}
        </p>
      )}
      {echange !== undefined && (
        <Relances key={correction.id} correction={correction} echange={echange} />
      )}
      {surSuivante !== undefined && (
        <Bouton type="button" variante="principal" onClick={surSuivante}>
          {dernier ? T.voirBilan : T.suivante}
        </Bouton>
      )}
    </section>
  )
}
