import {
  BadgeNeComptePas,
  BadgeStatut,
  BarreProgression,
  Bouton,
  BulleCorrection,
  ChoixConfiance,
  ProgressionSeance,
  type EtapeSeance,
  type ProprietesBadgeNeComptePas,
  type ProprietesBadgeStatut,
  type ProprietesBulleCorrection,
  type ProprietesChoixConfiance,
} from '@janus/ui'
import { useState } from 'react'
import { Etat, SectionVitrine } from './SectionVitrine.tsx'
import styles from './Sections.module.css'

type Statut = ProprietesBadgeStatut['statut']
type Niveau = ProprietesBulleCorrection['niveau']
type RaisonNonCompte = ProprietesBadgeNeComptePas['raison']
type Confiance = NonNullable<ProprietesChoixConfiance['valeur']>

const STATUTS: readonly Statut[] = [
  'non_commence',
  'en_cours',
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
  'a_reprendre',
]
const NIVEAUX: readonly Niveau[] = ['solide', 'partiel', 'fragile', 'pas_encore']
const RAISONS: readonly RaisonNonCompte[] = ['relance', 'avec_support', 'recopiee', 'non_verifiee']
const CONFIANCES: readonly Confiance[] = ['sur', 'hesitant', 'hasard']

const MESSAGES: Record<Niveau, string> = {
  solide: 'Ta réponse tient : tu as donné la règle et son exception.',
  partiel: 'Tu as l’idée générale.\nIl manque le cas limite.',
  fragile: 'Ta réponse mélange deux notions.',
  pas_encore: 'Ce point n’est pas encore là.',
}

const ETAPES_A_COMMENCER: readonly EtapeSeance[] = [
  { libelle: 'Carte', etat: 'a_commencer' },
  { libelle: 'Pourquoi', etat: 'a_commencer' },
  { libelle: 'Image', etat: 'a_commencer' },
  { libelle: 'Restitution', etat: 'a_commencer' },
]
const ETAPES_EN_COURS: readonly EtapeSeance[] = [
  { libelle: 'Carte', etat: 'termine' },
  { libelle: 'Pourquoi', etat: 'termine' },
  { libelle: 'Image', etat: 'en_cours' },
  { libelle: 'Restitution', etat: 'a_commencer' },
]
const ETAPES_TERMINEES: readonly EtapeSeance[] = ETAPES_EN_COURS.map((etape) => ({
  ...etape,
  etat: 'termine' as const,
}))

export function SectionStatuts() {
  const [confiance, setConfiance] = useState<Confiance | null>(null)

  return (
    <>
      <SectionVitrine identifiant="titre-statuts" titre="Statuts">
        <div className={styles['ligne']}>
          {STATUTS.map((statut) => (
            <Etat key={statut} nom={`${statut}, normale`}>
              <BadgeStatut statut={statut} />
            </Etat>
          ))}
        </div>
        <div className={styles['ligne']}>
          {STATUTS.map((statut) => (
            <Etat key={statut} nom={`${statut}, compacte`}>
              <BadgeStatut statut={statut} taille="compacte" />
            </Etat>
          ))}
        </div>
        <div className={styles['ligne']}>
          <Etat nom="infobulle, focus">
            <BadgeStatut statut="acquis" infobulle className="etat-demo-infobulle" />
          </Etat>
          <Etat nom="infobulle, au survol ou au focus">
            <BadgeStatut statut="a_reprendre" infobulle />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-confiance" titre="Confiance">
        <div className={styles['ligne']}>
          <Etat nom="aucun choix">
            <ChoixConfiance valeur={null} onChange={() => undefined} obligatoire />
          </Etat>
          {CONFIANCES.map((valeur) => (
            <Etat key={valeur} nom={valeur}>
              <ChoixConfiance valeur={valeur} onChange={() => undefined} />
            </Etat>
          ))}
          <Etat nom="interactif">
            <ChoixConfiance valeur={confiance} onChange={setConfiance} obligatoire />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-progression" titre="Progression">
        <div className={styles['ligne']}>
          <Etat nom="3 sur 7">
            <BarreProgression libelle="Progression" valeur={3} max={7} />
          </Etat>
          <Etat nom="5 sur 7">
            <BarreProgression libelle="Progression" valeur={5} max={7} />
          </Etat>
          <Etat nom="7 sur 7">
            <BarreProgression libelle="Progression" valeur={7} max={7} />
          </Etat>
        </div>
        <div className={styles['ligne']}>
          <Etat nom="séance, à commencer">
            <ProgressionSeance etapes={ETAPES_A_COMMENCER} />
          </Etat>
          <Etat nom="séance, en cours">
            <ProgressionSeance etapes={ETAPES_EN_COURS} />
          </Etat>
          <Etat nom="séance, terminée">
            <ProgressionSeance etapes={ETAPES_TERMINEES} />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-correction" titre="Correction">
        <div className={styles['ligne']}>
          {NIVEAUX.map((niveau) => (
            <Etat key={niveau} nom={niveau}>
              <BulleCorrection niveau={niveau} message={MESSAGES[niveau]} source="support" />
            </Etat>
          ))}
        </div>
        <div className={styles['ligne']}>
          <Etat nom="non vérifié, avec actions">
            <BulleCorrection
              niveau="partiel"
              message="Cette précision vient d’ailleurs que du cours."
              source="ajoute"
              nonVerifie
              enfants={
                <>
                  <Bouton variante="secondaire">Je ne suis pas d’accord</Bouton>
                  <Bouton variante="secondaire">Relancer</Bouton>
                </>
              }
            />
          </Etat>
          <Etat nom="message avec du HTML, affiché comme du texte">
            <BulleCorrection
              niveau="fragile"
              message="Utilise <b>gras</b> sans interpréter la balise."
              source="deduit"
            />
          </Etat>
        </div>
        <div className={styles['ligne']}>
          {RAISONS.map((raison) => (
            <Etat key={raison} nom={raison}>
              <BadgeNeComptePas raison={raison} />
            </Etat>
          ))}
        </div>
      </SectionVitrine>
    </>
  )
}
