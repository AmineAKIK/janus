import type { Statut } from '@janus/contrats'
import { ArrowLeft, BadgeStatut, RotateCcw } from '@janus/ui'
import { Link } from '@tanstack/react-router'
import styles from './Bloc.module.css'
import { IndicateurEnregistrement } from './IndicateurEnregistrement.tsx'
import type { EtatIndicateur } from '../envoi/indicateur.ts'
import { TEXTES_BLOC, TEXTES_RECOMMENCER } from './textes.ts'
import { TitrePage } from '../gabarit/TitrePage.tsx'

/**
 * La barre du haut : retour aux blocs, code, titre, statut calculé, état d'enregistrement et, quand la
 * page le propose, « Recommencer » (la fiche repart à vide, l'historique reste).
 */
export function BarreBloc({
  code,
  titre,
  moduleId,
  statut,
  etatEnvoi,
  gardees,
  surRecommencer,
}: {
  readonly code: string
  readonly titre: string
  readonly moduleId: string
  readonly statut: Statut
  readonly etatEnvoi: EtatIndicateur
  readonly gardees: number
  readonly surRecommencer?: (() => void) | undefined
}) {
  return (
    <div className={styles['barre']}>
      <Link
        to="/modules/$moduleId"
        params={{ moduleId }}
        search={{ detail: code }}
        aria-label={TEXTES_BLOC.retour}
        className={styles['retour']}
      >
        <ArrowLeft aria-hidden="true" className={styles['fleche']} />
      </Link>
      <span className={`${styles['code'] ?? ''} texte-code-14`}>{code}</span>
      <TitrePage taille="texte-corps-16" className={styles['titre']}>
        {titre}
      </TitrePage>
      <BadgeStatut statut={statut} className={styles['statut'] ?? ''} />
      <IndicateurEnregistrement etat={etatEnvoi} gardees={gardees} />
      {surRecommencer !== undefined && (
        <button
          type="button"
          aria-label={TEXTES_RECOMMENCER.bouton}
          title={TEXTES_RECOMMENCER.bouton}
          className={styles['recommencer']}
          onClick={surRecommencer}
        >
          <RotateCcw aria-hidden="true" className={styles['fleche']} />
        </button>
      )}
    </div>
  )
}
