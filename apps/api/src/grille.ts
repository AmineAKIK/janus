import { z } from 'zod'
import type { Manifeste } from '@janus/contrats'

/**
 * Les règles de la méthode d'apprentissage qu'une fiche applique ou écarte, au niveau de la formation
 * comme son catalogue : `contenu/<formation>/methode/regles.json`. Sans ce fichier, la formation
 * n'exige pas de grille.
 */
export const CHEMIN_REGLES = 'methode/regles.json'

/** Le fichier de grille d'une fiche, à côté d'elle : `<bloc>.grille.md`. */
export function nomDeLaGrille(bloc: string): string {
  return `${bloc}.grille.md`
}

const Texte = z.string().trim().min(1)

/** Ce que pèse une règle dans la méthode : le noyau ne s'écarte jamais, le reste s'écarte avec une raison écrite. */
const StatutDeRegle = z.enum(['noyau', 'par défaut', 'réglage'])

const Regle = z.strictObject({
  id: z.string().regex(/^[A-Z]\d{2}$/),
  section: Texte,
  statut: StatutDeRegle,
  titre: Texte,
  texte: Texte,
})
export type RegleDeLaMethode = z.infer<typeof Regle>

/** `methode/regles.json` : la version de la méthode, le sens de chaque statut et les règles, à identifiants uniques. */
export const ReglesDeLaMethode = z
  .object({
    version: Texte,
    statuts: z.record(z.string(), z.string()),
    regles: z.array(Regle),
  })
  .refine((lu) => new Set(lu.regles.map(({ id }) => id)).size === lu.regles.length, {
    path: ['regles'],
    message: 'deux règles portent le même identifiant',
  })

export type LectureDesRegles =
  | { readonly ok: true; readonly regles: ReadonlyMap<string, RegleDeLaMethode> }
  | { readonly ok: false; readonly probleme: string }

/**
 * Les règles d'un `regles.json`, par identifiant, ou le premier problème qui empêche de les lire : un
 * fichier de règles faux ne vaut aucune grille, il se corrige avant les fiches.
 */
export function lireLesRegles(texte: string): LectureDesRegles {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return { ok: false, probleme: 'le fichier n’est pas du JSON valide.' }
  }
  const lu = ReglesDeLaMethode.safeParse(brut)
  if (!lu.success) {
    const [premier] = lu.error.issues
    const chemin = premier?.path.map(String).join('.') ?? ''
    return {
      ok: false,
      probleme: `le fichier ne se lit pas (${chemin === '' ? '' : `${chemin} : `}${premier?.message ?? 'structure inattendue'}) : version, statuts, et regles avec id, section, statut (noyau, par défaut, réglage), titre et texte ; aucune grille n’est contrôlée pour cette formation.`,
    }
  }
  return { ok: true, regles: new Map(lu.data.regles.map((regle) => [regle.id, regle])) }
}

/** Ce qu'une ligne de la grille dit d'une règle, casse et espaces mis à part : rien d'autre n'est admis. */
const STATUTS_DE_GRILLE = ['appliquée', 'écartée'] as const
type StatutDeGrille = (typeof STATUTS_DE_GRILLE)[number]

function statutDeGrille(cellule: string): StatutDeGrille | undefined {
  const lu = cellule.trim().toLowerCase()
  return STATUTS_DE_GRILLE.find((statut) => statut === lu)
}

/** Une ligne du tableau : `| <règle> | <statut> | <où, ou pourquoi pas> |` ; la troisième colonne prend le reste. */
const LIGNE_DU_TABLEAU = /^\|([^|]*)\|([^|]*)\|(.*)\|$/
/** La ligne qui sépare l'en-tête du tableau de ses lignes : `| --- | --- | --- |`. */
const SEPARATEUR_DU_TABLEAU = /^\|(?:\s*:?-+:?\s*\|)+$/

/** Les étapes (`ET2`) que cite la troisième colonne d'une règle appliquée. */
const ETAPE_CITEE = /\bET\d+\b/g
/** Les items de pratique (`PR1-2`) ou exercices (`PR1`) que cite la troisième colonne. */
const ITEM_CITE = /\bPR\d+(?:-\d+)?\b/g
/** Ce qui vit hors des étapes : le manifeste et le tableau d'alignement. */
const HORS_ETAPES = /\b(?:manifeste|alignement)\b/i

/** Ce que la grille lit dans le manifeste : le bloc et la version qu'elle décrit, les étapes et les items qu'elle peut citer. */
export type ManifestePourLaGrille = Pick<Manifeste, 'bloc' | 'version' | 'etapes' | 'pratique'>

/**
 * La grille de la méthode d'une fiche (`<bloc>.grille.md`), confrontée aux règles de la formation et au
 * manifeste : une ligne par règle, qui dit où la règle est appliquée ou pourquoi elle est écartée.
 * Une règle du noyau ne s'écarte pas ; une règle appliquée cite l'endroit (étape, item, manifeste ou
 * alignement). La grille se refait à chaque version : son en-tête porte le bloc et la version du manifeste.
 * Chaque message commence par `grille : ` pour qu'on sache d'où il vient.
 */
