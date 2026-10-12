import { asc, eq } from 'drizzle-orm'
import * as t from './schema/index.ts'
import type { Db, Tx } from './transaction.ts'

/**
 * La formation que l'utilisateur affiche : celle de ses réglages si elle existe encore et que l'un de
 * ses modules est importé, sinon la première formation importée (ordre des codes). `null` tant qu'aucun
 * module n'est importé.
 */
export async function formationActiveDe(
  lecteur: Db | Tx,
  choisie: string | null,
): Promise<string | null> {
  const lignes = await lecteur
    .selectDistinct({ id: t.formations.id, code: t.formations.code })
    .from(t.formations)
    .innerJoin(t.modules, eq(t.modules.formationId, t.formations.id))
    .where(eq(t.modules.importe, true))
    .orderBy(asc(t.formations.code))
  if (choisie !== null && lignes.some(({ id }) => id === choisie)) return choisie
  return lignes[0]?.id ?? null
}

/** Restreint une requête qui joint `modules` à la formation affichée (rien ne filtre si aucune n'est importée). */
export const deLaFormation = (formationId: string | null) =>
  formationId === null ? undefined : eq(t.modules.formationId, formationId)
