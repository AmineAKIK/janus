import {
  BadgeNeComptePas,
  CarteZone,
  ChangementStatut,
  EnTeteJour,
  EtatVideZone,
  LigneEvenement,
  NoteSeance,
} from '@janus/ui'
import { useState } from 'react'
import { Etat, SectionVitrine } from './SectionVitrine.tsx'
import styles from './Sections.module.css'

const DETAIL = (
  <>
    <p>Question · Corrige la fonction suivante.</p>
    <p className="texte-code-14">{'function niveau(x) { if (x < 20) return "critique"; }'}</p>
    <p>Réponse · « Il manque return dans la branche sinon. »</p>
    <p>Correction · Le diagnostic est correct.</p>
  </>
)

export function SectionJournal() {
  const [compris, setCompris] = useState('')
  const [bloque, setBloque] = useState('')

  return (
    <>
      <SectionVitrine identifiant="titre-zones" titre="Zones du tableau de bord">
        <div className={styles['ligne']}>
          <Etat nom="sans action">
            <CarteZone titre="Titre de zone">Contenu de la zone</CarteZone>
          </Etat>
          <Etat nom="avec action">
            <CarteZone titre="Titre de zone" action={<a href="#zones">Voir tout</a>}>
              Contenu de la zone
            </CarteZone>
          </Etat>
          <Etat nom="état vide">
            <EtatVideZone message="Pas encore assez de données, reviens après 2 semaines de pratique." />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-journal" titre="Journal">
        <div className={styles['colonne']}>
          <Etat nom="en-tête de jour">
            <EnTeteJour date="5 octobre" resume="3 blocs · 42 min" />
          </Etat>
          <Etat nom="événement replié">
            <LigneEvenement
              heure="09:24"
              titre="B07 · Restitution"
              precisions={['Oublie return dans une fonction', 'Hésitant · aide 0']}
              detail={DETAIL}
            />
          </Etat>
          <Etat nom="événement déplié, avec badge">
            <LigneEvenement
              heure="09:24"
              titre="B07 · Restitution"
              precisions={['Oublie return dans une fonction', 'Hésitant · aide 0']}
              badges={<BadgeNeComptePas raison="avec_support" />}
              detail={DETAIL}
              deplieParDefaut
            />
          </Etat>
          <Etat nom="événement sans détail">
            <LigneEvenement heure="10:02" titre="B07 · Séance terminée" />
          </Etat>
          <Etat nom="changement de statut">
            <ChangementStatut
              heure="10:12"
              bloc="B04 Boucles"
              avant="acquis_provisoirement"
              apres="acquis"
            />
          </Etat>
          <Etat nom="changement de statut, avec raison">
            <ChangementStatut
              heure="10:12"
              bloc="B04 Boucles"
              avant="acquis_provisoirement"
              apres="acquis"
              raison="Consolidation 5 sur 6, aucune erreur critique."
            />
          </Etat>
          <Etat nom="statut forcé, titre long">
            <ChangementStatut
              heure="10:40"
              bloc="B09 Comprendre les fermetures et la portée lexicale des variables"
              avant="acquis"
              apres="a_reprendre"
              raison="Statut forcé après une erreur critique."
            />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-note" titre="Note de séance">
        <div className={styles['colonne']}>
          <Etat nom="repliée">
            <NoteSeance
              compris=""
              bloque=""
              onChangeCompris={() => undefined}
              onChangeBloque={() => undefined}
            />
          </Etat>
          <Etat nom="dépliée, enregistrée">
            <NoteSeance
              compris={compris}
              bloque={bloque}
              onChangeCompris={setCompris}
              onChangeBloque={setBloque}
              enregistre
              deplieParDefaut
            />
          </Etat>
        </div>
      </SectionVitrine>
    </>
  )
}
