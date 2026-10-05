import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { Gabarit } from '../gabarit/Gabarit.tsx'
import { PageErreur } from './PageErreur.tsx'
import { PageIntrouvable } from './PageIntrouvable.tsx'
import { PageProvisoire } from './PageProvisoire.tsx'
import { validerRechercheJournal, validerRechercheModule } from './recherche.ts'

const racine = createRootRoute({
  staticData: { titre: '', navigation: null },
  component: Gabarit,
})

const connexion = createRoute({
  getParentRoute: () => racine,
  path: '/connexion',
  staticData: { titre: 'Connexion', navigation: null },
  component: () => <PageProvisoire titre="Connexion" />,
})

const aujourdhui = createRoute({
  getParentRoute: () => racine,
  path: '/',
  staticData: { titre: 'Aujourd’hui', navigation: 'aujourdhui' },
  component: () => <PageProvisoire titre="Aujourd’hui" />,
})

const questions = createRoute({
  getParentRoute: () => racine,
  path: '/questions',
  staticData: { titre: 'Questions de début de séance', navigation: null },
  component: () => <PageProvisoire titre="Questions de début de séance" />,
})

const formations = createRoute({
  getParentRoute: () => racine,
  path: '/formations',
  staticData: { titre: 'Formations', navigation: 'formations' },
  component: () => <PageProvisoire titre="Formations" />,
})

const formation = createRoute({
  getParentRoute: () => racine,
  path: '/formations/$formationId',
  staticData: { titre: 'Modules', navigation: 'formations' },
  component: () => <PageProvisoire titre="Modules" />,
})

const module = createRoute({
  getParentRoute: () => racine,
  path: '/modules/$moduleId',
  validateSearch: validerRechercheModule,
  staticData: { titre: 'Blocs', navigation: 'formations' },
  component: () => <PageProvisoire titre="Blocs" />,
})

const bloc = createRoute({
  getParentRoute: () => racine,
  path: '/blocs/$blocId',
  staticData: { titre: 'Page de bloc', navigation: null },
  component: () => <PageProvisoire titre="Page de bloc" />,
})

const revision = createRoute({
  getParentRoute: () => racine,
  path: '/revision',
  staticData: { titre: 'Révision', navigation: null },
  component: () => <PageProvisoire titre="Révision" />,
})

const verification = createRoute({
  getParentRoute: () => racine,
  path: '/verifications/$verificationId',
  staticData: { titre: 'Vérification', navigation: null },
  component: () => <PageProvisoire titre="Vérification" />,
})

const tableauDeBord = createRoute({
  getParentRoute: () => racine,
  path: '/tableau-de-bord',
  staticData: { titre: 'Tableau de bord', navigation: 'tableau' },
  component: () => <PageProvisoire titre="Tableau de bord" />,
})

const journal = createRoute({
  getParentRoute: () => racine,
  path: '/journal',
  validateSearch: validerRechercheJournal,
  staticData: { titre: 'Journal', navigation: 'journal' },
  component: () => <PageProvisoire titre="Journal" />,
})

const parametres = createRoute({
  getParentRoute: () => racine,
  path: '/parametres',
  staticData: { titre: 'Paramètres', navigation: 'parametres' },
  component: () => <PageProvisoire titre="Paramètres" />,
})

const sectionParametres = createRoute({
  getParentRoute: () => racine,
  path: '/parametres/$section',
  staticData: { titre: 'Paramètres', navigation: 'parametres' },
  component: () => <PageProvisoire titre="Paramètres" />,
})

const arbre = racine.addChildren([
  connexion,
  aujourdhui,
  questions,
  formations,
  formation,
  module,
  bloc,
  revision,
  verification,
  tableauDeBord,
  journal,
  parametres,
  sectionParametres,
])

export function creerRouteur(historique: RouterHistory) {
  return createRouter({
    routeTree: arbre,
    history: historique,
    defaultNotFoundComponent: PageIntrouvable,
    defaultErrorComponent: PageErreur,
  })
}

export type Routeur = ReturnType<typeof creerRouteur>

declare module '@tanstack/react-router' {
  interface Register {
    router: Routeur
  }
}
