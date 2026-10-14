import type { Avancement, TypeEtape } from '@janus/contrats'
import { useState } from 'react'
import styles from './Bloc.module.css'
import { TEXTES_BLOC } from './textes.ts'

export interface EtapeAffichee {
  readonly id: string
  readonly titre: string
  readonly type: TypeEtape
}

/** Une étape est faite d'après les faits, jamais d'après sa place dans le fil. */
function estFaite(
  { id, type }: EtapeAffichee,
  avancement: Avancement,
  vues: ReadonlySet<string>,
  bilanFait: boolean,
): boolean {
  switch (type) {
    // Une étape de cours n'a pas de preuve : elle est faite quand elle a été affichée.
    case 'carte':
    case 'pretest':
    case 'explication':
      return vues.has(id)
    case 'restitution':
      return avancement.restitution !== null
    case 'consolidation':
      return avancement.consolidation !== null
    case 'pratique':
      return avancement.pratique !== null
    case 'atelier':
      return avancement.atelier !== null
    case 'aisance':
      return avancement.aisance !== null
    case 'bilan':
      return bilanFait
  }
}

/**
 * Les étapes faites : une étape à preuve quand le serveur date sa preuve (restitution envoyée,
 * pratique à l'aide 0, atelier, aisance, consolidation), une étape de cours quand elle a été
 * affichée (par le serveur ou dans cet onglet), le bilan quand il a été envoyé.
 */
export function etapesFaites(
  etapes: readonly EtapeAffichee[],
  avancement: Avancement,
  vues: readonly string[],
  bilanFait: boolean,
): ReadonlySet<string> {
  const affichees = new Set([...avancement.etapes_vues, ...vues])
  return new Set(
    etapes.filter((etape) => estFaite(etape, avancement, affichees, bilanFait)).map(({ id }) => id),
  )
}

const AUCUNE: ReadonlySet<string> = new Set()

/** Le fil d'étapes : un onglet par étape du manifeste, qui demande à la page de l'afficher. */
export function FilEtapes({
  etapes,
  courante,
  avancement,
  vues,
  bilanFait,
  surChoix,
  verrouillees = AUCUNE,
  surVerrou,
}: {
  readonly etapes: readonly EtapeAffichee[]
  readonly courante: string | null
  /** L'avancement du bloc d'après le serveur : ce qui coche les étapes à preuve. */
  readonly avancement: Avancement
  /** Les étapes affichées dans cet onglet, avant que le serveur ne les ait enregistrées. */
  readonly vues: readonly string[]
  /** Le bilan a été envoyé (dans cet onglet, ou d'après l'état de page sauvegardé). */
  readonly bilanFait: boolean
  readonly surChoix: (id: string) => void
  /** Les étapes qui demandent confirmation avant d'être rouvertes. */
  readonly verrouillees?: ReadonlySet<string>
  readonly surVerrou?: (id: string) => void
}) {
  const faites = etapesFaites(etapes, avancement, vues, bilanFait)
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
