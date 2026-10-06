import { BadgeNeComptePas, Bouton, BulleCorrection, LIBELLES_NIVEAU } from '@janus/ui'
import styles from './Questions.module.css'
import {
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

export function estJeNeSaisPas({ confiance, reponse }: Corrigee): boolean {
  return confiance === 'hasard' && reponse === 'Je ne sais pas'
}

export function niveauAffiche(etat: Corrigee): string {
  return etat.correction.certitude === 'non_verifie'
    ? T.aVerifier
    : LIBELLES_NIVEAU[etat.correction.niveau]
}

/** La correction d'une question : niveau et confiance, message du tuteur, source et bloc d'origine. */
export function CorrectionAffichee({
  etat,
  titreBloc,
  dernier,
  surSuivante,
}: {
  readonly etat: Corrigee
  readonly titreBloc: string
  readonly dernier: boolean
  /** Absent en lecture seule (bilan de fin de série). */
  readonly surSuivante?: () => void
}) {
  const { correction } = etat
  const nonVerifiee = correction.certitude === 'non_verifie'
  return (
    <section className={styles['correction']}>
      <p className={`${styles['niveau'] ?? ''} texte-petit-14`}>
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
        <p className={`${styles['meta'] ?? ''} texte-legende-12`}>
          {texteSource(etat.bloc, correction.ref)}
        </p>
      )}
      {etat.bloc !== null && (
        <p className={`${styles['meta'] ?? ''} texte-legende-12`}>
          {texteVenaitDe(etat.bloc, titreBloc)}
        </p>
      )}
      {surSuivante !== undefined && (
        <Bouton type="button" variante="principal" onClick={surSuivante}>
          {dernier ? T.voirBilan : T.suivante}
        </Bouton>
      )}
    </section>
  )
}
