import { z } from 'zod'

const Texte = z.string().trim().min(1)
const CodeBloc = z.string().regex(/^[A-Z]{1,3}\d{2,3}$/)

/** Ce que l'appli affiche pour un module dont les fiches ne sont pas encore importées. */
export const LIBELLE_MODULE_NON_IMPORTE = 'Pas encore importé'

const Partie = z.strictObject({
  code: z.string().regex(/^P\d+$/),
  titre: Texte,
  /** Codes des blocs, dans l'ordre du plan. */
  blocs: z.array(CodeBloc),
})

const ModuleBase = {
  code: Texte,
  titre: Texte,
  description: z.string().trim(),
  ordre: z.number().int(),
}

const Module = z.discriminatedUnion('importe', [
  z.strictObject({ ...ModuleBase, importe: z.literal(true), parties: z.array(Partie) }),
  z.strictObject({ ...ModuleBase, importe: z.literal(false) }),
])
export type ModuleCatalogue = z.infer<typeof Module>

/** Une formation importée à part des fiches : le plan des modules, des parties et des blocs. */
export const Catalogue = z.strictObject({
  formation: z.strictObject({ code: Texte, titre: Texte, description: z.string().trim() }),
  modules: z.array(Module),
})
export type Catalogue = z.infer<typeof Catalogue>
