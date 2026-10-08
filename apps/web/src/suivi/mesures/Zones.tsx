import { BandeauAlerte, BarreProgression, CarteZone, EtatVideZone } from '@janus/ui'
import styles from '../Suivi.module.css'
import type { DonneesSuivi } from '../useSuivi.ts'
import {
  libelleSemaine,
  LIBELLE_CONFIANCE,
  pourcent,
  TEXTES_MESURES as T,
  texteAideMoyenne,
  texteCartes,
  texteDesaccords,
  texteDuree,
  texteLundi,
  texteSur,
  texteErreursSures,
  texteMeilleur,
  textePhraseAutonomie,
  texteReussites,
} from './textes.ts'

type Mesures = DonneesSuivi['mesures']

export function ZoneAutonomie({ donnees }: { readonly donnees: Mesures['autonomie'] }) {
  const { semaines, aide_moyenne: aide } = donnees
  const premiere = semaines[0]
  const derniere = semaines.at(-1)
  const phrase =
    premiere?.part != null && derniere?.part != null
      ? textePhraseAutonomie(derniere.part, premiere.part, libelleSemaine(0, semaines.length))
      : null
  return (
    <CarteZone titre={T.autonomie}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.autonomieSousTitre}</p>
      {semaines.every(({ total }) => total === 0) ? (
        <EtatVideZone message={T.autonomieVide} />
      ) : (
        <>
          {semaines.map(({ debut, part }, rang) => (
            <BarreProgression
              key={debut}
              valeur={(part ?? 0) * 100}
              max={100}
              libelle={libelleSemaine(rang, semaines.length)}
              texteValeur={part === null ? '–' : pourcent(part)}
            />
          ))}
          {phrase !== null && <p>{phrase}</p>}
          {aide !== null && <p>{texteAideMoyenne(aide)}</p>}
        </>
      )}
    </CarteZone>
  )
}

export function ZoneRetention({ donnees }: { readonly donnees: Mesures['retention'] }) {
  return (
    <CarteZone titre={T.retention}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.retentionSousTitre}</p>
      <table className={styles['tableau']}>
        <thead>
          <tr>
            <th scope="col">{T.semaine}</th>
            <th scope="col">{T.cartes}</th>
            <th scope="col">{T.questions}</th>
            <th scope="col">{T.verifications}</th>
          </tr>
        </thead>
        <tbody>
          {donnees.map(({ debut, cartes, questions, verifications }) => (
            <tr key={debut}>
              <th scope="row">{texteLundi(debut)}</th>
              <td>{texteCartes(cartes.reussis, cartes.total)}</td>
              <td>{texteSur(questions.reussis, questions.total)}</td>
              <td>{texteSur(verifications.reussis, verifications.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CarteZone>
  )
}

export function ZoneCalibration({ donnees }: { readonly donnees: Mesures['calibration'] }) {
  const { lignes, erreurs_sures: erreurs } = donnees
  return (
    <CarteZone titre={T.calibration}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.calibrationSousTitre}</p>
      <table className={styles['tableau']}>
        <thead>
          <tr>
            <th scope="col">{T.confiance}</th>
            <th scope="col">{T.justes}</th>
            <th scope="col">{T.faux}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map(({ confiance, justes, faux }) => (
            <tr key={confiance}>
              <th scope="row">{LIBELLE_CONFIANCE[confiance]}</th>
              <td>{justes}</td>
              <td>{faux}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{texteErreursSures(erreurs.length)}</p>
      {erreurs.length > 0 && (
        <ul className={styles['liste']}>
          {erreurs.map(({ bloc, question, date }) => (
            <li key={`${bloc}-${question}-${date}`}>
              <a href={`#/blocs/${bloc}`}>{bloc}</a>{' '}
              <span className={styles['complement']}>{question}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.calibrationRegle}</p>
    </CarteZone>
  )
}

export function ZoneAisance({ donnees }: { readonly donnees: Mesures['aisance'] }) {
  return (
    <CarteZone titre={T.aisance}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.aisanceSousTitre}</p>
      <ul className={styles['liste']}>
        {donnees.map(({ bloc, titre_court: titre, cible }) => (
          <li key={bloc}>
            <a href={`#/blocs/${bloc}`}>
              {bloc} · {titre}
            </a>{' '}
            {cible === null ? (
              <span className={styles['complement']}>{T.nonRequis}</span>
            ) : (
              <>
                <span>{cible.libelle}</span>
                <br />
                <span className={styles['complement']}>
                  {texteMeilleur(cible.meilleur_s, cible.objectif_s)} ·{' '}
                  {texteReussites(cible.reussites, cible.reussites_requises, cible.jours_requis)}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </CarteZone>
  )
}

export function ZoneTemps({ donnees }: { readonly donnees: Mesures['temps'] }) {
  const groupes = [
    [T.lecture, donnees.lecture_s],
    [T.pratique, donnees.pratique_s],
    [T.restitution, donnees.restitution_s],
  ] as const
  return (
    <CarteZone titre={T.temps}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.tempsSousTitre}</p>
      {donnees.total_s === 0 ? (
        <EtatVideZone message={T.tempsVide} />
      ) : (
        <>
          <p>{texteDuree(donnees.total_s)}</p>
          <ul className={styles['liste']}>
            {groupes.map(([libelle, secondes]) => (
              <li key={libelle}>
                {libelle} · {texteDuree(secondes)}
              </li>
            ))}
          </ul>
          <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.parBloc}</p>
          <ul className={styles['liste']}>
            {donnees.blocs.map(({ bloc, titre_court: titre, secondes }) => (
              <li key={bloc}>
                <a href={`#/blocs/${bloc}`}>
                  {bloc} · {titre}
                </a>{' '}
                · {texteDuree(secondes)}
              </li>
            ))}
          </ul>
        </>
      )}
    </CarteZone>
  )
}

export function ZoneFiabilite({ donnees }: { readonly donnees: Mesures['fiabilite'] }) {
  return (
    <CarteZone titre={T.fiabilite}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.fiabiliteSousTitre}</p>
      {donnees.alerte && <BandeauAlerte type="avertissement">{T.alerteDesaccords}</BandeauAlerte>}
      <ul className={styles['liste']}>
        <li>
          {T.copiesRelues} · {String(donnees.copies_relues)}
        </li>
        <li>
          {T.desaccords} · {texteDesaccords(donnees.desaccords, donnees.copies_relues)}
        </li>
        <li>
          {T.nonVerifiees} · {String(donnees.non_verifiees)}
        </li>
        <li>
          {T.contestations} · {String(donnees.contestations)}
        </li>
      </ul>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.fiabiliteRegle}</p>
    </CarteZone>
  )
}
