import {
  Bouton,
  CarteBloc,
  CarteTacheDuJour,
  LigneAFaire,
  NoeudBloc,
  type ProprietesBadgeStatut,
  type ProprietesLien,
} from '@janus/ui'
import { Etat, SectionVitrine } from './SectionVitrine.tsx'
import styles from './Sections.module.css'

type Statut = ProprietesBadgeStatut['statut']

const STATUTS: readonly Statut[] = [
  'non_commence',
  'en_cours',
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
  'a_reprendre',
]

const TITRE_LONG =
  'Comprendre les fermetures, la portée lexicale et la durée de vie des variables capturées'

function lien({ className, children }: ProprietesLien) {
  return (
    <a href="#blocs" className={className}>
      {children}
    </a>
  )
}

export function SectionBlocs() {
  return (
    <>
      <SectionVitrine identifiant="titre-cartes-blocs" titre="Cartes de bloc">
        <div className={styles['ligne']}>
          {STATUTS.map((statut) => (
            <Etat key={statut} nom={statut}>
              <CarteBloc
                code="JS-04"
                titre="Comprendre les fermetures"
                statut={statut}
                prochaineDate="12 octobre"
                lien={lien}
              />
            </Etat>
          ))}
          <Etat nom="sans date">
            <CarteBloc
              code="JS-05"
              titre="Les modules"
              statut="non_commence"
              prochaineDate={null}
              lien={lien}
            />
          </Etat>
          <Etat nom="prérequis manquants">
            <CarteBloc
              code="JS-06"
              titre="Programmation asynchrone"
              statut="non_commence"
              prochaineDate={null}
              grise
              lien={lien}
            />
          </Etat>
          <Etat nom="titre de 80 caractères">
            <CarteBloc
              code="JS-07"
              titre={TITRE_LONG}
              statut="en_cours"
              prochaineDate="14 octobre"
              lien={lien}
            />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-noeuds-blocs" titre="Nœuds de bloc">
        <div className={styles['ligne']}>
          {STATUTS.map((statut) => (
            <Etat key={statut} nom={statut}>
              <NoeudBloc code="B01" libelle="Machine" statut={statut} lien={lien} />
            </Etat>
          ))}
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-taches-jour" titre="Tâches du jour">
        <div className={styles['ligne']}>
          <Etat nom="révision">
            <CarteTacheDuJour
              type="revision"
              titre="3 notions à revoir"
              action={<Bouton>Commencer</Bouton>}
            />
          </Etat>
          <Etat nom="restitution">
            <CarteTacheDuJour
              type="restitution"
              titre="1 réponse à reformuler"
              description="Sans rouvrir le cours."
              action={<Bouton>Commencer</Bouton>}
            />
          </Etat>
          <Etat nom="preuve">
            <CarteTacheDuJour
              type="preuve"
              titre="2 preuves à consigner"
              action={<Bouton>Commencer</Bouton>}
            />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-lignes-a-faire" titre="Lignes à faire">
        <div className={styles['colonne']}>
          <Etat nom="normale">
            <LigneAFaire type="Vérification" bloc="B03 Variables" echeance="8 oct." lien={lien} />
          </Etat>
          <Etat nom="prioritaire">
            <LigneAFaire
              type="Vérification"
              bloc="B03 Variables"
              echeance="8 oct."
              prioritaire
              lien={lien}
            />
          </Etat>
        </div>
      </SectionVitrine>
    </>
  )
}
