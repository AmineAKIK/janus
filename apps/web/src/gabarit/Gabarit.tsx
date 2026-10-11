import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Navigation } from '@janus/ui'
import type { ProprietesLienNavigation } from '@janus/ui'
import { useEffect, useRef } from 'react'
import { TITRE_INTROUVABLE, titreDocument } from '../routes/ecrans.ts'
import styles from './Gabarit.module.css'

const ID_CONTENU = 'contenu'

function LienNavigation({
  cle,
  className,
  'aria-current': courant,
  children,
}: ProprietesLienNavigation) {
  const proprietes = { className, 'aria-current': courant, children }
  switch (cle) {
    case 'aujourdhui':
      return <Link to="/" {...proprietes} />
    case 'formations':
      return <Link to="/formations" {...proprietes} />
    case 'tableau':
      return <Link to="/tableau-de-bord" {...proprietes} />
    case 'journal':
      return <Link to="/journal" {...proprietes} />
    case 'parametres':
      return <Link to="/parametres" {...proprietes} />
  }
}

/**
 * Mise en page commune : navigation (seulement sur les écrans dont le cadre Figma la montre), lien
 * d'évitement, contenu. À chaque changement de route, le titre du document suit l'écran, le focus va
 * sur le `h1` et la page revient en haut.
 */
export function Gabarit() {
  const { chemin, titre, navigation, large, introuvable } = useRouterState({
    select: (etat) => {
      const ecran = etat.matches.findLast((route) => route.staticData.titre !== '')
      return {
        // `resolvedLocation` change quand la nouvelle page est rendue : avant, le `h1` est encore celui de l'ancienne.
        chemin: etat.resolvedLocation?.pathname,
        titre: ecran?.staticData.titre ?? TITRE_INTROUVABLE,
        navigation: ecran?.staticData.navigation ?? null,
        large: ecran?.staticData.large ?? false,
        introuvable: ecran === undefined,
      }
    },
  })
  const contenu = useRef<HTMLElement>(null)
  const precedent = useRef<string | undefined>(undefined)

  useEffect(() => {
    document.title = titreDocument(titre)
  }, [titre])

  useEffect(() => {
    // Tant que la première page n'est pas prête (la session se vérifie), puis à son affichage, le focus reste
    // au début de la page, pour que le lien d'évitement soit le premier arrêt.
    if (chemin === undefined) return
    if (precedent.current === undefined) {
      precedent.current = chemin
      return
    }
    precedent.current = chemin
    window.scrollTo(0, 0)
    contenu.current?.querySelector('h1')?.focus()
  }, [chemin])

  // La page introuvable garde la navigation, sans entrée courante.
  const avecNavigation = navigation !== null || introuvable
  return (
    <div
      className={`${styles['gabarit'] ?? ''}${avecNavigation ? ` ${styles['avecNavigation'] ?? ''}` : ''}`}
    >
      <a
        href={`#${ID_CONTENU}`}
        className={`${styles['evitement'] ?? ''} texte-petit-14`}
        onClick={(evenement) => {
          // L'adresse de l'appli est faite d'ancres : on ne laisse pas le navigateur la changer.
          evenement.preventDefault()
          contenu.current?.focus()
        }}
      >
        Aller au contenu
      </a>
      {avecNavigation && (
        <Navigation
          actif={navigation}
          lien={LienNavigation}
          className={styles['navigation'] ?? ''}
        />
      )}
      <main
        id={ID_CONTENU}
        ref={contenu}
        tabIndex={-1}
        className={`${styles['contenu'] ?? ''}${large ? ` ${styles['large'] ?? ''}` : ''}`}
      >
        <Outlet />
      </main>
    </div>
  )
}
