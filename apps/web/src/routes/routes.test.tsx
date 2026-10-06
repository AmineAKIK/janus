import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MANIFESTES_GRAINE } from '../demo/graine.ts'
import { creerRouteur } from './arbre.tsx'
import { creerContexteTest } from './contexteTest.tsx'
import { PageErreur } from './PageErreur.tsx'
import { allerALaConnexion } from './connexion.ts'
import {
  validerRechercheConnexion,
  validerRechercheJournal,
  validerRechercheModule,
} from './recherche.ts'
import { creerHistorique, modeHistorique } from './historique.ts'

async function afficher(chemin: string, options: { connecte?: boolean } = {}) {
  const { contexte, application } = creerContexteTest(options)
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), contexte)
  await act(async () => {
    render(application(routeur))
    await routeur.load()
  })
  return routeur
}

const NAVIGATION = { name: 'Navigation principale' }

// Titre de l'écran et présence de la navigation d'après les cadres Figma.
const ECRANS = [
  { chemin: '/connexion', titre: 'Connexion', h1: 'Atelier', navigation: false },
  { chemin: '/', titre: 'Aujourd’hui', navigation: true },
  { chemin: '/questions', titre: 'Questions de début de séance', navigation: false },
  { chemin: '/formations', titre: 'Formations', navigation: true },
  {
    chemin: '/formations/DWWM',
    titre: 'Modules',
    h1: 'DWWM · Développeur web et web mobile',
    navigation: true,
  },
  { chemin: '/modules/M1', titre: 'Blocs', h1: 'Module 1', navigation: true },
  {
    chemin: '/modules/M1?statut=a_reprendre&detail=B05',
    titre: 'Blocs',
    h1: 'Module 1',
    navigation: true,
  },
  {
    chemin: '/blocs/B03',
    titre: 'Page de bloc',
    h1: MANIFESTES_GRAINE['B03']?.titre ?? '',
    navigation: false,
  },
  { chemin: '/revision', titre: 'Révision', navigation: false },
  {
    chemin: '/verifications/0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
    titre: 'Vérification',
    navigation: false,
  },
  { chemin: '/tableau-de-bord', titre: 'Tableau de bord', navigation: true },
  { chemin: '/journal', titre: 'Journal', navigation: true },
  { chemin: '/journal?bloc=B04&type=correction', titre: 'Journal', navigation: true },
  { chemin: '/parametres', titre: 'Paramètres', navigation: true },
  { chemin: '/parametres/revision', titre: 'Paramètres', navigation: true },
]

describe('routes', () => {
  it.each(ECRANS)('$chemin affiche « $titre »', async (ecran) => {
    const { chemin, titre, navigation } = ecran
    await afficher(chemin)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'h1' in ecran ? ecran.h1 : titre }),
    ).toBeInTheDocument()
    expect(document.title).toBe(`${titre} · Atelier`)
    expect(screen.queryByRole('navigation', NAVIGATION) !== null).toBe(navigation)
  })

  it('met en avant l’entrée de navigation de l’écran', async () => {
    await afficher('/modules/M1')

    expect(screen.getByRole('link', { name: 'Formations' })).toHaveAttribute('aria-current', 'page')
  })

  it('garde les paramètres de recherche non vides', async () => {
    const routeur = await afficher('/journal?bloc=B04&type=correction')

    expect(routeur.state.matches.at(-1)?.search).toEqual({ bloc: 'B04', type: 'correction' })
  })
})

describe('garde des routes', () => {
  it('sans session, mène à la connexion en gardant la page demandée', async () => {
    const routeur = await afficher('/journal?bloc=B04', { connecte: false })

    expect(routeur.state.location.pathname).toBe('/connexion')
    expect(routeur.state.location.search).toEqual({ retour: '/journal?bloc=B04' })
    expect(screen.getByRole('heading', { level: 1, name: 'Atelier' })).toBeInTheDocument()
  })

  it('la connexion elle-même reste accessible sans session', async () => {
    const routeur = await afficher('/connexion', { connecte: false })

    expect(routeur.state.location.pathname).toBe('/connexion')
  })

  it('avec une session, ouvre la page demandée et garde le compte en cache', async () => {
    const routeur = await afficher('/journal')

    expect(routeur.state.location.pathname).toBe('/journal')
  })
})

describe('paramètres de recherche', () => {
  it('ignorent les valeurs vides ou qui ne sont pas du texte', () => {
    expect(validerRechercheJournal({ bloc: 'B04', type: '' })).toEqual({ bloc: 'B04' })
    expect(validerRechercheJournal({ bloc: 12, type: 'correction' })).toEqual({
      type: 'correction',
    })
    expect(validerRechercheModule({ statut: 'a_reprendre', detail: 'B05' })).toEqual({
      statut: 'a_reprendre',
      detail: 'B05',
    })
    expect(validerRechercheModule({})).toEqual({})
  })
})

