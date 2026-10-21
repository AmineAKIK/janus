import type { Avancement, TypeEtape } from '@janus/contrats'
import { MOMENTS, momentDeLEtape } from '@janus/contrats'
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
    case 'perception':
    case 'pretest':
    case 'explication':
    case 'ensemble':
      return vues.has(id)
    case 'restitution':
      return avancement.restitution !== null
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
 * pratique à l'aide 0, atelier, aisance), une étape de cours quand elle a été
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

/**
 * Les étapes à revoir quand le bloc est « à reprendre » : celle que le manifeste lie à chaque erreur
 * critique ouverte, et la restitution que le serveur a rouverte après qu'elle a été envoyée. Le reste
 * garde ses preuves : on retourne là où l'erreur se corrige, on ne repart pas de zéro.
 */
export function etapesARevoir(
  etapes: readonly EtapeAffichee[],
  erreurs: readonly { readonly id: string; readonly etape?: string | undefined }[],
  ouvertes: readonly string[],
  avancement: Avancement,
  restitutionOuverte: boolean,
): ReadonlySet<string> {
  const liees = new Set(erreurs.filter(({ id }) => ouvertes.includes(id)).map(({ etape }) => etape))
  const restitutionRouverte = restitutionOuverte && avancement.restitution !== null
  return new Set(
    etapes
      .filter(({ id, type }) => liees.has(id) || (type === 'restitution' && restitutionRouverte))
      .map(({ id }) => id),
  )
}

const AUCUNE: ReadonlySet<string> = new Set()

/** Les étapes d'un moment, dans l'ordre du fil. */
function etapesDuMoment(etapes: readonly EtapeAffichee[], moment: string): EtapeAffichee[] {
  return etapes.filter(({ type }) => momentDeLEtape(type).id === moment)
}

/**
 * Le fil d'étapes : les quatre moments de la méthode, puis un onglet par étape du manifeste, qui
 * demande à la page de l'afficher. Un moment est coché quand toutes ses étapes sont faites.
 */
export function FilEtapes({
  etapes,
  courante,
  avancement,
  vues,
  bilanFait,
  surChoix,
  verrouillees = AUCUNE,
  surVerrou,
  aRevoir = AUCUNE,
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
  /** Les étapes où retourner quand le bloc est « à reprendre » : « ↺ » remplace « ✓ ». */
  readonly aRevoir?: ReadonlySet<string>
}) {
  const faites = etapesFaites(etapes, avancement, vues, bilanFait)
  const active = courante ?? etapes[0]?.id
  const [ouvert, setOuvert] = useState(false)
  const etapeActive = etapes.find(({ id }) => id === active) ?? etapes[0]
  const moment = etapeActive === undefined ? MOMENTS[0] : momentDeLEtape(etapeActive.type)
  const duMoment = etapesDuMoment(etapes, moment.id)
  const rang = Math.max(
    0,
    duMoment.findIndex(({ id }) => id === etapeActive?.id),
  )
  return (
    <nav aria-label={TEXTES_BLOC.etapes} className={styles['fil']} data-ouvert={ouvert}>
      <ol
        className={`${styles['moments'] ?? ''} texte-legende-12`}
        aria-label={TEXTES_BLOC.moments}
      >
        {MOMENTS.map((candidat) => {
          const siennes = etapesDuMoment(etapes, candidat.id)
          const fait = siennes.length > 0 && siennes.every(({ id }) => faites.has(id))
          return (
            <li key={candidat.id} aria-current={candidat.id === moment.id ? 'step' : undefined}>
              {fait && <span aria-hidden="true">{TEXTES_BLOC.faite} </span>}
              {candidat.libelle}
            </li>
          )
        })}
      </ol>
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
        <span>
          {TEXTES_BLOC.etapeSurTotal(
            etapeActive?.titre ?? '',
            moment.libelle,
            rang + 1,
            duMoment.length,
          )}
        </span>
        <span aria-hidden="true">{ouvert ? '▴' : '▾'}</span>
      </button>
      <ol id="liste-etapes" className={styles['etapes']} aria-label={TEXTES_BLOC.listeEtapes}>
        {etapes.map(({ id, titre }) => (
          <li key={id}>
            <button
              type="button"
              aria-current={id === active ? 'step' : undefined}
              className={`${styles['onglet'] ?? ''} ${id === active ? (styles['courant'] ?? '') : ''} texte-petit-14`}
              title={
                verrouillees.has(id)
                  ? TEXTES_BLOC.verrouillee
                  : aRevoir.has(id)
                    ? TEXTES_BLOC.aRevoir
                    : undefined
              }
              onClick={() => {
                setOuvert(false)
                if (verrouillees.has(id) && surVerrou !== undefined) surVerrou(id)
                else surChoix(id)
              }}
            >
              {verrouillees.has(id) ? (
                <span aria-hidden="true">{TEXTES_BLOC.verrou} </span>
              ) : aRevoir.has(id) ? (
                <span aria-hidden="true">{TEXTES_BLOC.revoirMarque} </span>
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
