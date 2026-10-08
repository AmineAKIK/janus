import { Catalogue } from './catalogue.ts'
import demo from '../fixtures/manifeste-demo.json' with { type: 'json' }
import { Manifeste } from './manifeste.ts'

// La graine : une formation « DWWM » d'exemple et un module 1 de 20 blocs. Ce sont des données
// d'exemple, pas des données du produit. Elle est partagée par la démo (navigateur) et par l'API
// que la CI démarre pour la suite de contrat (PR-089), pour que les deux parlent des mêmes blocs.

export interface BlocDuPlan {
  readonly code: string
  readonly titre: string
  readonly prerequis: readonly string[]
  readonly partie: string
}

export const PARTIES_GRAINE = [
  { code: 'P1', titre: 'Machine et logique' },
  { code: 'P2', titre: 'Réseaux et Web' },
  { code: 'P3', titre: 'Poste de travail' },
  { code: 'P4', titre: 'Sécurité et droit' },
  { code: 'P5', titre: 'Veille et synthèse' },
] as const

/** Les 20 blocs du module 1 : code, titre, prérequis et partie. */
const bloc = (
  code: string,
  titre: string,
  prerequis: readonly string[],
  partie: string,
): BlocDuPlan => ({ code, titre, prerequis, partie })

export const PLAN_GRAINE: readonly BlocDuPlan[] = [
  bloc('B01', 'Bits et codages', [], 'P1'),
  bloc('B02', 'Logique booléenne', ['B01'], 'P1'),
  bloc('B03', 'Ordinateur et composants', ['B01'], 'P1'),
  bloc('B04', 'Langages', ['B01', 'B03'], 'P1'),
  bloc('B05', 'Internet et le Web', ['B01'], 'P2'),
  bloc('B06', 'Réseau local', ['B01', 'B05'], 'P2'),
  bloc('B07', 'DNS, URL, HTTP', ['B05', 'B06'], 'P2'),
  bloc('B08', 'Environnement UNIX', ['B03', 'B04'], 'P3'),
  bloc('B09', 'Shell et man', ['B08'], 'P3'),
  bloc('B10', 'VS Code', ['B08', 'B09'], 'P3'),
  bloc('B11', 'IDE JetBrains', ['B04', 'B09', 'B10'], 'P3'),
  bloc('B12', 'Serveur local', ['B04', 'B07', 'B09', 'B10'], 'P3'),
  bloc('B13', 'GitHub et hébergement', ['B07', 'B12'], 'P3'),
  bloc('B14', 'Menaces', ['B06', 'B07'], 'P4'),
  bloc('B15', 'Se protéger', ['B12', 'B14'], 'P4'),
  bloc('B16', 'RGPD', ['B07', 'B14', 'B15'], 'P4'),
  bloc('B17', 'Droit d’auteur', ['B07', 'B13'], 'P4'),
  bloc('B18', 'Veille', ['B07', 'B13', 'B15', 'B17'], 'P5'),
  bloc('B19', 'Écosystème numérique', ['B04', 'B12', 'B18'], 'P5'),
  bloc('B20', 'Mise en situation', ['B02', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16'], 'P5'),
]

export const ERREUR_COMPILATEUR = 'confond_compilateur_interpreteur'

const MODELE = Manifeste.parse(demo)

/** Un manifeste par bloc : le manifeste de démonstration cloné, avec le code, le titre et les prérequis du bloc. */
export function manifesteDuBloc({ code, titre, prerequis }: BlocDuPlan): Manifeste {
  const erreurs =
    code === 'B04'
      ? [
          ...MODELE.erreurs_critiques,
          { id: ERREUR_COMPILATEUR, libelle: 'Confond compilateur et interpréteur.' },
        ]
      : MODELE.erreurs_critiques
  return Manifeste.parse({
    ...MODELE,
    bloc: code,
    titre,
    titre_court: titre,
    prerequis,
    erreurs_critiques: erreurs,
  })
}

export const MANIFESTES_GRAINE: Readonly<Record<string, Manifeste>> = Object.fromEntries(
  PLAN_GRAINE.map((bloc) => [bloc.code, manifesteDuBloc(bloc)]),
)

/** Le plan de la formation : le module 1 est importé, les autres attendent leurs fiches. */
export function catalogueGraine(): Catalogue {
  return Catalogue.parse({
    formation: {
      code: 'DWWM',
      titre: 'Développeur web et web mobile',
      description: 'Une formation d’exemple pour montrer l’appli.',
    },
    modules: [
      {
        code: 'M1',
        titre: 'Environnement numérique et poste de travail',
        description: 'Les bases de la machine, du réseau, du poste de travail et de la sécurité.',
        ordre: 1,
        importe: true,
        parties: PARTIES_GRAINE.map(({ code, titre }) => ({
          code,
          titre,
          blocs: PLAN_GRAINE.filter((bloc) => bloc.partie === code).map((bloc) => bloc.code),
        })),
      },
      {
        code: 'M2',
        titre: 'Réaliser une interface web statique',
        description: 'HTML et CSS.',
        ordre: 2,
        importe: false,
      },
      {
        code: 'M3',
        titre: 'Réaliser une interface web dynamique',
        description: 'JavaScript et accès aux données.',
        ordre: 3,
        importe: false,
      },
      {
        code: 'M4',
        titre: 'Créer une base de données',
        description: 'Modélisation et SQL.',
        ordre: 4,
        importe: false,
      },
    ],
  })
}
