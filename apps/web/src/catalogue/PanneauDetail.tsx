import type { Statut } from '@janus/contrats'
import { nouvelId, ROUTES } from '@janus/contrats'
import { jourDe } from '@janus/moteur'
import { BadgeStatut, Bouton, LIBELLES_STATUT } from '@janus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useEcriture, useLecture } from '../api/requetes.tsx'
import { instantReel } from '../demo/horlogeDemo.ts'
import { DialoguePrerequis } from './DialoguePrerequis.tsx'
import styles from './Detail.module.css'
import { Chargement, Erreur } from './EtatEcran.tsx'
import { lignesPreuves } from './preuves.ts'
import { ACQUIS_AU_MOINS_PROVISOIRE } from './useBlocs.ts'
import { TEXTES_DETAIL } from './textes.ts'

export interface ContexteDetail {
  readonly fuseau: string
  readonly heureBascule: number
  /** Les statuts des blocs du module, pour les prérequis. */
  readonly statuts: ReadonlyMap<string, Statut>
}

/** Le détail d'un bloc : objectif, prérequis, erreurs ouvertes, cinq preuves et le bouton d'ouverture. */
export function PanneauDetail({
  bloc,
  contexte,
  dansDialogue = false,
}: {
  readonly bloc: string
  readonly contexte: ContexteDetail
  /** Dans une feuille de dialogue, le cadre est celui du dialogue. */
  readonly dansDialogue?: boolean
}) {
  const cadre = dansDialogue
    ? `${styles['panneau'] ?? ''} ${styles['sansCadre'] ?? ''}`
    : styles['panneau']
  const lecture = useLecture(ROUTES['GET /blocs/:id'], { params: { id: bloc } })
  const ecriture = useEcriture(ROUTES['POST /blocs/:id/ouvrir'])
  const client = useQueryClient()
  const navigate = useNavigate()
  const [dialogue, setDialogue] = useState(false)
  if (lecture.isError) {
    return (
      <aside className={cadre} aria-label={TEXTES_DETAIL.panneau}>
        <Erreur
          reessayer={() => {
            void lecture.refetch()
          }}
        />
      </aside>
    )
  }
  if (lecture.data === undefined) {
    return (
      <aside className={cadre} aria-label={TEXTES_DETAIL.panneau}>
        <Chargement />
      </aside>
    )
  }

  const detail = lecture.data
  const { fuseau, heureBascule, statuts } = contexte
  const aujourdhui = jourDe(instantReel(), fuseau, heureBascule)
  const enJour = (date: string) => (date.length === 10 ? date : jourDe(date, fuseau, heureBascule))
  const libelles = new Map(
    detail.manifeste.erreurs_critiques.map(({ id, libelle }) => [id, libelle]),
  )
  const reprise = detail.statut === 'a_reprendre'
  const manquants = detail.manifeste.prerequis.filter(
    (code) => !ACQUIS_AU_MOINS_PROVISOIRE.includes(statuts.get(code) ?? 'non_commence'),
  )

  const ouvrir = (raison: string | null) => {
    ecriture.mutate(
      {
        params: { id: detail.bloc },
        corps: {
          id: nouvelId(Date.parse(instantReel())),
          hors_prerequis: raison !== null,
          ...(raison === null ? {} : { raison }),
        },
      },
      {
        onSuccess: () => {
          setDialogue(false)
          void client.invalidateQueries()
          void navigate({ to: '/blocs/$blocId', params: { blocId: detail.bloc } })
        },
      },
    )
  }

  return (
    <aside className={cadre} aria-label={TEXTES_DETAIL.panneau}>
      <header className={styles['entete']}>
        <span className={`${styles['reference'] ?? ''} texte-code-14`}>{detail.bloc}</span>
        <BadgeStatut statut={detail.statut} />
      </header>
      <h2 className={`${styles['titre'] ?? ''} texte-titre-22`}>{detail.manifeste.titre}</h2>
      <p className={`${styles['ligne'] ?? ''} texte-petit-14`}>
        {TEXTES_DETAIL.objectif} · {detail.manifeste.objectif}
      </p>
      <p className={`${styles['prerequis'] ?? ''} texte-legende-12`}>
        {TEXTES_DETAIL.prerequis} ·{' '}
        {detail.manifeste.prerequis.length === 0
          ? TEXTES_DETAIL.aucunPrerequis
          : detail.manifeste.prerequis
              .map((code) => {
                const statut = statuts.get(code)
                return statut === undefined
                  ? code
                  : `${code} ${LIBELLES_STATUT[statut].toLowerCase()}`
              })
              .join(', ')}
      </p>
      {detail.erreurs_ouvertes.length > 0 && (
        <div className={styles['erreurs']}>
          {detail.erreurs_ouvertes.map((id) => (
            <p key={id} className={`${styles['erreur'] ?? ''} texte-petit-14`}>
              {TEXTES_DETAIL.erreurCritique} · {libelles.get(id) ?? id}
            </p>
          ))}
        </div>
      )}
      <section className={styles['preuves']} aria-labelledby={`preuves-${detail.bloc}`}>
        <h3 id={`preuves-${detail.bloc}`} className="texte-corps-16">
          {TEXTES_DETAIL.cinqPreuves}
        </h3>
        <p className={`${styles['explication'] ?? ''} texte-petit-14`}>
          {TEXTES_DETAIL.explicationPreuves}
        </p>
        <ul className={styles['lignesPreuves']}>
          {lignesPreuves(detail.preuves, aujourdhui, enJour).map((ligne) => (
            <li key={ligne.cle} className={styles['preuve']} data-etat={ligne.etat}>
              <span className="texte-petit-14">{ligne.libelle}</span>
              <span className={`${styles['etatPreuve'] ?? ''} texte-legende-12`}>
                {ligne.texte}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <Bouton
        pleineLargeur
        chargement={ecriture.isPending && !dialogue}
        onClick={() => {
          if (detail.acces === 'raison_requise') {
            ecriture.reset()
            setDialogue(true)
          } else ouvrir(null)
        }}
      >
        {reprise ? TEXTES_DETAIL.reprendre : TEXTES_DETAIL.ouvrir}
      </Bouton>
      {dialogue && (
        <DialoguePrerequis
          manquants={manquants}
          enCours={ecriture.isPending}
          echec={ecriture.isError}
          surOuvrir={ouvrir}
          surAller={(code) => {
            setDialogue(false)
            void navigate({ to: '.', search: (precedent) => ({ ...precedent, detail: code }) })
          }}
          surFermeture={() => {
            setDialogue(false)
          }}
        />
      )}
    </aside>
  )
}
