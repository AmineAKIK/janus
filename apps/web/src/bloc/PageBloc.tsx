import { ROUTES } from '@janus/contrats'
import { BandeauAlerte, Bouton } from '@janus/ui'
import { useRef } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { BarreBloc } from './BarreBloc.tsx'
import styles from './Bloc.module.css'
import { FilEtapes } from './FilEtapes.tsx'
import type { EtapeAffichee } from './FilEtapes.tsx'
import { IframeFiche } from './HoteFiche.tsx'
import { PROBLEMES_POIGNEE_DE_MAIN, TEXTES_BLOC, textesRefus } from './textes.ts'
import { useHoteFiche } from './useHoteFiche.ts'
import type { DonneesFiche } from './useHoteFiche.ts'

function FicheOuverte({
  donnees,
  titre,
  moduleId,
  src,
  etapes,
  problemes,
}: {
  readonly etapes: readonly EtapeAffichee[]
  readonly problemes: readonly string[]
  readonly donnees: DonneesFiche
  readonly titre: string
  readonly moduleId: string
  readonly src: string
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const hote = useHoteFiche(donnees, iframe)
  const sauvee = donnees.etatPage?.etat['etape']
  const courante =
    hote.etapeVue ??
    (typeof sauvee === 'string' && etapes.some(({ id }) => id === sauvee) ? sauvee : null)
  const refusee = [
    ...problemes,
    ...(hote.refus === null ? [] : [PROBLEMES_POIGNEE_DE_MAIN[hote.refus]]),
  ]
  return (
    <div className={styles['page']}>
      <BarreBloc
        code={donnees.bloc}
        titre={titre}
        moduleId={moduleId}
        statut={hote.statut.statut}
      />
      <FilEtapes
        etapes={etapes}
        courante={courante}
        vues={hote.etapesVues}
        surChoix={hote.allerEtape}
      />
      <div className={styles['zone']}>
        {refusee.length > 0 && (
          <div className={styles['refusee']}>
            <p className={`${styles['refus'] ?? ''} texte-petit-14`} role="alert">
              {textesRefus(refusee.length)}
            </p>
            <ul className={`${styles['problemes'] ?? ''} texte-petit-14`}>
              {refusee.map((probleme) => (
                <li key={probleme}>{probleme}</li>
              ))}
            </ul>
          </div>
        )}
        {refusee.length === 0 && hote.phase === 'muette' && (
          <div className={styles['muette']}>
            <BandeauAlerte type="erreur">{TEXTES_BLOC.muette}</BandeauAlerte>
            <Bouton variante="secondaire" onClick={hote.recharger}>
              {TEXTES_BLOC.recharger}
            </Bouton>
          </div>
        )}
        {refusee.length === 0 && hote.phase === 'attente' && (
          <p className={styles['squelette']} role="status">
            {TEXTES_BLOC.chargement}
          </p>
        )}
        {refusee.length === 0 && (
          <IframeFiche
            key={hote.chargement}
            reference={iframe}
            code={donnees.bloc}
            titre={titre}
            src={src}
          />
        )}
      </div>
    </div>
  )
}

/** La page d'un bloc : barre du haut et fiche dans son iframe. */
export function PageBloc({ blocId }: { readonly blocId: string }) {
  const lecture = useLecture(ROUTES['GET /blocs/:id'], { params: { id: blocId } })

  // Une relecture qui échoue (réseau coupé) ne retire pas la fiche déjà affichée.
  if (lecture.isError && lecture.data === undefined) {
    return (
      <div className={styles['erreur']}>
        <BandeauAlerte type="erreur">{TEXTES_BLOC.erreur}</BandeauAlerte>
        <Bouton
          variante="secondaire"
          onClick={() => {
            void lecture.refetch()
          }}
        >
          {TEXTES_BLOC.reessayer}
        </Bouton>
      </div>
    )
  }
  if (lecture.data === undefined) {
    return (
      <p className={styles['squelette']} role="status">
        {TEXTES_BLOC.chargement}
      </p>
    )
  }

  const detail = lecture.data
  return (
    <FicheOuverte
      // Un autre bloc repart d'une poignée de main neuve.
      key={detail.bloc}
      donnees={{
        bloc: detail.bloc,
        version: detail.version,
        statut: detail.statut,
        manque: detail.manque,
        serieOuverte: detail.serie_ouverte,
        etatPage: detail.etat_page,
      }}
      titre={detail.manifeste.titre}
      moduleId={detail.module}
      src={detail.fiche_url}
      etapes={detail.manifeste.etapes}
      problemes={detail.problemes}
    />
  )
}