describe('retour après la connexion', () => {
  it('mène à la connexion en gardant la page demandée', async () => {
    const routeur = await afficher('/journal?bloc=B04')

    await act(async () => {
      allerALaConnexion(routeur)
      await routeur.load()
    })

    expect(routeur.state.location.pathname).toBe('/connexion')
    expect(routeur.state.location.search).toEqual({ retour: '/journal?bloc=B04' })
  })

  it('ne boucle pas quand on est déjà sur la connexion', async () => {
    const routeur = await afficher('/connexion')

    allerALaConnexion(routeur)

    expect(routeur.state.location.search).toEqual({})
  })

  it('ne retient qu’un chemin de l’appli, jamais un autre site', () => {
    expect(validerRechercheConnexion({ retour: '/formations' })).toEqual({ retour: '/formations' })
    expect(validerRechercheConnexion({ retour: 'https://autre.example' })).toEqual({})
    expect(validerRechercheConnexion({ retour: '//autre.example' })).toEqual({})
    expect(validerRechercheConnexion({})).toEqual({})
  })
})

describe('changement de route', () => {
  it('met à jour le titre, remonte en haut et met le focus sur le h1', async () => {
    const routeur = await afficher('/')
    const defilement = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    await act(async () => {
      await routeur.navigate({ to: '/journal' })
    })

    expect(document.title).toBe('Journal · Atelier')
    expect(screen.getByRole('heading', { level: 1, name: 'Journal' })).toHaveFocus()
    expect(defilement).toHaveBeenCalledWith(0, 0)
  })

  it('ne prend pas le focus au premier affichage', async () => {
    await afficher('/')

    expect(document.body).toHaveFocus()
  })

  it('ne déplace pas le focus quand seuls les paramètres de recherche changent', async () => {
    const routeur = await afficher('/journal')
    const bouton = document.createElement('button')
    document.body.append(bouton)
    bouton.focus()

    await act(async () => {
      await routeur.navigate({ to: '/journal', search: { bloc: 'B04' } })
    })

    expect(bouton).toHaveFocus()
    bouton.remove()
  })

  it('le retour du navigateur revient à l’écran précédent', async () => {
    const routeur = await afficher('/')
    await act(async () => {
      await routeur.navigate({ to: '/formations' })
    })

    act(() => {
      routeur.history.back()
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aujourd’hui' }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Aujourd’hui · Atelier')
  })
})

describe('lien d’évitement', () => {
  it('est le premier élément focusable et mène au contenu', async () => {
    const utilisateur = userEvent.setup()
    await afficher('/formations')

    await utilisateur.tab()
    const lien = screen.getByRole('link', { name: 'Aller au contenu' })
    expect(lien).toHaveFocus()

    await utilisateur.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
  })
})

describe('page introuvable', () => {
  it('annonce que la page n’existe pas et renvoie à Aujourd’hui', async () => {
    await afficher('/n-importe-quoi')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cette page n’existe pas' }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Cette page n’existe pas · Atelier')
    expect(screen.getByRole('link', { name: 'Aller à Aujourd’hui' })).toHaveAttribute('href', '/')
  })
})

describe('frontière d’erreur', () => {
  it('affiche un bandeau d’erreur avec un bouton Recharger', () => {
    const recharger = vi.fn()
    vi.stubGlobal('location', { reload: recharger })
    render(<PageErreur />)

    expect(screen.getByRole('alert')).toHaveTextContent('Quelque chose s’est mal passé')
    screen.getByRole('button', { name: 'Recharger' }).click()
    expect(recharger).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('est la frontière par défaut de toutes les routes', () => {
    const { contexte } = creerContexteTest()
    const routeur = creerRouteur(createMemoryHistory({ initialEntries: ['/'] }), contexte)

    expect(routeur.options.defaultErrorComponent).toBe(PageErreur)
  })
})

describe('historique', () => {
  it('prend les ancres par défaut et les chemins sur demande', () => {
    expect(modeHistorique(undefined)).toBe('ancre')
    expect(modeHistorique('n-importe-quoi')).toBe('ancre')
    expect(modeHistorique('chemins')).toBe('chemins')
  })

  it('crée un historique par ancres ou par chemins', () => {
    window.history.replaceState(null, '', '/')
    const ancres = creerHistorique('ancre')
    ancres.push('/journal')
    ancres.flush()
    expect(window.location.hash).toBe('#/journal')

    const chemins = creerHistorique('chemins')
    chemins.push('/formations')
    chemins.flush()
    expect(window.location.pathname).toBe('/formations')
  })
})
