import { ChampMotDePasse, ChampTexte, ZoneDeTexte } from '@janus/ui'
import { Etat, SectionVitrine } from './SectionVitrine.tsx'
import styles from './Sections.module.css'

export function SectionChamps() {
  return (
    <>
      <SectionVitrine identifiant="titre-champ-texte" titre="Champ texte">
        <div className={styles['ligne']}>
          <Etat nom="normal">
            <ChampTexte libelle="Adresse e-mail" placeholder="Saisir une valeur" />
          </Etat>
          <Etat nom="focus">
            <ChampTexte
              libelle="Adresse e-mail"
              placeholder="Saisir une valeur"
              className="etat-demo-focus"
            />
          </Etat>
          <Etat nom="rempli">
            <ChampTexte libelle="Adresse e-mail" defaultValue="prenom@exemple.fr" />
          </Etat>
          <Etat nom="erreur">
            <ChampTexte libelle="Adresse e-mail" message="Ce champ est obligatoire." erreur />
          </Etat>
          <Etat nom="désactivé">
            <ChampTexte libelle="Adresse e-mail" placeholder="Saisir une valeur" disabled />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-champ-mdp" titre="Champ mot de passe">
        <div className={styles['ligne']}>
          <Etat nom="normal">
            <ChampMotDePasse libelle="Mot de passe" />
          </Etat>
          <Etat nom="focus">
            <ChampMotDePasse libelle="Mot de passe" className="etat-demo-focus" />
          </Etat>
          <Etat nom="rempli">
            <ChampMotDePasse libelle="Mot de passe" defaultValue="exemple-de-secret" />
          </Etat>
          <Etat nom="erreur">
            <ChampMotDePasse libelle="Mot de passe" message="Message d’aide" erreur />
          </Etat>
          <Etat nom="désactivé">
            <ChampMotDePasse libelle="Mot de passe" disabled />
          </Etat>
        </div>
      </SectionVitrine>

      <SectionVitrine identifiant="titre-zone-texte" titre="Zone de texte">
        <div className={styles['ligne']}>
          <Etat nom="normal">
            <ZoneDeTexte
              libelle="Réponse libre"
              placeholder="Écris ta réponse sans consulter le cours."
            />
          </Etat>
          <Etat nom="focus">
            <ZoneDeTexte
              libelle="Réponse libre"
              placeholder="Écris ta réponse sans consulter le cours."
              className="etat-demo-focus"
            />
          </Etat>
          <Etat nom="rempli, avec compteur">
            <ZoneDeTexte
              libelle="Réponse libre"
              defaultValue="Je reformule le concept avec mes propres mots."
              maxCaracteres={500}
            />
          </Etat>
          <Etat nom="erreur">
            <ZoneDeTexte libelle="Réponse libre" message="Ce champ est obligatoire." erreur />
          </Etat>
          <Etat nom="désactivé">
            <ZoneDeTexte
              libelle="Réponse libre"
              placeholder="Écris ta réponse sans consulter le cours."
              disabled
            />
          </Etat>
        </div>
      </SectionVitrine>
    </>
  )
}
