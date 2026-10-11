import { BandeauAlerte, BarreProgression, Bouton, CarteZone, EtatVideZone } from '@janus/ui'
import styles from '../Suivi.module.css'
import type { DonneesSuivi } from '../useSuivi.ts'
import {
  libelleSemaine,
  LIBELLE_CONFIANCE,
  pourcent,
  TEXTES_MESURES as T,
  texteAideMoyenne,
  texteCartes,
  texteBlocsVus,
  texteDesaccords,
  texteEtapeSautee,
  texteNotion,
  texteProchaineRevue,
  texteTempsDeRevue,
  texteDuree,
  texteLundi,
  texteSansMesure,
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

/** Le nom de la colonne, rappelé dans la cellule quand le tableau est empilé (voir `tableAdaptative`). */
function Etiquette({ children }: { readonly children: string }) {
  return <span className={styles['etiquette']}>{children}</span>
}

export function ZoneRetention({ donnees }: { readonly donnees: Mesures['retention'] }) {
  return (
    <CarteZone titre={T.retention}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.retentionSousTitre}</p>
      <div className={styles['tableAdaptative']}>
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
                <td>
                  <Etiquette>{T.cartes}</Etiquette>
                  {texteCartes(cartes.reussis, cartes.total)}
                </td>
                <td>
                  <Etiquette>{T.questions}</Etiquette>
                  {texteSur(questions.reussis, questions.total)}
                </td>
                <td>
                  <Etiquette>{T.verifications}</Etiquette>
                  {texteSur(verifications.reussis, verifications.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const mesures = donnees.flatMap((ligne) =>
    ligne.cible !== null && ligne.cible.meilleur_s !== null
      ? [{ ...ligne, cible: ligne.cible }]
      : [],
  )
  const sansMesure = donnees.filter(({ cible }) => cible === null || cible.meilleur_s === null)
  // Le même objectif sur toutes les lignes ne s'écrit qu'une fois, en tête.
  const libelles = new Set(mesures.map(({ cible }) => cible.libelle))
  const objectifCommun = libelles.size === 1 ? [...libelles][0] : undefined
  return (
    <CarteZone titre={T.aisance}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.aisanceSousTitre}</p>
      {objectifCommun !== undefined && <p>{objectifCommun}</p>}
      {mesures.length > 0 && (
        <ul className={styles['liste']}>
          {mesures.map(({ bloc, titre_court: titre, cible }) => (
            <li key={bloc}>
              <a href={`#/blocs/${bloc}`}>
                {bloc} · {titre}
              </a>{' '}
              {objectifCommun === undefined && <span>{cible.libelle}</span>}
              <br />
              <span className={styles['complement']}>
                {texteMeilleur(cible.meilleur_s, cible.objectif_s)} ·{' '}
                {texteReussites(cible.reussites, cible.reussites_requises, cible.jours_requis)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {sansMesure.length > 0 && (
        <details className={styles['repliable']}>
          <summary>{texteSansMesure(sansMesure.length)}</summary>
          <ul className={styles['liste']}>
            {sansMesure.map(({ bloc, titre_court: titre, cible }) => (
              <li key={bloc}>
                <a href={`#/blocs/${bloc}`}>
                  {bloc} · {titre}
                </a>{' '}
                <span className={styles['complement']}>
                  {cible === null ? T.nonRequis : texteMeilleur(cible.meilleur_s, cible.objectif_s)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
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

export function ZoneRevue({
  donnees,
  enCours,
  surRevue,
}: {
  readonly donnees: Mesures['revue']
  readonly enCours: boolean
  readonly surRevue: () => void
}) {
  return (
    <CarteZone titre={T.revue}>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.revueSousTitre}</p>
      {donnees.a_proposer ? (
        <>
          <p>{texteBlocsVus(donnees.blocs_depuis)}</p>
          <p>{texteTempsDeRevue(donnees.temps_s, donnees.pratique_s)}</p>
          {donnees.a_reprendre.length > 0 && (
            <>
              <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.revueATitre}</p>
              <ul className={styles['liste']}>
                {donnees.a_reprendre.map(({ bloc, question, fois }) => (
                  <li key={`${bloc}-${question}`}>
                    <a href={`#/blocs/${bloc}`}>{texteNotion(bloc, question, fois)}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {donnees.etapes_sautees.length > 0 && (
            <>
              <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{T.revueEtapes}</p>
              <ul className={styles['liste']}>
                {donnees.etapes_sautees.map(({ etape, blocs }) => (
                  <li key={etape}>{texteEtapeSautee(etape, blocs)}</li>
                ))}
              </ul>
            </>
          )}
          <Bouton type="button" variante="principal" disabled={enCours} onClick={surRevue}>
            {T.revueFaite}
          </Bouton>
        </>
      ) : (
        <p>{texteProchaineRevue(donnees.blocs_requis - donnees.blocs_depuis)}</p>
      )}
    </CarteZone>
  )
}
