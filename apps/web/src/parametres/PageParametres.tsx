import { BandeauAlerte, EnTeteSection, NOM_APPLI } from '@janus/ui'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import styles from './Parametres.module.css'
import { estSection, SECTIONS } from './sections.ts'
import type { CleSection } from './sections.ts'
import { SectionCompte } from './sections/Compte.tsx'
import { SectionDemo } from './sections/Demo.tsx'
import { SectionDonnees } from './sections/Donnees.tsx'
import { SectionZone } from './sections/Zone.tsx'
import { SectionAffichage } from './sections/Affichage.tsx'
import { SectionRegles } from './sections/Regles.tsx'
import { SectionRevision } from './sections/Revision.tsx'
import { TEXTES_PARAMETRES as T } from './textes.ts'
import { useBureau } from './useBureau.ts'
import { useReglages } from './useReglages.ts'

const idSection = (cle: CleSection) => `section-${cle}`

/** Sur le bureau, la page montre toutes les sections ; une adresse de section y mène par son ancre. */
export function PageParametres({ section }: { readonly section?: string }) {
  const bureau = useBureau()
  const { reglages, erreur, recharger, etat, enregistrer } = useReglages()
  const choisie = estSection(section) ? section : undefined

  useEffect(() => {
    if (bureau && choisie !== undefined) {
      document.getElementById(idSection(choisie))?.scrollIntoView()
    }
  }, [bureau, choisie, reglages === undefined])

  const corps = (cle: CleSection): ReactNode => {
    if (reglages === undefined) return null
    switch (cle) {
      case 'compte':
        return <SectionCompte reglages={reglages} enregistrer={enregistrer} />
      case 'revision':
        return <SectionRevision reglages={reglages} enregistrer={enregistrer} />
      case 'regles':
        return <SectionRegles reglages={reglages} />
      case 'affichage':
        return <SectionAffichage />
      case 'donnees':
        return <SectionDonnees />
      case 'zone':
        return <SectionZone />
      case 'demo':
        return <SectionDemo />
    }
  }

  const visibles = bureau
    ? SECTIONS
    : SECTIONS.filter(({ cle }) => choisie !== undefined && cle === choisie)

  let contenu: ReactNode
  if (erreur) contenu = <Erreur reessayer={recharger} />
  else if (reglages === undefined) contenu = <Chargement nombre={3} />
  else if (!bureau && choisie === undefined) {
    contenu = (
      <nav aria-label={T.choisir}>
        <h2 className="texte-sous-titre-18">{T.choisir}</h2>
        <ul className={styles['liste']}>
          {SECTIONS.map(({ cle, titre }) => (
            <li key={cle}>
              <a href={`#/parametres/${cle}`} className={styles['lien']}>
                {titre}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    )
  } else {
    contenu = visibles.map(({ cle, titre }) => (
      <section key={cle} id={idSection(cle)} aria-label={titre}>
        <EnTeteSection titre={titre} />
        <div className={styles['lignes']}>{corps(cle)}</div>
      </section>
    ))
  }

  return (
    <div className={styles['page']}>
      <header>
        {!bureau && choisie !== undefined && (
          <a href="#/parametres" className={`${styles['retour'] ?? ''} texte-petit-14`}>
            ← {T.retour}
          </a>
        )}
        <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
          {T.titre}
        </h1>
        {(bureau || choisie === undefined) && <p className="texte-corps-16">{T.introduction}</p>}
      </header>
      {etat === 'conflit' && <BandeauAlerte type="avertissement">{T.conflit}</BandeauAlerte>}
      {etat === 'echec' && <BandeauAlerte type="erreur">{T.erreurEnregistrement}</BandeauAlerte>}
      <div className={styles['corps']}>
        {bureau && (
          <nav aria-label={T.sommaire} className={styles['sommaire']}>
            <p className="texte-legende-12">{T.sommaire.toUpperCase()}</p>
            <ul className={styles['liste']}>
              {SECTIONS.map(({ cle, titre }) => (
                <li key={cle}>
                  <a href={`#/parametres/${cle}`} className={styles['lien']}>
                    {titre}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className={styles['sections']}>{contenu}</div>
      </div>
      <p className="texte-petit-14">{T.pied(NOM_APPLI)}</p>
    </div>
  )
}
