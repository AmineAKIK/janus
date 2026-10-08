import { and, asc, eq, notInArray, sql } from 'drizzle-orm'
import type { Base } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import type { Tx } from '../../base/transaction.ts'

export interface BlocTrouve {
  readonly id: string
  readonly code: string
  readonly moduleId: string
}

export interface VersionStockee {
  readonly id: string
  readonly version: number
  readonly empreinte: string
}

export interface NouvelleFormation {
  readonly code: string
  readonly titre: string
  readonly description: string
}
export interface NouveauModule {
  readonly code: string
  readonly titre: string
  readonly description: string
  readonly ordre: number
  readonly importe: boolean
  readonly parties: readonly {
    readonly code: string
    readonly titre: string
    readonly blocs: readonly string[]
  }[]
}

export interface CompteImportCatalogue {
  readonly formations: number
  readonly modules: number
  readonly parties: number
  readonly blocs: number
}

export interface NouvelleVersion {
  readonly id: string
  readonly blocId: string
  readonly version: number
  readonly empreinte: string
  readonly chemin: string
  readonly manifeste: unknown
  readonly creeLe: string
  readonly titreBloc: string
  readonly cartes: readonly {
    readonly carteId: string
    readonly recto: string
    readonly verso: string
  }[]
}

export interface CompteCartes {
  readonly ajoutees: number
  readonly retirees: number
  readonly total: number
}

/** Les ordres SQL de l'import : le plan de la formation, les versions de fiches, les cartes. */
export function creerDepotCatalogue(base: Base) {
  return {
    /** Insère ou met à jour la formation, ses modules, parties et blocs ; compte ce qui a été créé. */
    importerCatalogue: (
      formation: NouvelleFormation,
      modules: readonly NouveauModule[],
      nouvelId: () => string,
    ): Promise<CompteImportCatalogue> =>
      base.enTransaction(async (tx) => {
        const compte = { formations: 0, modules: 0, parties: 0, blocs: 0 }
        const cree = sql<boolean>`(xmax = 0)`
        const [laFormation] = await tx
          .insert(t.formations)
          .values({ id: nouvelId(), ...formation })
          .onConflictDoUpdate({
            target: t.formations.code,
            set: { titre: formation.titre, description: formation.description },
          })
          .returning({ id: t.formations.id, cree })
        if (laFormation === undefined) throw new Error('Formation non écrite.')
        if (laFormation.cree) compte.formations += 1
        for (const leModule of modules) {
          const [ecrit] = await tx
            .insert(t.modules)
            .values({
              id: nouvelId(),
              formationId: laFormation.id,
              code: leModule.code,
              titre: leModule.titre,
              description: leModule.description,
              ordre: leModule.ordre,
              importe: leModule.importe,
            })
            .onConflictDoUpdate({
              target: [t.modules.formationId, t.modules.code],
              set: {
                titre: leModule.titre,
                description: leModule.description,
                ordre: leModule.ordre,
                importe: leModule.importe,
              },
            })
            .returning({ id: t.modules.id, cree })
          if (ecrit === undefined) throw new Error('Module non écrit.')
          if (ecrit.cree) compte.modules += 1
          let ordreBloc = 0
          for (const [rang, partie] of leModule.parties.entries()) {
            const [laPartie] = await tx
              .insert(t.parties)
              .values({
                id: nouvelId(),
                moduleId: ecrit.id,
                code: partie.code,
                titre: partie.titre,
                ordre: rang + 1,
              })
              .onConflictDoUpdate({
                target: [t.parties.moduleId, t.parties.code],
                set: { titre: partie.titre, ordre: rang + 1 },
              })
              .returning({ id: t.parties.id, cree })
            if (laPartie === undefined) throw new Error('Partie non écrite.')
            if (laPartie.cree) compte.parties += 1
            for (const code of partie.blocs) {
              ordreBloc += 1
              const [leBloc] = await tx
                .insert(t.blocs)
                .values({
                  id: nouvelId(),
                  moduleId: ecrit.id,
                  partieId: laPartie.id,
                  code,
                  // Le vrai titre arrive avec la fiche ; en attendant, le code.
                  titre: code,
                  ordre: ordreBloc,
                })
                .onConflictDoUpdate({
                  target: [t.blocs.moduleId, t.blocs.code],
                  set: { partieId: laPartie.id, ordre: ordreBloc },
                })
                .returning({ id: t.blocs.id, cree })
              if (leBloc?.cree === true) compte.blocs += 1
            }
          }
        }
        return compte
      }),

    blocsParCode: (code: string): Promise<BlocTrouve[]> =>
      base.db
        .select({ id: t.blocs.id, code: t.blocs.code, moduleId: t.blocs.moduleId })
        .from(t.blocs)
        .where(eq(t.blocs.code, code)),

    versionsDuBloc: (blocId: string): Promise<VersionStockee[]> =>
      base.db
        .select({
          id: t.fichesVersions.id,
          version: t.fichesVersions.version,
          empreinte: t.fichesVersions.empreinte,
        })
        .from(t.fichesVersions)
        .where(eq(t.fichesVersions.blocId, blocId))
        .orderBy(asc(t.fichesVersions.version)),

    /** Ajoute la version, met le titre du bloc à jour et synchronise ses cartes, ensemble. */
    ajouterVersion: (version: NouvelleVersion, nouvelId: () => string): Promise<CompteCartes> =>
      base.enTransaction(async (tx) => {
        await tx.insert(t.fichesVersions).values({
          id: version.id,
          blocId: version.blocId,
          version: version.version,
          empreinte: version.empreinte,
          chemin: version.chemin,
          manifeste: version.manifeste,
          creeLe: version.creeLe,
        })
        await tx
          .update(t.blocs)
          .set({ titre: version.titreBloc })
          .where(eq(t.blocs.id, version.blocId))
        return synchroniserCartes(tx, version.blocId, version.cartes, nouvelId)
      }),
  }
}
export type DepotCatalogue = ReturnType<typeof creerDepotCatalogue>

/** Les nouvelles cartes sont ajoutées, les modifiées mises à jour, les retirées marquées inactives. */
async function synchroniserCartes(
  tx: Tx,
  blocId: string,
  cartes: NouvelleVersion['cartes'],
  nouvelId: () => string,
): Promise<CompteCartes> {
  const avant = await tx
    .select({ carteId: t.cartes.carteId })
    .from(t.cartes)
    .where(eq(t.cartes.blocId, blocId))
  const connues = new Set(avant.map(({ carteId }) => carteId))
  for (const carte of cartes) {
    await tx
      .insert(t.cartes)
      .values({ id: nouvelId(), blocId, ...carte, active: true })
      .onConflictDoUpdate({
        target: [t.cartes.blocId, t.cartes.carteId],
        set: { recto: carte.recto, verso: carte.verso, active: true },
      })
  }
  const gardees = cartes.map(({ carteId }) => carteId)
  const retirees = await tx
    .update(t.cartes)
    .set({ active: false })
    .where(
      and(
        eq(t.cartes.blocId, blocId),
        eq(t.cartes.active, true),
        gardees.length === 0 ? undefined : notInArray(t.cartes.carteId, gardees),
      ),
    )
    .returning({ id: t.cartes.id })
  return {
    ajoutees: gardees.filter((carteId) => !connues.has(carteId)).length,
    retirees: retirees.length,
    total: cartes.length,
  }
}
