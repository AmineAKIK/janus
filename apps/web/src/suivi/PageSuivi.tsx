import { useState } from 'react'
import { GroupeSegmente } from '@janus/ui'
import { Periode } from '@janus/contrats'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { CarteDuModule } from './CarteDuModule.tsx'
import { DialogueForcer } from './DialogueForcer.tsx'
import styles from './Suivi.module.css'
import { OPTIONS_PERIODE, TEXTES_SUIVI as T } from './textes.ts'
import { useSuivi } from './useSuivi.ts'
import type { DonneesSuivi } from './useSuivi.ts'
import { ZoneAFaire, ZoneCout, ZoneDecisions, ZoneErreurs } from './Zones.tsx'
import { CarteZone } from '@janus/ui'

function allerA(recherche: string) {
  window.location.hash = `/tableau-de-bord${recherche}`
}

function Corps({
  donnees,
  suivi,
}: {
  readonly donnees: DonneesSuivi
  readonly suivi: ReturnType<typeof useSuivi>
}) {
  const [dialogue, setDialogue] = useState(false)
  const titreBloc = (code: string) =>
    donnees.blocs.find(({ bloc }) => bloc === code)?.titre_court ?? ''
  return (
    <div className={styles['colonnes']}>
      <div className={styles['colonne']}>
        <CarteZone titre={T.carte}>
          <CarteDuModule blocs={donnees.blocs} />
        </CarteZone>
        <ZoneAFaire donnees={donnees.a_faire} titreBloc={titreBloc} />
      </div>
      <div className={styles['colonne']}>
        <ZoneErreurs erreurs={donnees.erreurs} />
        <ZoneDecisions
          decisions={donnees.decisions}
          actifs={new Set(donnees.blocs.filter(({ force }) => force).map(({ bloc }) => bloc))}
          surForcer={() => {
            suivi.reinitialiserEchec()
            setDialogue(true)
          }}
          surLever={suivi.lever}
        />
        <ZoneCout cout={donnees.cout_ia} />
      </div>
      {dialogue && (
        <DialogueForcer
          blocs={donnees.blocs.map(({ bloc }) => bloc)}
          enCours={suivi.enCours}
          echec={suivi.echec}
          surForcer={(bloc, statut, raison) => {
            suivi.forcer(bloc, statut, raison, () => {
              setDialogue(false)
            })
          }}
          surFermeture={() => {
            setDialogue(false)
          }}
        />
      )}
    </div>
  )
}

export function PageSuivi({
  module,
  periode,
}: {
  readonly module: string | undefined
  readonly periode: string | undefined
}) {
  const suivi = useSuivi({
    ...(module === undefined ? {} : { module }),
    ...(periode === undefined ? {} : { periode }),
  })
  const { lecture } = suivi
  const donnees = lecture.data
  const valeurPeriode = Periode.safeParse(periode).data ?? donnees?.periode ?? '30j'

  const recherche = (nouveau: { module?: string; periode?: string }) => {
    const parametres = new URLSearchParams()
    const m = nouveau.module ?? module
    const p = nouveau.periode ?? periode
    if (m !== undefined) parametres.set('module', m)
    if (p !== undefined) parametres.set('periode', p)
    const texte = parametres.toString()
    allerA(texte === '' ? '' : `?${texte}`)
  }

  let contenu
  if (lecture.isError) contenu = <Erreur reessayer={() => void lecture.refetch()} />
  else if (donnees === undefined) contenu = <Chargement nombre={2} />
  else contenu = <Corps donnees={donnees} suivi={suivi} />

  return (
    <div className={styles['page']}>
      <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
        {T.titreEcran}
      </h1>
      <div className={styles['entete']}>
        {donnees !== undefined && donnees.modules.length > 0 && (
          <label className={`${styles['champ'] ?? ''} texte-petit-14`}>
            {T.module}
            <select
              value={donnees.module?.id ?? ''}
              onChange={(evenement) => {
                recherche({ module: evenement.target.value })
              }}
            >
              {donnees.modules.map(({ id, titre }) => (
                <option key={id} value={id}>
                  {titre}
                </option>
              ))}
            </select>
          </label>
        )}
        <GroupeSegmente
          libelle={T.periode}
          options={OPTIONS_PERIODE}
          valeur={valeurPeriode}
          onChange={(valeur) => {
            recherche({ periode: valeur })
          }}
        />
        <a href="#/journal">{T.journal}</a>
      </div>
      {contenu}
    </div>
  )
}
