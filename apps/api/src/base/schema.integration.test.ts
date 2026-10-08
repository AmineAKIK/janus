import { nouvelId } from '@janus/contrats'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrer } from './migrer.ts'
import * as t from './schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'

const DATE = '2026-10-01T10:00:00.000Z'
const HASH = 'a'.repeat(64)
let numero = 0
const id = () => nouvelId(Date.parse(DATE) + (numero += 1))

describe.skipIf(URL_SERVEUR_TEST === undefined)(
  'schéma : catalogue, utilisateurs, états de page',
  () => {
    let base: Awaited<ReturnType<typeof creerBaseDeTest>>

    beforeAll(async () => {
      base = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    })
    afterAll(async () => {
      await base.supprimer()
    })

    /** Le code SQLSTATE et le nom de la contrainte d'un refus de la base. */
    async function refus(requete: Promise<unknown>) {
      const erreur: unknown = await requete.then(
        () => null,
        (e: unknown) => e,
      )
      const cause = erreur instanceof Error ? erreur.cause : null
      if (typeof cause !== 'object' || cause === null)
        throw new Error('La base a accepté la ligne.')
      return {
        code: 'code' in cause ? cause.code : undefined,
        contrainte: 'constraint' in cause ? cause.constraint : undefined,
      }
    }

    async function unBloc(code = 'B01') {
      const formation = id()
      const module = id()
      const bloc = id()
      await base.db
        .insert(t.formations)
        .values({ id: formation, code: `F-${code}-${formation}`, titre: 'DWWM' })
      await base.db
        .insert(t.modules)
        .values({ id: module, formationId: formation, code: 'M1', titre: 'Module', ordre: 1 })
      await base.db
        .insert(t.blocs)
        .values({ id: bloc, moduleId: module, code, titre: 'Bloc', ordre: 1 })
      return { formation, module, bloc }
    }

    it('les migrations s’appliquent sur une base vide et se rejouent sans erreur', async () => {
      await expect(migrer(base.url)).resolves.toBeUndefined()
      const { rows } = await base.pool.query<{ n: string }>(
        'SELECT count(*) AS n FROM drizzle.__drizzle_migrations',
      )
      expect(Number(rows[0]?.n)).toBe(6)
    })

    it('crée les tables du catalogue, des utilisateurs et des faits', async () => {
      const { rows } = await base.pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
      )
      expect(rows.map(({ table_name: nom }) => nom)).toEqual([
        'abonnements_push',
        'blocs',
        'budget_ia',
        'cartes',
        'corrections',
        'decisions_erreurs',
        'echeances',
        'etats_page',
        'evenements',
        'fiches_versions',
        'formations',
        'idees',
        'journal',
        'modules',
        'notes_journal',
        'parties',
        'rappels_envoyes',
        'revues_fsrs',
        'revues_methode',
        'series_questions_debut',
        'sessions',
        'sessions_revoquees',
        'statuts_courants',
        'statuts_forces',
        'taches_reservees',
        'users',
        'verifications_tirees',
      ])
    })

    it('refuse deux formations de même code', async () => {
      await base.db.insert(t.formations).values({ id: id(), code: 'DWWM', titre: 'A' })

      const echec = await refus(
        base.db.insert(t.formations).values({ id: id(), code: 'DWWM', titre: 'B' }),
      )

      expect(echec).toEqual({ code: '23505', contrainte: 'formations_code_unique' })
    })

    it('refuse un module dont la formation n’existe pas (clé étrangère)', async () => {
      const echec = await refus(
        base.db
          .insert(t.modules)
          .values({ id: id(), formationId: id(), code: 'M1', titre: 'x', ordre: 1 }),
      )

      expect(echec.code).toBe('23503')
    })

    it('refuse deux modules de même code dans une formation, deux parties, deux blocs', async () => {
      const { module, bloc } = await unBloc('B02')
      const formation = (await base.db.select().from(t.modules).limit(1))[0]?.formationId ?? ''

      const moduleDouble = await refus(
        base.db
          .insert(t.modules)
          .values({ id: id(), formationId: formation, code: 'M1', titre: 'x', ordre: 2 }),
      )
      await base.db
        .insert(t.parties)
        .values({ id: id(), moduleId: module, code: 'P1', titre: 'x', ordre: 1 })
      const partieDouble = await refus(
        base.db
          .insert(t.parties)
          .values({ id: id(), moduleId: module, code: 'P1', titre: 'x', ordre: 2 }),
      )
      const blocDouble = await refus(
        base.db
          .insert(t.blocs)
          .values({ id: id(), moduleId: module, code: 'B02', titre: 'x', ordre: 2 }),
      )

      expect(bloc).toBeDefined()
      expect(moduleDouble.contrainte).toBe('modules_formation_code')
      expect(partieDouble.contrainte).toBe('parties_module_code')
      expect(blocDouble.contrainte).toBe('blocs_module_code')
    })

    it('refuse un code de bloc qui n’a pas la forme B02', async () => {
      const { module } = await unBloc('B03')

      const echec = await refus(
        base.db
          .insert(t.blocs)
          .values({ id: id(), moduleId: module, code: 'bloc2', titre: 'x', ordre: 3 }),
      )

      expect(echec).toEqual({ code: '23514', contrainte: 'blocs_code_format' })
    })

    it('refuse deux cartes de même identifiant dans un bloc', async () => {
      const { bloc } = await unBloc('B04')
      const carte = { blocId: bloc, carteId: 'C1', recto: 'q', verso: 'r' }
      await base.db.insert(t.cartes).values({ id: id(), ...carte })

      const echec = await refus(base.db.insert(t.cartes).values({ id: id(), ...carte }))

      expect(echec.contrainte).toBe('cartes_bloc_carte')
    })

    describe('fiches_versions', () => {
      const version = (
        blocId: string,
        surcharge: Partial<typeof t.fichesVersions.$inferInsert> = {},
      ) => ({
        id: id(),
        blocId,
        version: 1,
        empreinte: HASH,
        chemin: 'fiches/b05.html',
        manifeste: { bloc: 'B05' },
        creeLe: DATE,
        ...surcharge,
      })

      it('refuse une empreinte qui n’est pas un SHA-256 hexadécimal', async () => {
        const { bloc } = await unBloc('B05')

        const court = await refus(
          base.db.insert(t.fichesVersions).values(version(bloc, { empreinte: 'abc' })),
        )
        const majuscules = await refus(
          base.db.insert(t.fichesVersions).values(version(bloc, { empreinte: 'A'.repeat(64) })),
        )

        expect(court.contrainte).toBe('fiches_versions_empreinte_sha256')
        expect(majuscules.contrainte).toBe('fiches_versions_empreinte_sha256')
      })

      it('refuse une version à zéro, un numéro ou une empreinte déjà vus pour le bloc', async () => {
        const { bloc } = await unBloc('B06')
        await base.db.insert(t.fichesVersions).values(version(bloc))

        const zero = await refus(
          base.db.insert(t.fichesVersions).values(version(bloc, { version: 0 })),
        )
        const numeroDouble = await refus(
          base.db.insert(t.fichesVersions).values(version(bloc, { empreinte: 'b'.repeat(64) })),
        )
        const empreinteDouble = await refus(
          base.db.insert(t.fichesVersions).values(version(bloc, { version: 2 })),
        )

        expect(zero.contrainte).toBe('fiches_versions_version_positive')
        expect(numeroDouble.contrainte).toBe('fiches_versions_bloc_version')
        expect(empreinteDouble.contrainte).toBe('fiches_versions_bloc_empreinte')
      })

      it('ne se modifie ni ne s’efface jamais, même par le propriétaire', async () => {
        const { bloc } = await unBloc('B07')
        const ligne = version(bloc)
        await base.db.insert(t.fichesVersions).values(ligne)

        const modification = await refus(
          base.db.execute(sql`UPDATE fiches_versions SET chemin = 'autre' WHERE id = ${ligne.id}`),
        )
        const suppression = await refus(
          base.db.execute(sql`DELETE FROM fiches_versions WHERE id = ${ligne.id}`),
        )

        expect(modification.code).toBe('23001')
        expect(suppression.code).toBe('23001')
      })
    })

    describe('users et etats_page', () => {
      const utilisateur = (surcharge: Partial<typeof t.users.$inferInsert> = {}) => ({
        id: id(),
        nomUtilisateur: `amine-${String(numero)}`,
        motDePasseHash: '$2b$12$hash',
        reglages: {},
        creeLe: DATE,
        ...surcharge,
      })

      it('refuse deux noms d’utilisateur qui ne diffèrent que par la casse', async () => {
        await base.db.insert(t.users).values(utilisateur({ nomUtilisateur: 'Amine' }))

        const echec = await refus(
          base.db.insert(t.users).values(utilisateur({ nomUtilisateur: 'AMINE' })),
        )

        expect(echec).toEqual({ code: '23505', contrainte: 'users_nom_utilisateur' })
      })

      it('refuse une version de réglages à zéro et part de la version 1', async () => {
        const zero = await refus(
          base.db.insert(t.users).values(utilisateur({ reglagesVersion: 0 })),
        )
        const [cree] = await base.db.insert(t.users).values(utilisateur()).returning()

        expect(zero.contrainte).toBe('users_reglages_version_positive')
        expect(cree?.reglagesVersion).toBe(1)
      })

      it('garde un seul état par utilisateur et par bloc, avec une version qui part de 1', async () => {
        const { bloc } = await unBloc('B08')
        const user = utilisateur()
        await base.db.insert(t.users).values(user)
        const etat = { userId: user.id, blocId: bloc, etat: { etape: 'ET1' }, misAJourLe: DATE }
        const [cree] = await base.db.insert(t.etatsPage).values(etat).returning()

        const double = await refus(base.db.insert(t.etatsPage).values(etat))
        const zero = await refus(
          base.db.insert(t.etatsPage).values({ ...etat, userId: id(), version: 0 }),
        )

        expect(cree?.version).toBe(1)
        expect(double.code).toBe('23505')
        expect(zero.code).toBe('23514')
      })

      it('refuse un état pour un utilisateur ou un bloc inconnu', async () => {
        const echec = await refus(
          base.db
            .insert(t.etatsPage)
            .values({ userId: id(), blocId: id(), etat: {}, misAJourLe: DATE }),
        )

        expect(echec.code).toBe('23503')
      })
    })
  },
)