export function verifierGrille(
  grille: string,
  regles: ReadonlyMap<string, RegleDeLaMethode>,
  manifeste: ManifestePourLaGrille,
  signaler: (message: string) => void,
): void {
  const lignes = grille.split(/\r?\n/)
  const enTete = lignes.find((ligne) => ligne.trim() !== '')
  const enTeteAttendu = `# Grille de la méthode : ${manifeste.bloc}, version ${String(manifeste.version)}`
  if (enTete?.trim() !== enTeteAttendu) {
    signaler(
      `grille : la première ligne doit être « ${enTeteAttendu} » (la grille se refait à chaque version de la fiche), et non ${enTete === undefined ? 'rien' : `« ${enTete.trim()} »`}.`,
    )
  }

  const etapes = new Set(manifeste.etapes.map(({ id }) => id))
  const items = new Set(
    manifeste.pratique.flatMap((exercice) => [exercice.id, ...exercice.items.map(({ id }) => id)]),
  )
  /** La ligne où chaque règle a été vue, pour nommer les deux lignes d'un doublon. */
  const vues = new Map<string, number>()
  let enTeteDuTableauVu = false
  lignes.forEach((brute, index) => {
    const ligne = brute.trim()
    if (!ligne.startsWith('|')) return
    // La première ligne du tableau nomme les colonnes, la suivante les souligne : aucune règle là.
    if (!enTeteDuTableauVu) {
      enTeteDuTableauVu = true
      return
    }
    if (SEPARATEUR_DU_TABLEAU.test(ligne)) return
    const numero = index + 1
    const lu = LIGNE_DU_TABLEAU.exec(ligne)
    if (lu === null) {
      signaler(
        `grille : la ligne ${String(numero)} du tableau ne se lit pas : attendu « | <règle> | appliquée ou écartée | où, ou pourquoi pas | ».`,
      )
      return
    }
    const id = (lu[1] ?? '').trim()
    const regle = regles.get(id)
    if (regle === undefined) {
      signaler(
        `grille : ligne ${String(numero)} : la règle « ${id} » n’est pas dans ${CHEMIN_REGLES}.`,
      )
      return
    }
    const deja = vues.get(id)
    if (deja !== undefined) {
      signaler(
        `grille : la règle ${id} figure deux fois (lignes ${String(deja)} et ${String(numero)}) : une ligne par règle.`,
      )
      return
    }
    vues.set(id, numero)
    const statut = statutDeGrille(lu[2] ?? '')
    if (statut === undefined) {
      signaler(
        `grille : ligne ${String(numero)} (${id}) : le statut « ${(lu[2] ?? '').trim()} » n’est ni « appliquée » ni « écartée ».`,
      )
      return
    }
    if (statut === 'écartée' && regle.statut === 'noyau') {
      signaler(
        `grille : la règle ${id} (${regle.titre}) est du noyau de la méthode : elle ne s’écarte pas, elle s’applique.`,
      )
    }
    const texte = (lu[3] ?? '').trim()
    if (texte === '') {
      signaler(
        `grille : ligne ${String(numero)} (${id}) : la troisième colonne est vide : ${statut === 'appliquée' ? 'dis où la règle est appliquée' : 'dis pourquoi la règle est écartée'}.`,
      )
      return
    }
    if (statut !== 'appliquée') return
    const etapesCitees = new Set(Array.from(texte.matchAll(ETAPE_CITEE), ([citee]) => citee))
    const itemsCites = new Set(Array.from(texte.matchAll(ITEM_CITE), ([cite]) => cite))
    if (etapesCitees.size === 0 && itemsCites.size === 0 && !HORS_ETAPES.test(texte)) {
      signaler(
        `grille : ligne ${String(numero)} (${id}, appliquée) : la colonne ne dit pas où : cite une étape (ET2), un item de pratique (PR1-2), le manifeste ou l’alignement.`,
      )
    }
    for (const citee of etapesCitees) {
      if (!etapes.has(citee)) {
        signaler(
          `grille : ligne ${String(numero)} (${id}) cite ${citee}, qui n’est pas une étape du manifeste.`,
        )
      }
    }
    for (const cite of itemsCites) {
      if (!items.has(cite)) {
        signaler(
          `grille : ligne ${String(numero)} (${id}) cite ${cite}, qui n’est ni un exercice ni un item de pratique du manifeste.`,
        )
      }
    }
  })

  const manquantes = Array.from(regles.keys()).filter((id) => !vues.has(id))
  if (manquantes.length > 0) {
    signaler(
      `grille : il manque les règles ${manquantes.join(', ')} : une ligne par règle de ${CHEMIN_REGLES}, appliquée ou écartée.`,
    )
  }
}
