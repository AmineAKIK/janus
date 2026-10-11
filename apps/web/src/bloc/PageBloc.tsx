import { ROUTES } from '@janus/contrats'
import { BandeauAlerte, Bouton } from '@janus/ui'
import { useEffect, useRef, useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { BarreBloc } from './BarreBloc.tsx'
import { EncartBilan } from './EncartBilan.tsx'
import { EncartConsolidation } from './EncartConsolidation.tsx'
import { formaterDelai, formaterInstant } from './instant.ts'
import { instantReel } from '../demo/horlogeDemo.ts'
import { DialogueRevoirCours } from './DialogueRevoirCours.tsx'
import { DialogueChangerNiveau } from './DialogueChangerNiveau.tsx'
import { EncartDecisionsIa } from './EncartDecisionsIa.tsx'
import { EncartErreurIa } from './EncartErreurIa.tsx'
import { EncartHorsConnexion } from './EncartHorsConnexion.tsx'
import { useEtatEnvoi } from './useEtatEnvoi.ts'
import { useTempsActif } from './useTempsActif.ts'
import styles from './Bloc.module.css'
import { FilEtapes } from './FilEtapes.tsx'
import type { EtapeAffichee } from './FilEtapes.tsx'
import { IframeFiche } from './HoteFiche.tsx'
import type { SerieVerrou } from './verrou.ts'
import { etapesVerrouillees, questionsRestantes } from './verrou.ts'
import { PROBLEMES_POIGNEE_DE_MAIN, TEXTES_BLOC, textesRefus } from './textes.ts'
import { useHoteFiche } from './useHoteFiche.ts'
import type { CorrectionSuivie, DonneesFiche } from './useHoteFiche.ts'

function FicheOuverte({
  donnees,
  titre,
  moduleId,
  src,
  etapes,
  problemes,
  erreursCritiques,
  questions,
  relire,
  relireBloc,
  delaiConsolidationMinutes,
}: {
  readonly relire: () => void
  /** Relit le bloc sans repartir de zéro : statut, ce qui manque, séries ouvertes. */
  readonly relireBloc: () => void
  readonly delaiConsolidationMinutes: number
  readonly etapes: readonly EtapeAffichee[]
  readonly problemes: readonly string[]
  readonly erreursCritiques: readonly { readonly id: string; readonly libelle: string }[]
  readonly questions: Readonly<
    Record<SerieVerrou, readonly { readonly id: string; readonly question: string }[]>
  >
  readonly donnees: DonneesFiche
  readonly titre: string
  readonly moduleId: string
  readonly src: string
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const { signalerActivite, changerEtape } = useTempsActif(donnees.bloc)
  const hote = useHoteFiche(donnees, iframe, signalerActivite, relireBloc)
  const envoi = useEtatEnvoi(donnees.bloc)
  const sauvee = donnees.etatPage?.etat['etape']
  const courante =
    hote.etapeVue ??
    (typeof sauvee === 'string' && etapes.some(({ id }) => id === sauvee) ? sauvee : null)
  const [revoir, setRevoir] = useState<string | null>(null)
  const [changerNiveau, setChangerNiveau] = useState<CorrectionSuivie | null>(null)
  const toutesQuestions = [...questions.restitution, ...questions.consolidation]
  const texteQuestion = (id: string) =>
    toutesQuestions.find((question) => question.id === id)?.question ?? id
  const restantes = {
    restitution: questionsRestantes(
      'restitution',
      questions.restitution.map(({ id }) => id),
      hote.envoyees.restitution,
      hote.statut.manque,
    ).length,
    consolidation: questionsRestantes(
      'consolidation',
      questions.consolidation.map(({ id }) => id),
      hote.envoyees.consolidation,
      hote.statut.manque,
    ).length,
  }
  const verrouillees = etapesVerrouillees(etapes, courante, restantes)
  const typeCourant = etapes.find(({ id }) => id === courante)?.type
  useEffect(() => {
    changerEtape(typeCourant)
  }, [changerEtape, typeCourant])
  const consolidationAttendue =
    hote.statut.manque.find(({ code }) => code === 'consolidation_trop_tot')?.apres ?? null
  const montrerConsolidation =
    typeCourant === 'consolidation' &&
    !donnees.serieOuverte.consolidation &&
    consolidationAttendue !== null

  // À l'heure dite, l'appli relit le bloc : la série s'ouvre sans recharger la page.
  useEffect(() => {
    if (consolidationAttendue === null) return
    const attente = Date.parse(consolidationAttendue) - Date.parse(instantReel())
    const minuteur = setTimeout(relireBloc, Math.min(Math.max(attente, 0) + 1000, 2_147_000_000))
    return () => {
      clearTimeout(minuteur)
    }
  }, [consolidationAttendue, relireBloc])

  // Une erreur déjà ouverte n'a plus besoin d'être tranchée.
  const ouvertes = hote.statut.manque.find(({ code }) => code === 'erreur_ouverte')?.erreurs ?? []
  const enAttente = hote.propositions.filter(({ erreur }) => !ouvertes.includes(erreur))
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
        etatEnvoi={envoi.etat}
        gardees={envoi.gardees}
      />
      <FilEtapes
        etapes={etapes}
        courante={courante}
        vues={hote.etapesVues}
        surChoix={hote.allerEtape}
        verrouillees={verrouillees}
        surVerrou={setRevoir}
      />
      {revoir !== null && (
        <DialogueRevoirCours
          surRester={() => {
            setRevoir(null)
          }}
          surRevoir={() => {
            hote.allerEtape(revoir)
            setRevoir(null)
          }}
        />
      )}
      {changerNiveau !== null && (
        <DialogueChangerNiveau
          surFermeture={() => {
            setChangerNiveau(null)
          }}
          surValider={(niveau, raison) => {
            hote.trancherCorrection(changerNiveau, true, niveau, raison)
            setChangerNiveau(null)
          }}
        />
      )}
      <div className={styles['zone']}>
        {(hote.conflit || envoi.stockageIndisponible) && (
          <div className={styles['alertes']}>
            {envoi.stockageIndisponible && (
              <BandeauAlerte type="erreur">{TEXTES_BLOC.stockageIndisponible}</BandeauAlerte>
            )}
            {hote.conflit && (
              <>
                <BandeauAlerte type="erreur">{TEXTES_BLOC.conflit}</BandeauAlerte>
                <Bouton variante="secondaire" onClick={relire}>
                  {TEXTES_BLOC.recharger}
                </Bouton>
              </>
            )}
          </div>
        )}
        {typeCourant === 'bilan' && (
          <EncartBilan
            erreurEnAttente={enAttente.length > 0}
            libelleErreur={(id) =>
              (erreursCritiques.find((erreur) => erreur.id === id)?.libelle ?? id).replace(
                /\.$/,
                '',
              )
            }
            statut={hote.statut.statut}
            manque={hote.statut.manque}
            maintenant={instantReel()}
            reponsesApresRetourCours={hote.reponsesApresRetourCours.map(
              ({ correction, reponse }) => ({
                id: correction.id,
                question: texteQuestion(correction.question),
                reponse,
              }),
            )}
          />
        )}
        {montrerConsolidation && (
          <EncartConsolidation
            heure={formaterInstant(consolidationAttendue, instantReel())}
            delai={formaterDelai(delaiConsolidationMinutes)}
          />
        )}
        {typeCourant !== 'bilan' &&
          enAttente.map((proposition) => (
            <EncartErreurIa
              key={`${proposition.correction}:${proposition.erreur}`}
              code={donnees.bloc}
              reponse={proposition.reponse}
              surConfirmer={() => {
                hote.trancherErreur(proposition, 'confirmee')
              }}
              surRejeter={() => {
                hote.trancherErreur(proposition, 'rejetee')
              }}
            />
          ))}
        {typeCourant === 'bilan' &&
          (enAttente.length > 0 || hote.correctionsAVerifier.length > 0) && (
            <EncartDecisionsIa
              code={donnees.bloc}
              erreurs={enAttente}
              corrections={hote.correctionsAVerifier}
              question={texteQuestion}
              surConfirmer={(proposition) => {
                hote.trancherErreur(proposition, 'confirmee')
              }}
              surRejeter={(proposition) => {
                hote.trancherErreur(proposition, 'rejetee')
              }}
              surCompter={(correction) => {
                hote.trancherCorrection(correction, true)
              }}
              surNePasCompter={(correction) => {
                hote.trancherCorrection(correction, false)
              }}
              surChanger={setChangerNiveau}
            />
          )}
        {envoi.etat === 'attente' && (
          <EncartHorsConnexion derniereReponse={envoi.derniereReponse} />
        )}
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
  const reglages = useLecture(ROUTES['GET /reglages'], {})
  const [relecture, setRelecture] = useState(0)

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
      // Un autre bloc, ou une relecture après un conflit, repart d'une poignée de main neuve.
      key={`${detail.bloc}:${String(relecture)}`}
      relire={() => {
        void lecture.refetch().then(() => {
          setRelecture((valeur) => valeur + 1)
        })
      }}
      relireBloc={() => {
        void lecture.refetch()
      }}
      delaiConsolidationMinutes={reglages.data?.delaiConsolidationMinutes ?? 60}
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
      erreursCritiques={detail.manifeste.erreurs_critiques}
      questions={{
        restitution: detail.manifeste.restitution,
        consolidation: detail.manifeste.consolidation,
      }}
    />
  )
}
