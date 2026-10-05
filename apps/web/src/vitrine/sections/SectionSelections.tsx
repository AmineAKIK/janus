import { BandeauAlerte, CaseACocher } from '@janus/ui'
import { Etat, SectionVitrine } from './SectionVitrine.tsx'
import styles from './Sections.module.css'

export function SectionSelections() {
  return (
    <>
      <SectionVitrine identifiant="titre-case" titre="Case à cocher">
        <div className={styles['ligne']}>
          <Etat nom="décochée">
            <CaseACocher libelle="Rester connecté sur cet appareil" />
          </Etat>
          <Etat nom="cochée">
            <CaseACocher libelle="Rester connecté sur cet appareil" defaultChecked />
          </Etat>
          <Etat nom="focus">
            <CaseACocher libelle="Rester connecté sur cet appareil" className="etat-demo-focus" />
          </Etat>
          <Etat nom="désactivée">
            <CaseACocher libelle="Rester connecté sur cet appareil" disabled />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-bandeau" titre="Bandeau d’alerte">
        <div className={styles['ligne']}>
          <BandeauAlerte type="info">Correction indisponible, réessaie plus tard.</BandeauAlerte>
          <BandeauAlerte type="succes">Réponse enregistrée.</BandeauAlerte>
          <BandeauAlerte type="avertissement">
            Cette réponse nécessite une vérification.
          </BandeauAlerte>
          <BandeauAlerte type="erreur">Impossible d’enregistrer la réponse.</BandeauAlerte>
        </div>
      </SectionVitrine>
    </>
  )
}
