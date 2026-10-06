import { createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { PageBloc } from '../bloc/PageBloc.tsx'
import { PageBlocs } from '../catalogue/PageBlocs.tsx'
import { PageFormations } from '../catalogue/PageFormations.tsx'
import { PageModules } from '../catalogue/PageModules.tsx'
import { PageConnexion } from '../connexion/PageConnexion.tsx'
import { Gabarit } from '../gabarit/Gabarit.tsx'
import { exigerSession } from './garde.ts'
import type { ContexteRouteur } from './garde.ts'
import { PageErreur } from './PageErreur.tsx'
import { PageIntrouvable } from './PageIntrouvable.tsx'
import { PageAujourdhui } from '../aujourdhui/PageAujourdhui.tsx'
import { PageProvisoire } from './PageProvisoire.tsx'
import {
  validerRechercheConnexion,
  validerRechercheJournal,
  validerRechercheModule,
} from './recherche.ts'

const racine = createRootRouteWithContext<ContexteRouteur>()({
  staticData: { titre: '', navigation: null },
  beforeLoad: async ({ context, location }) => {
    if (location.pathname !== '/connexion') await exigerSession(context, location.href)
  },
  component: Gabarit,
})

const connexion = createRoute({
  getParentRoute: () => racine,
  path: '/connexion',
  validateSearch: validerRechercheConnexion,
  staticData: { titre: 'Connexion', navigation: null },
  component: PageConnexion,
})

const aujourdhui = createRoute({
  getParentRoute: () => racine,
  path: '/',
  staticData: { titre: 'Aujourd’hui', navigation: 'aujourdhui', large: true },
  component: PageAujourdhui,
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
  component: PageFormations,
})

const formation = createRoute({
  getParentRoute: () => racine,
  path: '/formations/$formationId',
  staticData: { titre: 'Modules', navigation: 'formations' },
  component: function RoutePageModules() {
    const { formationId } = formation.useParams()
    return <PageModules formationId={formationId} />
  },
})

const module = createRoute({
  getParentRoute: () => racine,
  path: '/modules/$moduleId',
  validateSearch: validerRechercheModule,
  staticData: { titre: 'Blocs', navigation: 'formations' },
  component: function RoutePageBlocs() {
    const { moduleId } = module.useParams()
    const { statut, detail } = module.useSearch()
    return <PageBlocs moduleId={moduleId} statut={statut} detail={detail} />
  },
})

const bloc = createRoute({
  getParentRoute: () => racine,
  path: '/blocs/$blocId',
  staticData: { titre: 'Page de bloc', navigation: null },
  component: function RoutePageBloc() {
    const { blocId } = bloc.useParams()
    return <PageBloc blocId={blocId} />
  },
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

export function creerRouteur(historique: RouterHistory, contexte: ContexteRouteur) {
  return createRouter({
    routeTree: arbre,
    history: historique,
    context: contexte,
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
