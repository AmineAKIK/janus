import { nouvelId, ROUTES, TypeJournal } from '@janus/contrats'
import { instantEnMs, jourDe, LIBELLES_FILTRE_JOURNAL, LIBELLES_TYPE_JOURNAL } from '@janus/moteur'
import {
  BandeauAlerte,
  Bouton,
  CarteZone,
  ChampTexte,
  Dialogue,
  EnTeteJour,
  EtatVideZone,
  LIBELLES_STATUT,
  LigneEvenement,
  ZoneDeTexte,
} from '@janus/ui'
import { useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { dateLongue } from '../aujourdhui/textes.ts'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { instantReel } from '../demo/horlogeDemo.ts'
import { useBureau } from '../parametres/useBureau.ts'
import { telecharger } from '../parametres/telecharger.ts'
import type { RechercheJournal } from '../routes/recherche.ts'
import styles from './Journal.module.css'
import {
  NOTE_MAX,
  TEXTES_JOURNAL as T,
  texteEtatBloc,
  texteEvenements,
  texteFiltres,
  texteRetirer,
} from './textes.ts'
import { useJournal } from './useJournal.ts'
import type { Ligne } from './useJournal.ts'

const adresse = (lien: string) => `#${lien}`

function NoteDeLigne({
  ligne,
  journal,
}: {
  readonly ligne: Ligne
  readonly journal: ReturnType<typeof useJournal>
}) {
  const [edition, setEdition] = useState(false)
  const [texte, setTexte] = useState(ligne.note?.texte ?? '')
  const [echec, setEchec] = useState(false)
  const { note } = ligne
  const enCours = journal.note.isPending || journal.modifierNote.isPending

  const reussite = {
    onSuccess: () => {
      setEdition(false)
      journal.invalider()
    },
    onError: () => {
      setEchec(true)
    },
  }
  const enregistrer = () => {
    setEchec(false)
    const propre = texte.trim()
    if (note === null) {
      journal.note.mutate(
        { corps: { id: nouvelId(Date.parse(instantReel())), entree: ligne.id, texte: propre } },
        reussite,
      )
    } else {
      journal.modifierNote.mutate({ params: { id: note.id }, corps: { texte: propre } }, reussite)
    }
  }

  if (edition) {
    return (
      <form
        className={styles['note']}
        onSubmit={(evenement) => {
          evenement.preventDefault()
          if (texte.trim() !== '' && !enCours) enregistrer()
        }}
      >
        <ZoneDeTexte
          libelle={T.champNote}
          maxLength={NOTE_MAX}
          maxCaracteres={NOTE_MAX}
          value={texte}
          onChange={(evenement) => {
            setTexte(evenement.target.value)
          }}
        />
        {echec && <BandeauAlerte type="erreur">{T.erreurNote}</BandeauAlerte>}
        <div className={styles['actions']}>
          <Bouton
            type="submit"
            variante="principal"
            disabled={texte.trim() === ''}
            chargement={enCours}
          >
            {T.enregistrer}
          </Bouton>
          <Bouton
            type="button"
            variante="texte"
            onClick={() => {
              setTexte(note?.texte ?? '')
              setEdition(false)
            }}
          >
            {T.annuler}
          </Bouton>
        </div>
      </form>
    )
  }
  return (
    <div className={styles['note']}>
      {note !== null && (
        <>
          <p className="texte-legende-12">{T.maNote}</p>
          <p className="texte-petit-14">{note.texte}</p>
        </>
      )}
      <Bouton
        type="button"
        variante="texte"
        onClick={() => {
          setEdition(true)
        }}
      >
        {note === null ? T.ajouterNote : T.modifier}
      </Bouton>
    </div>
  )
}

function DetailDeLigne({
  ligne,
  journal,
}: {
  readonly ligne: Ligne
  readonly journal: ReturnType<typeof useJournal>
}) {
  return (
    <div className={styles['detail']}>
      {ligne.detail.map((phrase, rang) => (
        <p key={rang} className={styles['phrase']}>
          {phrase}
        </p>
      ))}
      <a href={adresse(`/blocs/${ligne.bloc}`)}>{T.ouvrirBloc}</a>
      <NoteDeLigne key={ligne.note?.id ?? 'sans-note'} ligne={ligne} journal={journal} />
    </div>
  )
}

function SelecteurFiltre({
  libelle,
  valeur,
  options,
  onChange,
}: {
  readonly libelle: string
  readonly valeur: string
  readonly options: readonly { readonly valeur: string; readonly libelle: string }[]
  readonly onChange: (valeur: string) => void
}) {
  return (
    <label className={`${styles['champ'] ?? ''} texte-petit-14`}>
      {libelle}
      <select
        value={valeur}
        onChange={(evenement) => {
          onChange(evenement.target.value)
        }}
      >
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </label>
  )
}

function ChoixFiltres({
  libelle,
  valeur,
  options,
  onChange,
}: {
  readonly libelle: string
  readonly valeur: string
  readonly options: readonly { readonly valeur: string; readonly libelle: string }[]
  readonly onChange: (valeur: string) => void
}) {
  return (
    <div role="group" aria-label={libelle} className={styles['groupeFiltres']}>
      {options.map((option) => {
        const actif = option.valeur === valeur
        return (
          <button
            key={option.valeur}
            type="button"
            aria-pressed={actif}
            className={`${styles['choixFiltre'] ?? ''} ${actif ? (styles['choixFiltreActif'] ?? '') : ''} texte-petit-14`}
            onClick={() => {
              onChange(option.valeur)
            }}
          >
            {option.libelle}
          </button>
        )
      })}
    </div>
  )
}

function Corps({
  recherche,
  surFiltres,
}: {
  readonly recherche: RechercheJournal
  readonly surFiltres: (filtres: RechercheJournal) => void
}) {
  const bureau = useBureau()
  const [feuille, setFeuille] = useState(false)
  const [idee, setIdee] = useState('')
  const [echecIdee, setEchecIdee] = useState(false)
  const [echecExport, setEchecExport] = useState(false)
  const type = TypeJournal.safeParse(recherche.type).data
  const journal = useJournal({
    ...(recherche.module === undefined ? {} : { module: recherche.module }),
    ...(recherche.bloc === undefined ? {} : { bloc: recherche.bloc }),
    ...(type === undefined ? {} : { type }),
  })
  const reglages = useLecture(ROUTES['GET /reglages'], {})
  const { premiere } = journal

  if (journal.erreur || reglages.isError) {
    return (
      <Erreur
        reessayer={() => {
          journal.recharger()
          void reglages.refetch()
        }}
      />
    )
  }
  if (premiere === undefined || reglages.data === undefined) return <Chargement nombre={2} />

  const { fuseau, heureBascule } = reglages.data
  const heure = (instant: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: fuseau,
      hour: '2-digit',
      minute: '2-digit',
    }).format(instantEnMs(instant))
  const jours = new Map<string, Ligne[]>()
  for (const ligne of journal.entrees) {
    const jour = jourDe(ligne.date, fuseau, heureBascule)
    jours.set(jour, [...(jours.get(jour) ?? []), ligne])
  }

  const actifs = [recherche.bloc, type].filter((filtre) => filtre !== undefined).length
  const changer = (filtres: RechercheJournal) => {
    surFiltres({
      ...(recherche.module === undefined ? {} : { module: recherche.module }),
      ...filtres,
    })
  }
  const optionsBloc = [
    { valeur: '', libelle: T.tous },
    ...premiere.blocs.map(({ bloc }) => ({ valeur: bloc, libelle: bloc })),
  ]
  const optionsType = [
    { valeur: '', libelle: T.tous },
    ...TypeJournal.options.map((valeur) => ({ valeur, libelle: LIBELLES_FILTRE_JOURNAL[valeur] })),
  ]
  const changerBloc = (valeur: string) => {
    changer({
      ...(type === undefined ? {} : { type }),
      ...(valeur === '' ? {} : { bloc: valeur }),
    })
  }
  const changerType = (valeur: string) => {
    changer({
      ...(recherche.bloc === undefined ? {} : { bloc: recherche.bloc }),
      ...(valeur === '' ? {} : { type: valeur }),
    })
  }

  const listeEtat = (
    <ul className={styles['liste']}>
      {premiere.blocs.map(({ bloc, statut, titre_court: titre }) => (
        <li key={bloc}>
          <a href={adresse(`/blocs/${bloc}`)} title={titre}>
            {texteEtatBloc(bloc, LIBELLES_STATUT[statut])}
          </a>
        </li>
      ))}
    </ul>
  )

  const exporterTexte = () => {
    setEchecExport(false)
    journal.exportTexte.mutate(
      {},
      {
        onSuccess: (contenu) => {
          telecharger(T.nomFichierTexte, contenu, 'text/plain')
        },
        onError: () => {
          setEchecExport(true)
        },
      },
    )
  }

  return (
    <div className={styles['colonnes']}>
      <div className={styles['colonne']}>
        <div className={styles['barre']}>
          {premiere.modules.length > 1 && (
            <SelecteurFiltre
              libelle={T.module}
              valeur={recherche.module ?? ''}
              options={[
                { valeur: '', libelle: T.tous },
                ...premiere.modules.map(({ id, titre }) => ({ valeur: id, libelle: titre })),
              ]}
              onChange={(valeur) => {
                surFiltres(valeur === '' ? {} : { module: valeur })
              }}
            />
          )}
          {bureau ? (
            <SelecteurFiltre
              libelle={T.bloc}
              valeur={recherche.bloc ?? ''}
              options={optionsBloc}
              onChange={changerBloc}
            />
          ) : (
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => {
                setFeuille(true)
              }}
            >
              {texteFiltres(actifs)}
            </Bouton>
          )}
        </div>
        {bureau && (
          <ChoixFiltres
            libelle={T.type}
            valeur={type ?? ''}
            options={optionsType.slice(1)}
            onChange={(valeur) => {
              changerType(type === valeur ? '' : valeur)
            }}
          />
        )}
        {actifs > 0 && (
          <ul className={styles['puces']} aria-label={T.filtres}>
            {recherche.bloc !== undefined && (
              <li>
                <button
                  type="button"
                  className={styles['puce']}
                  aria-label={texteRetirer(recherche.bloc)}
                  onClick={() => {
                    changer({ ...(type === undefined ? {} : { type }) })
                  }}
                >
                  {recherche.bloc} ×
                </button>
              </li>
            )}
            {type !== undefined && (
              <li>
                <button
                  type="button"
                  className={styles['puce']}
                  aria-label={texteRetirer(LIBELLES_FILTRE_JOURNAL[type])}
                  onClick={() => {
                    changer({ ...(recherche.bloc === undefined ? {} : { bloc: recherche.bloc }) })
                  }}
                >
                  {LIBELLES_FILTRE_JOURNAL[type]} ×
                </button>
              </li>
            )}
          </ul>
        )}

        <details className={styles['idees']}>
          <summary className="texte-sous-titre-18">{T.idees}</summary>
          {premiere.idees.length === 0 ? (
            <p className="texte-petit-14">{T.aucuneIdee}</p>
          ) : (
            <ul className={styles['liste']}>
              {premiere.idees.map(({ id, texte }) => (
                <li key={id}>{texte}</li>
              ))}
            </ul>
          )}
          <form
            className={styles['formulaireIdee']}
            onSubmit={(evenement) => {
              evenement.preventDefault()
              const texte = idee.trim()
              if (texte === '' || journal.idee.isPending) return
              setEchecIdee(false)
              journal.idee.mutate(
                { corps: { id: nouvelId(Date.parse(instantReel())), texte } },
                {
                  onSuccess: () => {
                    setIdee('')
                    journal.invalider()
                  },
                  onError: () => {
                    setEchecIdee(true)
                  },
                },
              )
            }}
          >
            <ChampTexte
              libelle={T.champIdee}
              value={idee}
              onChange={(evenement) => {
                setIdee(evenement.target.value)
              }}
            />
            <Bouton
              type="submit"
              variante="secondaire"
              disabled={idee.trim() === ''}
              chargement={journal.idee.isPending}
            >
              {T.ajouterIdee}
            </Bouton>
          </form>
          {echecIdee && <BandeauAlerte type="erreur">{T.erreurIdee}</BandeauAlerte>}
        </details>

        {!bureau && (
          <details className={styles['idees']}>
            <summary className="texte-sous-titre-18">{T.etatBlocs}</summary>
            {listeEtat}
          </details>
        )}

        <div className={styles['actions']}>
          <Bouton
            type="button"
            variante="secondaire"
            chargement={journal.exportTexte.isPending}
            onClick={exporterTexte}
          >
            {T.exporterTexte}
          </Bouton>
          <Bouton
            type="button"
            variante="secondaire"
            onClick={() => {
              telecharger(
                T.nomFichierJson,
                JSON.stringify(journal.entrees, null, 2),
                'application/json',
              )
            }}
          >
            {T.exporterJson}
          </Bouton>
        </div>
        {echecExport && <BandeauAlerte type="erreur">{T.erreurExport}</BandeauAlerte>}

        {journal.entrees.length === 0 ? (
          <div className={styles['vide']}>
            <p aria-hidden="true" className={styles['icone']}>
              ◷
            </p>
            <EtatVideZone
              message={
                actifs > 0 || recherche.module !== undefined ? T.videFiltres : T.videSansFiltre
              }
            />
          </div>
        ) : (
          [...jours].map(([jour, lignes]) => (
            <section key={jour} className={styles['jour']} aria-label={dateLongue(jour)}>
              <EnTeteJour date={dateLongue(jour)} resume={texteEvenements(lignes.length)} />
              {lignes.map((ligne) => (
                <LigneEvenement
                  key={ligne.id}
                  heure={heure(ligne.date)}
                  titre={`${ligne.bloc} · ${LIBELLES_TYPE_JOURNAL[ligne.type]}`}
                  precisions={[ligne.resume]}
                  badges={
                    ligne.contestation_en_attente === true ? (
                      <span className={`${styles['badgeAttente'] ?? ''} texte-legende-12`}>
                        {T.contestationEnAttente}
                      </span>
                    ) : undefined
                  }
                  detail={<DetailDeLigne ligne={ligne} journal={journal} />}
                />
              ))}
            </section>
          ))
        )}
        {journal.suivant !== null && (
          <Bouton
            type="button"
            variante="secondaire"
            chargement={journal.chargePlus}
            onClick={journal.voirPlus}
          >
            {T.voirPlus}
          </Bouton>
        )}
      </div>

      {bureau && (
        <aside className={`${styles['colonne'] ?? ''} ${styles['etatBlocs'] ?? ''}`}>
          <CarteZone titre={T.etatBlocs}>{listeEtat}</CarteZone>
        </aside>
      )}

      {feuille && !bureau && (
        <Dialogue
          titre={T.filtres}
          libelleFermer={T.fermer}
          surFermeture={() => {
            setFeuille(false)
          }}
        >
          <div className={styles['feuille']}>
            <Bouton
              type="button"
              variante="texte"
              onClick={() => {
                changer({})
              }}
            >
              {T.toutEffacer}
            </Bouton>
            <div className={styles['sectionFiltre']}>
              <p className="texte-sous-titre-18">{T.bloc}</p>
              <ChoixFiltres
                libelle={T.bloc}
                valeur={recherche.bloc ?? ''}
                options={optionsBloc}
                onChange={changerBloc}
              />
            </div>
            <div className={styles['sectionFiltre']}>
              <p className="texte-sous-titre-18">{T.type}</p>
              <ChoixFiltres
                libelle={T.type}
                valeur={type ?? ''}
                options={optionsType}
                onChange={changerType}
              />
            </div>
            <Bouton
              type="button"
              variante="principal"
              onClick={() => {
                setFeuille(false)
              }}
            >
              {T.appliquer}
            </Bouton>
          </div>
        </Dialogue>
      )}
    </div>
  )
}

export function PageJournal({
  recherche,
  surFiltres,
}: {
  readonly recherche: RechercheJournal
  readonly surFiltres: (filtres: RechercheJournal) => void
}) {
  return (
    <div className={styles['page']}>
      <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
        {T.titreEcran}
      </h1>
      {/* Les pages déjà lues se vident quand un filtre change : le contenu est remonté avec sa clé. */}
      <Corps
        key={`${recherche.module ?? ''}|${recherche.bloc ?? ''}|${recherche.type ?? ''}`}
        recherche={recherche}
        surFiltres={surFiltres}
      />
    </div>
  )
}
