import { ROUTES } from '@janus/contrats'
import { BadgeNeComptePas, Bouton, LIBELLES_NIVEAU } from '@janus/ui'
import { useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import { nouvelId } from '@janus/contrats'
import { instantReel } from '../demo/horlogeDemo.ts'
import {
  LIBELLES_PARTIE,
  TEXTES_VERIFICATION as T,
  texteCasReussis,
  texteCetait,
  texteDescendA,
  textePasseA,
  texteProchaineEcheance,
  texteSiConfirmee,
} from './textes.ts'
import type { ResultatVerification } from './textes.ts'
import styles from './Verification.module.css'

type PartieCorrigee = ResultatVerification['parties'][number]

function resume(partie: PartieCorrigee): string {
  if (partie.cas !== undefined) return texteCasReussis(partie.cas.reussis, partie.cas.total)
  if (partie.niveau !== undefined) return LIBELLES_NIVEAU[partie.niveau]
  return partie.reussi === true ? 'Réussie' : 'Ratée'
}

function Ligne({ partie }: { readonly partie: PartieCorrigee }) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <li>
      <button
        type="button"
        className={styles['ligne']}
        aria-expanded={ouverte}
        onClick={() => {
          setOuverte(!ouverte)
        }}
      >
        <span className="texte-petit-14">{LIBELLES_PARTIE[partie.type]}</span>
        <span className="texte-petit-14">{resume(partie)}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {ouverte && (
        <p className={`${styles['detail'] ?? ''} texte-petit-14`}>
          {[partie.correction, partie.indice].filter((texte) => texte !== undefined).join(' ')}
          {!partie.compte && (
            <>
              {' '}
              <BadgeNeComptePas raison="avec_support" />
            </>
          )}
        </p>
      )}
    </li>
  )
}

/** L'erreur critique proposée par le tuteur : Amine la confirme ou demande une revue. */
function ErreurAConfirmer({
  resultat,
  erreur,
}: {
  readonly resultat: ResultatVerification
  readonly erreur: NonNullable<ResultatVerification['erreur_a_confirmer']>
}) {
  const boite = useBoiteEnvoi()
  const detail = useLecture(ROUTES['GET /blocs/:id'], { params: { id: resultat.bloc.code } })
  const [fait, setFait] = useState<'confirmee' | 'revue' | null>(null)

  function confirmer() {
    const ouvertes = detail.data?.erreurs_ouvertes ?? []
    const id = nouvelId(Date.parse(instantReel()))
    setFait('confirmee')
    void boite.ajouter({
      id,
      route: 'POST /blocs/:id/erreurs',
      params: { id: resultat.bloc.code },
      corps: { id, ids: [...new Set([...ouvertes, erreur.erreur])] },
    })
  }

  function demanderRevue() {
    setFait('revue')
    void boite.ajouter({
      id: nouvelId(Date.parse(instantReel())),
      route: 'POST /corrections/:id/accord',
      params: { id: erreur.correction },
      corps: { accord: false },
    })
  }

  return (
    <div className={styles['erreur']}>
      <p className="texte-petit-14">
        <strong>{erreur.libelle}</strong> · {T.aConfirmer}
      </p>
      <p className="texte-petit-14">{erreur.explication}</p>
      <p className="texte-legende-12">{T.extrait}</p>
      <blockquote className={styles['lecture']}>{erreur.extrait}</blockquote>
      <p className="texte-petit-14">{texteSiConfirmee(resultat.bloc.code)}</p>
      <div className={styles['actions']}>
        <Bouton type="button" variante="principal" disabled={fait !== null} onClick={confirmer}>
          {T.confirmer}
        </Bouton>
        <Bouton
          type="button"
          variante="secondaire"
          disabled={fait !== null}
          onClick={demanderRevue}
        >
          {T.demanderRevue}
        </Bouton>
      </div>
    </div>
  )
}

export function Resultat({
  resultat,
  etapeSuivante,
}: {
  readonly resultat: ResultatVerification
  readonly etapeSuivante: React.ReactNode
}) {
  const { bloc, issue, statut, descend, prochaine } = resultat
  const titre = issue === 'reussie' ? T.reussie : issue === 'ratee' ? T.nonValidee : T.aExaminer
  return (
    <section className={styles['section']}>
      <p className={`${styles['secondaire'] ?? ''} texte-petit-14`}>
        {texteCetait(bloc.code, bloc.titre)}
      </p>
      <h2 className="texte-sous-titre-18">{titre}</h2>
      {issue === 'reussie' && (
        <>
          <p className="texte-corps-16">{textePasseA(bloc.code, statut)}</p>
          <p className="texte-corps-16">{T.preuveTient}</p>
        </>
      )}
      {issue === 'ratee' && (
        <p className="texte-corps-16">
          {descend ? texteDescendA(bloc.code, statut) : T.statutInchange}
        </p>
      )}
      <ul className={styles['lignes']}>
        {resultat.parties.map((partie) => (
          <Ligne key={partie.id} partie={partie} />
        ))}
      </ul>
      {issue === 'a_examiner' && resultat.erreur_a_confirmer !== null && (
        <ErreurAConfirmer resultat={resultat} erreur={resultat.erreur_a_confirmer} />
      )}
      {issue !== 'a_examiner' && prochaine !== null && (
        <p className="texte-corps-16">{texteProchaineEcheance(issue, prochaine)}</p>
      )}
      <div className={styles['actions']}>
        {etapeSuivante}
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => {
            window.location.hash = '/'
          }}
        >
          {T.retour}
        </Bouton>
      </div>
    </section>
  )
}
