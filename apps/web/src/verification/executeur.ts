import { ResultatExecuteur } from '@janus/contrats'
import type { ReponseCas } from '@janus/contrats'

/** Le temps accordé à chaque cas avant qu'on arrête son exécution. */
export const DELAI_PAR_CAS_MS = 2000

export interface CasDeTest {
  readonly entree: readonly unknown[]
  readonly sortie: unknown
}

export interface ResultatCas {
  readonly reussi: boolean
  /** Ce que la fonction a rendu, quand elle a rendu quelque chose. */
  readonly obtenu?: unknown
  /** `temps_depasse` ou le message de l'erreur levée. */
  readonly erreur?: string
}

export interface ResultatExecution {
  /** Le code exécuté, gardé avec la réponse pour pouvoir être réexaminé. */
  readonly code: string
  readonly cas: readonly ResultatCas[]
  readonly reussis: number
}

function estObjet(valeur: unknown): valeur is Readonly<Record<string, unknown>> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

/** Égalité profonde de deux valeurs JSON : l'ordre des clés d'un objet ne compte pas. */
export function egalJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((element: unknown, rang) => egalJson(element, b[rang]))
    )
  }
  if (estObjet(a) && estObjet(b)) {
    const cles = Object.keys(a)
    return (
      cles.length === Object.keys(b).length &&
      cles.every((cle) => cle in b && egalJson(a[cle], b[cle]))
    )
  }
  return Object.is(a, b) || (typeof a === 'number' && typeof b === 'number' && a === b)
}

/** Confronte ce que le Worker a rendu à la sortie attendue de chaque cas. */
export function jugerCas(
  cas: readonly CasDeTest[],
  reponses: readonly ReponseCas[],
): ResultatCas[] {
  return cas.map((attendu, rang): ResultatCas => {
    const reponse = reponses[rang]
    if (reponse === undefined) return { reussi: false, erreur: 'temps_depasse' }
    if (!reponse.ok) return { reussi: false, erreur: reponse.erreur }
    return { reussi: egalJson(reponse.sortie, attendu.sortie), obtenu: reponse.sortie }
  })
}

function lireReponses(donnees: unknown, id: string): readonly ReponseCas[] | null {
  const lecture = ResultatExecuteur.safeParse(donnees)
  return lecture.success && lecture.data.id === id ? lecture.data.resultats : null
}

let compteur = 0

export interface OptionsExecution {
  readonly delaiMs?: number
  /** L'adresse de `executeur.html` ; par défaut, celle qui est publiée avec l'appli. */
  readonly adresse?: string
}

/**
 * Exécute le code sur chaque cas dans une iframe cachée `sandbox="allow-scripts"` : une origine
 * opaque qui ne voit ni cookies ni stockage de l'appli. L'iframe lance un Web Worker par cas et
 * l'arrête au bout du délai ; l'appli ne bloque donc jamais sur une boucle infinie.
 */
export function executerCode(
  code: string,
  cas: readonly CasDeTest[],
  {
    delaiMs = DELAI_PAR_CAS_MS,
    adresse = `${import.meta.env.BASE_URL}executeur.html`,
  }: OptionsExecution = {},
): Promise<ResultatExecution> {
  return new Promise((resoudre) => {
    compteur += 1
    const id = `execution-${String(compteur)}`
    const iframe = document.createElement('iframe')
    iframe.hidden = true
    iframe.title = 'Exécuteur de code'
    iframe.setAttribute('sandbox', 'allow-scripts')
    let termine = false
    // Filet de sécurité si l'iframe ne répond jamais : tous les cas plus une marge.
    const filet = setTimeout(
      () => {
        terminer([])
      },
      delaiMs * (cas.length + 1) + delaiMs,
    )

    function terminer(reponses: readonly ReponseCas[]) {
      if (termine) return
      termine = true
      clearTimeout(filet)
      removeEventListener('message', surMessage)
      iframe.remove()
      const jugees = jugerCas(cas, reponses)
      resoudre({ code, cas: jugees, reussis: jugees.filter(({ reussi }) => reussi).length })
    }

    function surMessage(evenement: MessageEvent) {
      if (evenement.source !== iframe.contentWindow) return
      if (estObjet(evenement.data) && evenement.data['type'] === 'pret') {
        iframe.contentWindow?.postMessage({ type: 'executer', id, code, cas, delaiMs }, '*')
        return
      }
      const reponses = lireReponses(evenement.data, id)
      if (reponses !== null) terminer(reponses)
    }

    addEventListener('message', surMessage)
    iframe.src = adresse
    document.body.append(iframe)
  })
}
