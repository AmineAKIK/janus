import { TypeEtape } from '@janus/contrats'
import type { NoteLue } from '@janus/moteur'
import type { ControleCorrection, MesureTemps } from '@janus/moteur'
import { z } from 'zod'

const Avis = z.looseObject({ correction: z.string(), accord: z.boolean() })
const DonneesTemps = z.looseObject({
  secondes: z.number().int().min(1),
  etape: TypeEtape.optional(),
})

/** Le contrôle de chaque correction rendue : l'avis d'Amine est le dernier donné. */
export function controlesDe(
  corrections: readonly {
    readonly id: string
    readonly date: string
    readonly echantillon: boolean
    readonly certitude: string
  }[],
  avis: readonly { readonly donnees: unknown }[],
): ControleCorrection[] {
  const accords = new Map<string, boolean>()
  for (const { donnees } of avis) {
    const lu = Avis.safeParse(donnees)
    if (lu.success) accords.set(lu.data.correction, lu.data.accord)
  }
  return corrections.map(({ id, date, echantillon, certitude }) => ({
    date,
    echantillon,
    nonVerifiee: certitude === 'non_verifie',
    accord: accords.get(id) ?? null,
  }))
}

/** Les mesures de temps actif, avec le code du bloc ; une ligne illisible est ignorée. */
export function mesuresDeTemps(
  lignes: readonly { readonly blocId: string; readonly date: string; readonly donnees: unknown }[],
  codes: ReadonlyMap<string, string>,
): MesureTemps[] {
  return lignes.flatMap(({ blocId, date, donnees }) => {
    const lu = DonneesTemps.safeParse(donnees)
    const bloc = codes.get(blocId)
    return lu.success && bloc !== undefined
      ? [{ date, bloc, secondes: lu.data.secondes, etape: lu.data.etape }]
      : []
  })
}

/** Les notes courantes : une note modifiée est une version de plus, la plus récente fait foi. */
export function notesCourantes(
  versions: readonly {
    readonly noteId: string
    readonly entree: string
    readonly texte: string
    readonly date: string
  }[],
): NoteLue[] {
  const notes = new Map<string, NoteLue>()
  for (const { noteId, entree, texte, date } of versions) {
    const precedente = notes.get(noteId)
    notes.set(noteId, { id: noteId, entree, texte, date: precedente?.date ?? date })
  }
  return [...notes.values()]
}
