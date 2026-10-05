import { classes } from '../../utilitaires/classes.ts'
import { BarreProgression } from '../BarreProgression/BarreProgression.tsx'
import styles from './ProgressionSeance.module.css'

export type EtatEtape = 'a_commencer' | 'en_cours' | 'termine'

export interface EtapeSeance {
  readonly libelle: string
  readonly etat: EtatEtape
}

export interface ProprietesProgressionSeance {
  readonly etapes: readonly EtapeSeance[]
  readonly className?: string
}

const LIBELLES_ETAT: Record<EtatEtape, string> = {
  a_commencer: 'à commencer',
  en_cours: 'en cours',
  termine: 'terminée',
}

/** Rang de l'étape à afficher : celle en cours, sinon la première à commencer, sinon la dernière. */
function rangAffiche(etapes: readonly EtapeSeance[]): number {
  const index = etapes.findIndex((etape) => etape.etat === 'en_cours')
  const aCommencer = etapes.findIndex((etape) => etape.etat === 'a_commencer')
  const rang = index === -1 ? aCommencer : index
  return rang === -1 ? etapes.length : rang + 1
}

export function ProgressionSeance({ etapes, className }: ProprietesProgressionSeance) {
  const terminees = etapes.filter((etape) => etape.etat === 'termine').length
  return (
    <div className={classes(styles['seance'], className)}>
      <BarreProgression
        libelle="Progression"
        valeur={terminees}
        max={etapes.length}
        texteValeur={`${String(rangAffiche(etapes))} sur ${String(etapes.length)}`}
      />
      <ol className={styles['etapes']} aria-label="Étapes de la séance">
        {etapes.map((etape, index) => (
          <li
            key={`${String(index)}-${etape.libelle}`}
            {...(etape.etat === 'en_cours' ? { 'aria-current': 'step' } : {})}
          >
            {etape.libelle}
            <span className={styles['etat']}>{`, ${LIBELLES_ETAT[etape.etat]}`}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
