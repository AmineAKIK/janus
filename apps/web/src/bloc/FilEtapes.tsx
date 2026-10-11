import type { TypeEtape } from '@janus/contrats'
import { useState } from 'react'
import styles from './Bloc.module.css'
import { TEXTES_BLOC } from './textes.ts'

export interface EtapeAffichee {
  readonly id: string
  readonly titre: string
  readonly type: TypeEtape
}

/** Étape faite : la page a vu une étape plus loin dans le fil. */
export function etapesFaites(
  etapes: readonly EtapeAffichee[],
  vues: readonly string[],
): ReadonlySet<string> {
  const plusLoin = Math.max(-1, ...vues.map((vue) => etapes.findIndex(({ id }) => id === vue)))
  return new Set(etapes.slice(0, Math.max(0, plusLoin)).map(({ id }) => id))
}

const AUCUNE: ReadonlySet<string> = new Set()

/** Le fil d'étapes : un onglet par étape du manifeste, qui demande à la page de l'afficher. */
export function FilEtapes({
  etapes,
  courante,
  vues,
  surChoix,
  verrouillees = AUCUNE,
  surVerrou,
}: {
  readonly etapes: readonly EtapeAffichee[]
  readonly courante: string | null
  readonly vues: readonly string[]
  readonly surChoix: (id: string) => void
  /** Les étapes qui demandent confirmation avant d'être rouvertes. */
  readonly verrouillees?: ReadonlySet<string>
  readonly surVerrou?: (id: string) => void
}) {
  const faites = etapesFaites(etapes, vues)
  const active = courante ?? etapes[0]?.id
  const [ouvert, setOuvert] = useState(false)
  const rang = Math.max(
    0,
    etapes.findIndex(({ id }) => id === active),
  )
  return (
    <nav aria-label={TEXTES_BLOC.etapes} className={styles['fil']} data-ouvert={ouvert}>
      {/* Étroit, le fil tient sur une ligne : l'étape en cours, et la liste au toucher. */}
      <button
        type="button"
        className={`${styles['bascule'] ?? ''} texte-petit-14`}
        aria-expanded={ouvert}
        aria-controls="liste-etapes"
        onClick={() => {
          setOuvert((courant) => !courant)
        }}
      >
        <span>{TEXTES_BLOC.etapeSurTotal(etapes[rang]?.titre ?? '', rang + 1, etapes.length)}</span>
        <span aria-hidden="true">{ouvert ? '▴' : '▾'}</span>
      </button>
      <ol id="liste-etapes" className={styles['etapes']}>
        {etapes.map(({ id, titre }) => (
          <li key={id}>
            <button
              type="button"
              aria-current={id === active ? 'step' : undefined}
              className={`${styles['onglet'] ?? ''} ${id === active ? (styles['courant'] ?? '') : ''} texte-petit-14`}
              title={verrouillees.has(id) ? TEXTES_BLOC.verrouillee : undefined}
              onClick={() => {
                setOuvert(false)
                if (verrouillees.has(id) && surVerrou !== undefined) surVerrou(id)
                else surChoix(id)
              }}
            >
              {verrouillees.has(id) ? (
                <span aria-hidden="true">{TEXTES_BLOC.verrou} </span>
              ) : (
                faites.has(id) && <span aria-hidden="true">{TEXTES_BLOC.faite} </span>
              )}
              {titre}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
