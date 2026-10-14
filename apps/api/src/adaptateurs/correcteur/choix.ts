import type { ConfigCorrecteur } from '../../config.ts'
import { creerClaude } from './claude.ts'
import type { Correcteur } from './correcteur.ts'
import type { Tarifs } from './cout.ts'
import { creerDeepseek } from './deepseek.ts'
import type { AppelHttp } from './deepseek.ts'

/**
 * Décision du 14 octobre 2026 : Haiku (Claude) est le tuteur principal, DeepSeek le secours, et une
 * correction rendue par le secours se voit dans l'appli.
 */
export function estDeSecours(modele: string): boolean {
  return modele.startsWith('deepseek')
}

/** Ce que l'appelant fixe, quel que soit le fournisseur. */
export interface LimitesCorrecteur {
  readonly delaiMs: number
  readonly jetonsSortieMax: number
}

export interface ChoixCorrecteur {
  /** `undefined` quand la clé du fournisseur choisi manque : la correction est indisponible. */
  readonly correcteur: Correcteur | undefined
  readonly tarifs: Tarifs
  readonly modele: string
}

/** Le correcteur que la configuration désigne (`CORRECTEUR`), avec ses tarifs et son modèle. */
export function correcteurDeLaConfig(
  config: ConfigCorrecteur,
  limites: LimitesCorrecteur,
  appel?: AppelHttp,
): ChoixCorrecteur {
  if (config.CORRECTEUR === 'claude') {
    return {
      correcteur:
        config.ANTHROPIC_API_KEY === undefined
          ? undefined
          : creerClaude(
              {
                cle: config.ANTHROPIC_API_KEY,
                url: config.CLAUDE_URL,
                modele: config.CLAUDE_MODELE,
                ...limites,
              },
              appel,
            ),
      tarifs: {
        entreeCache: config.CLAUDE_PRIX_ENTREE_CACHE,
        entree: config.CLAUDE_PRIX_ENTREE,
        sortie: config.CLAUDE_PRIX_SORTIE,
      },
      modele: config.CLAUDE_MODELE,
    }
  }
  return {
    correcteur:
      config.DEEPSEEK_API_KEY === undefined
        ? undefined
        : creerDeepseek(
            {
              cle: config.DEEPSEEK_API_KEY,
              url: config.DEEPSEEK_URL,
              modele: config.DEEPSEEK_MODELE,
              temperature: config.DEEPSEEK_TEMPERATURE,
              ...limites,
            },
            appel,
          ),
    tarifs: {
      entreeCache: config.DEEPSEEK_PRIX_ENTREE_CACHE,
      entree: config.DEEPSEEK_PRIX_ENTREE,
      sortie: config.DEEPSEEK_PRIX_SORTIE,
    },
    modele: config.DEEPSEEK_MODELE,
  }
}
