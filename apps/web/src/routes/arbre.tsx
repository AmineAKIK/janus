import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { PageConnexion } from '../connexion/PageConnexion.tsx'
import { Gabarit } from '../gabarit/Gabarit.tsx'
import { exigerSession } from './garde.ts'
import type { ContexteRouteur } from './garde.ts'
import { PageErreur } from './PageErreur.tsx'
import { PageIntrouvable } from './PageIntrouvable.tsx'
import { PageAujourdhui } from '../aujourdhui/PageAujourdhui.tsx'
import {
  validerRechercheConnexion,
  validerRechercheJournal,
  validerRechercheBloc,
  validerRechercheModule,
  validerRechercheSuivi,
} from './recherche.ts'

// Les écrans moins visités se chargent à la demande : le premier lancement ne télécharge que l'essentiel.
// Le service worker garde déjà tous les morceaux, hors connexion rien ne manque.
const PageBloc = lazyRouteComponent(() => import('../bloc/PageBloc.tsx'), 'PageBloc')
const PageBlocs = lazyRouteComponent(() => import('../catalogue/PageBlocs.tsx'), 'PageBlocs')
const PageFormations = lazyRouteComponent(
  () => import('../catalogue/PageFormations.tsx'),
  'PageFormations',
)
const PageModules = lazyRouteComponent(() => import('../catalogue/PageModules.tsx'), 'PageModules')
const PageJournal = lazyRouteComponent(() => import('../journal/PageJournal.tsx'), 'PageJournal')
const PageParametres = lazyRouteComponent(
  () => import('../parametres/PageParametres.tsx'),
  'PageParametres',
)
const PageQuestions = lazyRouteComponent(
  () => import('../questions/PageQuestions.tsx'),
  'PageQuestions',
)
const PageRevision = lazyRouteComponent(
  () => import('../revision/PageRevision.tsx'),
  'PageRevision',
)
const PageVerification = lazyRouteComponent(
  () => import('../verification/PageVerification.tsx'),
  'PageVerification',
)
const OuvrirVerification = lazyRouteComponent(
  () => import('../verification/OuvrirVerification.tsx'),
  'OuvrirVerification',
)
const PageSuivi = lazyRouteComponent(() => import('../suivi/PageSuivi.tsx'), 'PageSuivi')

/** Charge l'écran avant l'affichage de la route : pas de flash de chargement, et les tests restent synchrones. */
const prechargerPage = (page: { preload?: () => Promise<void> | undefined }) => async () => {
  await page.preload?.()
}

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
  loader: prechargerPage(PageQuestions),
  component: PageQuestions,
})

const formations = createRoute({
  getParentRoute: () => racine,
  path: '/formations',
  staticData: { titre: 'Formations', navigation: 'formations' },
  loader: prechargerPage(PageFormations),
  component: PageFormations,
})

const formation = createRoute({
  getParentRoute: () => racine,
  path: '/formations/$formationId',
  staticData: { titre: 'Modules', navigation: 'formations' },
  loader: prechargerPage(PageModules),
  component: function RoutePageModules() {
    const { formationId } = formation.useParams()
    return <PageModules formationId={formationId} />
  },
})

const module = createRoute({
  getParentRoute: () => racine,
  path: '/modules/$moduleId',
  validateSearch: validerRechercheModule,
  staticData: { titre: 'Blocs', navigation: 'formations', large: true },
  loader: prechargerPage(PageBlocs),
  component: function RoutePageBlocs() {
    const { moduleId } = module.useParams()
    const { statut, detail } = module.useSearch()
    return <PageBlocs moduleId={moduleId} statut={statut} detail={detail} />
  },
})

const bloc = createRoute({
  getParentRoute: () => racine,
  path: '/blocs/$blocId',
  validateSearch: validerRechercheBloc,
  staticData: { titre: 'Page de bloc', navigation: null },
  loader: prechargerPage(PageBloc),
  component: function RoutePageBloc() {
    const { blocId } = bloc.useParams()
    const { etape } = bloc.useSearch()
    return <PageBloc blocId={blocId} etape={etape} />
  },
})

const revision = createRoute({
  getParentRoute: () => racine,
  path: '/revision',
  staticData: { titre: 'Révision', navigation: null },
  loader: prechargerPage(PageRevision),
  component: PageRevision,
})

/** Là où mène la file du jour : ouvre la vérification d'un bloc puis la remplace par elle. */
const ouvrirVerification = createRoute({
  getParentRoute: () => racine,
  path: '/verifications/ouvrir/$bloc/$type',
  staticData: { titre: 'Vérification', navigation: null },
  loader: prechargerPage(OuvrirVerification),
  component: function RouteOuvrirVerification() {
    const { bloc, type } = ouvrirVerification.useParams()
    const naviguer = ouvrirVerification.useNavigate()
    return (
      <OuvrirVerification
        bloc={bloc}
        type={type}
        surOuverte={(id) => {
          void naviguer({
            to: '/verifications/$verificationId',
            params: { verificationId: id },
            replace: true,
          })
        }}
      />
    )
  },
})

const verification = createRoute({
  getParentRoute: () => racine,
  path: '/verifications/$verificationId',
  staticData: { titre: 'Vérification', navigation: null },
  loader: prechargerPage(PageVerification),
  component: function RouteVerification() {
    const { verificationId } = verification.useParams()
    return <PageVerification id={verificationId} />
  },
})

const tableauDeBord = createRoute({
  getParentRoute: () => racine,
  path: '/tableau-de-bord',
  validateSearch: validerRechercheSuivi,
  staticData: { titre: 'Suivi', navigation: 'tableau', large: true },
  loader: prechargerPage(PageSuivi),
  component: function RoutePageSuivi() {
    const { module, periode } = tableauDeBord.useSearch()
    return <PageSuivi module={module} periode={periode} />
  },
})

const journal = createRoute({
  getParentRoute: () => racine,
  path: '/journal',
  validateSearch: validerRechercheJournal,
  staticData: { titre: 'Journal', navigation: 'journal', large: true },
  loader: prechargerPage(PageJournal),
  component: function RoutePageJournal() {
    const recherche = journal.useSearch()
    const naviguer = journal.useNavigate()
    return (
      <PageJournal
        recherche={recherche}
        surFiltres={(filtres) => {
          void naviguer({ search: filtres })
        }}
      />
    )
  },
})

const parametres = createRoute({
  getParentRoute: () => racine,
  path: '/parametres',
  staticData: { titre: 'Paramètres', navigation: 'parametres' },
  loader: prechargerPage(PageParametres),
  component: () => <PageParametres />,
})

const sectionParametres = createRoute({
  getParentRoute: () => racine,
  path: '/parametres/$section',
  staticData: { titre: 'Paramètres', navigation: 'parametres' },
  loader: prechargerPage(PageParametres),
  component: function SectionParametres() {
    const { section } = sectionParametres.useParams()
    return <PageParametres section={section} />
  },
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
  ouvrirVerification,
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
