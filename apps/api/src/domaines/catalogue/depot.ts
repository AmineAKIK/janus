import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import type { Base } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

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

export interface BlocDeLaListe {
  readonly code: string
  readonly titre: string
  readonly titreCourt: string | null
  readonly partieCode: string | null
  readonly partieTitre: string | null
  readonly prerequis: unknown
  readonly statut: string | null
}

export interface CompteCartes {
  readonly ajoutees: number
  readonly retirees: number
  readonly total: number
}

/** Les ordres SQL de l'import : le plan de la formation, les versions de fiches, les cartes. */
export function creerDepotCatalogue(base: Base) {
  return {
    formations: (lecteur: Db | Tx) =>
      lecteur
        .select({
          id: t.formations.id,
          titre: t.formations.titre,
          description: t.formations.description,
        })
        .from(t.formations)
        .orderBy(asc(t.formations.code)),

    formationExiste: async (lecteur: Db | Tx, id: string): Promise<boolean> =>
      (
        await lecteur
          .select({ id: t.formations.id })
          .from(t.formations)
          .where(eq(t.formations.id, id))
      ).length > 0,

    modulesDeLaFormation: (lecteur: Db | Tx, formationId: string) =>
      lecteur
        .select({
          id: t.modules.id,
          code: t.modules.code,
          titre: t.modules.titre,
          description: t.modules.description,
          ordre: t.modules.ordre,
          importe: t.modules.importe,
        })
        .from(t.modules)
        .where(eq(t.modules.formationId, formationId))
        .orderBy(asc(t.modules.ordre)),

    moduleParId: async (lecteur: Db | Tx, id: string) => {
      const [ligne] = await lecteur
        .select({ id: t.modules.id, importe: t.modules.importe })
        .from(t.modules)
        .where(eq(t.modules.id, id))
      return ligne
    },

    /**
     * Les blocs d'un module avec leur dernière version de fiche et leur statut courant. Les colonnes
     * du manifeste sont choisies une à une : un manifeste entier ne sort jamais d'une liste.
     */
    blocsDuModule: async (
      lecteur: Db | Tx,
      moduleId: string,
      userId: string,
    ): Promise<BlocDeLaListe[]> => {
      const derniere = lecteur
        .select({
          blocId: t.fichesVersions.blocId,
          derniereVersion: sql<number>`max(${t.fichesVersions.version})`.as('derniere_version'),
        })
        .from(t.fichesVersions)
        .groupBy(t.fichesVersions.blocId)
        .as('derniere')
      return lecteur
        .select({
          code: t.blocs.code,
          titre: t.blocs.titre,
          titreCourt: sql<string | null>`${t.fichesVersions.manifeste}->>'titre_court'`,
          partieCode: t.parties.code,
          partieTitre: t.parties.titre,
          prerequis: sql<unknown>`${t.fichesVersions.manifeste}->'prerequis'`,
          statut: sql<string | null>`${t.statutsCourants.detail}->>'statut'`,
        })
        .from(t.blocs)
        .innerJoin(derniere, eq(derniere.blocId, t.blocs.id))
        .innerJoin(
          t.fichesVersions,
          and(
            eq(t.fichesVersions.blocId, t.blocs.id),
            eq(t.fichesVersions.version, derniere.derniereVersion),
          ),
        )
        .leftJoin(t.parties, eq(t.parties.id, t.blocs.partieId))
        .leftJoin(
          t.statutsCourants,
          and(eq(t.statutsCourants.blocId, t.blocs.id), eq(t.statutsCourants.userId, userId)),
        )
        .where(eq(t.blocs.moduleId, moduleId))
        .orderBy(asc(t.blocs.ordre))
    },

    /** Le bloc de ce code, avec sa version en service (la plus récente). */
    blocEtVersion: async (lecteur: Db | Tx, code: string) => {
      const blocs = await lecteur
        .select({
          id: t.blocs.id,
          code: t.blocs.code,
          moduleId: t.blocs.moduleId,
          titre: t.blocs.titre,
        })
        .from(t.blocs)
        .where(eq(t.blocs.code, code))
      const [bloc] = blocs
      if (bloc === undefined || blocs.length > 1) return undefined
      const [version] = await lecteur
        .select({
          id: t.fichesVersions.id,
          version: t.fichesVersions.version,
          empreinte: t.fichesVersions.empreinte,
          chemin: t.fichesVersions.chemin,
          manifeste: t.fichesVersions.manifeste,
        })
        .from(t.fichesVersions)
        .where(eq(t.fichesVersions.blocId, bloc.id))
        .orderBy(desc(t.fichesVersions.version))
        .limit(1)
      return { bloc, version }
    },

    etatPage: async (lecteur: Db | Tx, userId: string, blocId: string) => {
      const [ligne] = await lecteur
        .select({ version: t.etatsPage.version, etat: t.etatsPage.etat })
        .from(t.etatsPage)
        .where(and(eq(t.etatsPage.userId, userId), eq(t.etatsPage.blocId, blocId)))
      return ligne
    },

    reglagesDe: async (lecteur: Db | Tx, userId: string): Promise<unknown> => {
      const [ligne] = await lecteur
        .select({ reglages: t.users.reglages })
        .from(t.users)
        .where(eq(t.users.id, userId))
      return ligne?.reglages
    },

    /** Le statut courant (forçage compris) de ces blocs, par code ; `non_commence` quand rien n'est calculé. */
    statutsCourants: async (
      lecteur: Db | Tx,
      userId: string,
      codes: readonly string[],
    ): Promise<Map<string, string>> => {
      if (codes.length === 0) return new Map()
      const lignes = await lecteur
        .select({ code: t.blocs.code, statut: sql<string>`${t.statutsCourants.detail}->>'statut'` })
        .from(t.statutsCourants)
        .innerJoin(t.blocs, eq(t.blocs.id, t.statutsCourants.blocId))
        .where(and(eq(t.statutsCourants.userId, userId), inArray(t.blocs.code, [...codes])))
      return new Map(lignes.map(({ code, statut }) => [code, statut]))
    },

    evenementParId: async (lecteur: Db | Tx, id: string) => {
      const [ligne] = await lecteur
        .select({ userId: t.evenements.userId, empreinte: t.evenements.empreinte })
        .from(t.evenements)
        .where(eq(t.evenements.id, id))
      return ligne
    },

    ajouterOuverture: async (
      tx: Tx,
      ouverture: {
        readonly id: string
        readonly userId: string
        readonly blocId: string
        readonly ficheVersionId: string
        readonly donnees: unknown
        readonly empreinte: string
        readonly dateServeur: string
      },
    ): Promise<void> => {
      await tx.insert(t.evenements).values({ ...ouverture, type: 'bloc_ouvert', aide: null })
    },

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
