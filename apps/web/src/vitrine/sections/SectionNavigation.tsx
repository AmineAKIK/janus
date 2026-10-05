import {
  Bouton,
  ChampTexte,
  EnTeteSection,
  Interrupteur,
  LigneLectureSeule,
  LigneReglage,
  Navigation,
  type CleNavigation,
} from '@janus/ui'
import { useState } from 'react'
import { Etat, SectionVitrine } from './SectionVitrine.tsx'
import styles from './Sections.module.css'

export function SectionNavigation() {
  const [actif, setActif] = useState<CleNavigation>('aujourdhui')
  const [rappel, setRappel] = useState(true)
  const [revision, setRevision] = useState(false)

  return (
    <>
      <SectionVitrine identifiant="titre-navigation" titre="Navigation">
        <p className="texte-petit-14">
          Barre basse sous 1024 px de large, barre latérale à partir de 1024 px. Élargis ou rétrécis
          la fenêtre pour voir la bascule.
        </p>
        <Navigation
          actif={actif}
          lien={({ cle, children, ...reste }) => (
            <a
              href={`#${cle}`}
              {...reste}
              onClick={(evenement) => {
                evenement.preventDefault()
                setActif(cle)
              }}
            >
              {children}
            </a>
          )}
        />
      </SectionVitrine>

      <SectionVitrine identifiant="titre-reglages-lignes" titre="Lignes de réglage">
        <EnTeteSection titre="Titre de section" description="Description de la section" />
        <div className={styles['colonne']}>
          <Etat nom="interrupteur actif">
            <LigneReglage
              libelle="Rappel quotidien"
              aide="Une notification par jour"
              controle={<Interrupteur coche={rappel} onChange={setRappel} />}
            />
          </Etat>
          <Etat nom="interrupteur inactif, focus">
            <LigneReglage
              libelle="Révision du soir"
              aide="Texte d’aide"
              controle={
                <Interrupteur coche={revision} onChange={setRevision} className="etat-demo-focus" />
              }
            />
          </Etat>
          <Etat nom="interrupteur désactivé">
            <LigneReglage
              libelle="Libellé du réglage"
              aide="Texte d’aide"
              controle={<Interrupteur coche={false} onChange={setRevision} disabled />}
            />
          </Etat>
          <Etat nom="champ">
            <LigneReglage
              libelle="Fuseau horaire"
              aide="Texte d’aide"
              controle={<ChampTexte libelle="Valeur du fuseau" defaultValue="Europe/Paris" />}
            />
          </Etat>
          <Etat nom="bouton">
            <LigneReglage
              libelle="Exporter mes données"
              aide="Texte d’aide"
              controle={<Bouton variante="secondaire">Action</Bouton>}
            />
          </Etat>
          <Etat nom="lecture seule">
            <LigneLectureSeule libelle="Règle de la méthode" valeur="Valeur en lecture seule" />
          </Etat>
        </div>
      </SectionVitrine>
    </>
  )
}
