import { Bouton, type VarianteBouton } from '@janus/ui'
import { Etat, SectionVitrine } from './SectionVitrine.tsx'
import styles from './Sections.module.css'

const VARIANTES: readonly { variante: VarianteBouton; libelle: string }[] = [
  { variante: 'principal', libelle: 'Se connecter' },
  { variante: 'secondaire', libelle: 'Annuler' },
  { variante: 'texte', libelle: 'Voir le détail' },
]

export function SectionBoutons() {
  return (
    <SectionVitrine identifiant="titre-boutons" titre="Bouton">
      {VARIANTES.map(({ variante, libelle }) => (
        <div key={variante} className={styles['ligne']}>
          <Etat nom={`${variante}, normal`}>
            <Bouton variante={variante}>{libelle}</Bouton>
          </Etat>
          <Etat nom="survol">
            <Bouton variante={variante} className="etat-demo-survol">
              {libelle}
            </Bouton>
          </Etat>
          <Etat nom="appui">
            <Bouton variante={variante} className="etat-demo-appui">
              {libelle}
            </Bouton>
          </Etat>
          <Etat nom="focus">
            <Bouton variante={variante} className="etat-demo-focus">
              {libelle}
            </Bouton>
          </Etat>
          <Etat nom="désactivé">
            <Bouton variante={variante} disabled>
              {libelle}
            </Bouton>
          </Etat>
          <Etat nom="chargement">
            <Bouton variante={variante} chargement>
              {libelle}
            </Bouton>
          </Etat>
        </div>
      ))}
    </SectionVitrine>
  )
}
