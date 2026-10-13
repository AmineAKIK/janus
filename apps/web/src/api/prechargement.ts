// Le préchargement des premières lectures. `public/amorcage.js` lance les requêtes avec la page (avant le
// JavaScript) et les range dans `window.janusPrecharges` ; `transportHttp` en reprend la réponse à la première
// lecture de même adresse, au lieu de refaire l'appel. Le `Transport` reste la seule porte : la réponse est
// validée comme n'importe quelle autre.

/** Le nom, sur `window`, de ce que `amorcage.js` a lancé : une entrée par adresse. */
const NOM_PAGE = 'janusPrecharges'

/** Au-delà, la réponse est trop vieille pour passer pour « la lecture de maintenant ». */
export const AGE_MAX_MS = 15_000

interface LectureLancee {
  readonly debut: number
  readonly reponse: Promise<Response>
}

function estLectureLancee(valeur: unknown): valeur is LectureLancee {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    'debut' in valeur &&
    typeof valeur.debut === 'number' &&
    'reponse' in valeur &&
    valeur.reponse instanceof Promise
  )
}

export interface Prechargements {
  /**
   * La réponse lancée à l'avance pour cette adresse, une seule fois. Seule une réponse réussie et récente
   * est reprise : une session absente (401) ou une panne ne doit jamais être resservie à une lecture
   * faite après une connexion.
   */
  readonly prendre: (adresse: string) => Promise<Response | undefined>
  /** Oublie tout ce qui n'a pas été repris : après une écriture (connexion, sortie), les lectures d'avant ne valent plus. */
  readonly vider: () => void
}

export function creerPrechargements(
  source: unknown,
  maintenant: () => number = () => performance.now(),
): Prechargements {
  const lectures = new Map<string, LectureLancee>()
  if (typeof source === 'object' && source !== null) {
    for (const [adresse, valeur] of Object.entries(source)) {
      if (estLectureLancee(valeur)) lectures.set(adresse, valeur)
    }
  }
  return {
    async prendre(adresse) {
      const lecture = lectures.get(adresse)
      if (lecture === undefined) return undefined
      lectures.delete(adresse)
      if (maintenant() - lecture.debut > AGE_MAX_MS) return undefined
      try {
        const reponse = await lecture.reponse
        return reponse.ok ? reponse : undefined
      } catch {
        return undefined
      }
    },
    vider() {
      lectures.clear()
    },
  }
}

/** Ce que la page a lancé avant le JavaScript (rien dans la démo, les tests ou si `amorcage.js` a échoué). */
export function prechargementsDeLaPage(fenetre: Window): Prechargements {
  return creerPrechargements(Reflect.get(fenetre, NOM_PAGE))
}

/**
 * Pour `vite.config.ts` : dit à `amorcage.js` où sont l'API et la base de l'appli. Seuls les builds qui
 * parlent à l'API (`VITE_TRANSPORT=http`) l'appellent ; la démo n'a rien à précharger.
 */
export function avecPrechargement(html: string, api: string, base: string): string {
  return html.replace(
    /<script src="([^"]*amorcage\.js)"><\/script>/u,
    (_balise, source: string) =>
      `<script src="${source}" data-api="${api.replace(/\/$/u, '')}" data-base="${base}"></script>`,
  )
}
