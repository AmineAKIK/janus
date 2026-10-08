import { nouvelId } from '@janus/contrats'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as t from './schema/index.ts'
import { TABLES_DE_FAITS } from './schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'

const DATE = '2026-10-01T10:00:00.000Z'
const HASH = 'c'.repeat(64)
let numero = 0
const id = () => nouvelId(Date.parse(DATE) + (numero += 1))

describe.skipIf(URL_SERVEUR_TEST === undefined)('schéma : les faits et le rôle de l’appli', () => {
  let base: Awaited<ReturnType<typeof creerBaseDeTest>>
  let userId = ''
  let blocId = ''
  let ficheVersionId = ''

  beforeAll(async () => {
    base = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    userId = id()
    blocId = id()
    ficheVersionId = id()
    const formation = id()
    const module = id()
    await base.db.insert(t.users).values({
      id: userId,
      nomUtilisateur: 'amine',
      motDePasseHash: 'h',
      reglages: {},
      creeLe: DATE,
    })
    await base.db.insert(t.formations).values({ id: formation, code: 'DWWM', titre: 'DWWM' })
    await base.db
      .insert(t.modules)
      .values({ id: module, formationId: formation, code: 'M1', titre: 'M', ordre: 1 })
    await base.db
      .insert(t.blocs)
      .values({ id: blocId, moduleId: module, code: 'B01', titre: 'B', ordre: 1 })
    await base.db.insert(t.fichesVersions).values({
      id: ficheVersionId,
      blocId,
      version: 1,
      empreinte: HASH,
      chemin: 'b01.html',
      manifeste: {},
      creeLe: DATE,
    })
  })
  afterAll(async () => {
    await base.supprimer()
  })

  async function refus(requete: Promise<unknown>) {
    const erreur: unknown = await requete.then(
      () => null,
      (e: unknown) => e,
    )
    if (erreur === null) throw new Error('La base a accepté la ligne.')
    const cause = erreur instanceof Error && erreur.cause !== undefined ? erreur.cause : erreur
    if (typeof cause !== 'object' || cause === null) throw new Error('Erreur inattendue.')
    return {
      code: 'code' in cause ? cause.code : undefined,
      contrainte: 'constraint' in cause ? cause.constraint : undefined,
    }
  }

  /** Exécute des requêtes avec le rôle de l'appli (`janus_app`), puis rend la connexion au propriétaire. */
  async function commeApp<T>(
    fn: (requete: (texte: string) => Promise<unknown>) => Promise<T>,
  ): Promise<T> {
    const client = await base.pool.connect()
    try {
      await client.query('SET ROLE janus_app')
      return await fn((texte) => client.query(texte))
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
  }

  const evenement = (surcharge: Partial<typeof t.evenements.$inferInsert> = {}) => ({
    id: id(),
    userId,
    blocId,
    ficheVersionId,
    type: 'pratique_resultat',
    donnees: {},
    empreinte: HASH,
    aide: 0,
    dateServeur: DATE,
    ...surcharge,
  })
  const correction = (surcharge: Partial<typeof t.corrections.$inferInsert> = {}) => ({
    id: id(),
    userId,
    blocId,
    questionId: 'R1',
    serie: 'restitution',
    tentative: 1,
    tour: 1,
    confiance: 'sur',
    reponse: 'ma réponse',
    supportColle: false,
    supportRetourCours: false,
    recopiee: false,
    message: 'ok',
    niveau: 'solide',
    erreursIds: [],
    source: 'support',
    ref: 'R1',
    certitude: 'sur',
    compte: true,
    raisonNonCompte: null,
    conteste: false,
    modele: 'deepseek',
    parametres: {},
    jetonsEntree: 10,
    jetonsSortie: 5,
    coutMillioniemes: 100,
    consigneEmpreinte: HASH,
    dateServeur: DATE,
    ...surcharge,
  })

  describe('le rôle janus_app', () => {
    it('se connecte, sans être superutilisateur ni créer de base, avec des délais courts', async () => {
      const { rows } = await base.pool.query<{
        rolcanlogin: boolean
        rolsuper: boolean
        rolcreatedb: boolean
        rolconfig: string[]
      }>(
        `SELECT rolcanlogin, rolsuper, rolcreatedb, rolconfig FROM pg_roles WHERE rolname = 'janus_app'`,
      )
      expect(rows[0]).toMatchObject({ rolcanlogin: true, rolsuper: false, rolcreatedb: false })
      expect(rows[0]?.rolconfig).toEqual(
        expect.arrayContaining(['lock_timeout=2s', 'statement_timeout=10s']),
      )
    })

    it('UPDATE evenements avec le rôle de l’appli échoue', async () => {
      const ligne = evenement()
      await base.db.insert(t.evenements).values(ligne)

      const echec = await refus(
        commeApp((requete) =>
          requete(`UPDATE evenements SET type = 'autre' WHERE id = '${ligne.id}'`),
        ),
      )

      expect(echec.code).toBe('42501')
    })

    it.each([...TABLES_DE_FAITS, 'fiches_versions'])('%s : ni UPDATE ni DELETE', async (table) => {
      const { rows } = await base.pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position LIMIT 1`,
      )
      const colonne = rows[0]?.column_name ?? ''
      const modification = await refus(
        commeApp((requete) => requete(`UPDATE ${table} SET ${colonne} = ${colonne}`)),
      )
      const suppression = await refus(commeApp((requete) => requete(`DELETE FROM ${table}`)))

      expect(modification.code).toBe('42501')
      expect(suppression.code).toBe('42501')
    })

    it('lit et ajoute les faits', async () => {
      const ligne = evenement()

      await commeApp((requete) =>
        requete(
          `INSERT INTO evenements (id, user_id, bloc_id, fiche_version_id, type, donnees, empreinte, aide, date_serveur) VALUES ('${ligne.id}', '${userId}', '${blocId}', '${ficheVersionId}', 'x', '{}', '${HASH}', 1, '${DATE}')`,
        ),
      )

      const { rows } = await base.pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM evenements WHERE id = '${ligne.id}'`,
      )
      expect(rows[0]?.n).toBe('1')
    })

    it('modifie et efface l’état d’Amine (réglages, états de page)', async () => {
      await commeApp(async (requete) => {
        await requete(`UPDATE users SET reglages_version = 2 WHERE id = '${userId}'`)
        await requete(`DELETE FROM etats_page`)
      })

      const { rows } = await base.pool.query<{ reglages_version: number }>(
        `SELECT reglages_version FROM users WHERE id = '${userId}'`,
      )
      expect(rows[0]?.reglages_version).toBe(2)
    })
  })

  describe('evenements', () => {
    it('ignore un doublon d’identifiant (ON CONFLICT DO NOTHING) et refuse l’insertion simple', async () => {
      const ligne = evenement()
      await base.db.insert(t.evenements).values(ligne)

      const doublon = await base.db
        .insert(t.evenements)
        .values(ligne)
        .onConflictDoNothing()
        .returning()
      const echec = await refus(base.db.insert(t.evenements).values(ligne))

      expect(doublon).toEqual([])
      expect(echec.code).toBe('23505')
    })

    it('refuse une aide hors de 0 à 4, une empreinte qui n’est pas un SHA-256', async () => {
      const aide = await refus(base.db.insert(t.evenements).values(evenement({ aide: 5 })))
      const negative = await refus(base.db.insert(t.evenements).values(evenement({ aide: -1 })))
      const empreinte = await refus(
        base.db.insert(t.evenements).values(evenement({ empreinte: 'abc' })),
      )
      await base.db.insert(t.evenements).values(evenement({ aide: null }))

      expect(aide.contrainte).toBe('evenements_aide_0_a_4')
      expect(negative.contrainte).toBe('evenements_aide_0_a_4')
      expect(empreinte.contrainte).toBe('evenements_empreinte_sha256')
    })

    it('refuse un événement d’un utilisateur, d’un bloc ou d’une version de fiche inconnus', async () => {
      const utilisateur = await refus(
        base.db.insert(t.evenements).values(evenement({ userId: id() })),
      )
      const bloc = await refus(base.db.insert(t.evenements).values(evenement({ blocId: id() })))
      const version = await refus(
        base.db.insert(t.evenements).values(evenement({ ficheVersionId: id() })),
      )

      expect([utilisateur.code, bloc.code, version.code]).toEqual(['23503', '23503', '23503'])
    })
  })

  describe('corrections', () => {
    it('refuse le même (utilisateur, question, série, tentative, tour)', async () => {
      await base.db.insert(t.corrections).values(correction({ questionId: 'U1' }))

      const echec = await refus(
        base.db.insert(t.corrections).values(correction({ questionId: 'U1' })),
      )
      await base.db
        .insert(t.corrections)
        .values(
          correction({ questionId: 'U1', tour: 2, compte: false, raisonNonCompte: 'relance' }),
        )
      await base.db.insert(t.corrections).values(correction({ questionId: 'U1', tentative: 2 }))
      await base.db.insert(t.corrections).values(correction({ questionId: 'U1', serie: 'rappel' }))

      expect(echec.contrainte).toBe('corrections_user_question_serie_tentative_tour')
    })

    it.each([
      ['serie', { serie: 'quiz' }, 'corrections_serie'],
      ['confiance', { confiance: 'peut-etre' }, 'corrections_confiance'],
      ['niveau', { niveau: 'moyen' }, 'corrections_niveau'],
      ['source', { source: 'inconnue' }, 'corrections_source'],
      ['certitude', { certitude: 'incertain' }, 'corrections_certitude'],
      ['tentative', { tentative: 0 }, 'corrections_tentative_positive'],
      ['tour', { tour: 0 }, 'corrections_tour_positif'],
      ['coût', { coutMillioniemes: -1 }, 'corrections_jetons_et_cout'],
      ['empreinte de la consigne', { consigneEmpreinte: 'x' }, 'corrections_consigne_sha256'],
    ])('refuse %s invalide', async (_nom, surcharge, contrainte) => {
      const echec = await refus(
        base.db.insert(t.corrections).values(correction({ questionId: 'V1', ...surcharge })),
      )

      expect(echec).toEqual({ code: '23514', contrainte })
    })

    it('exige une raison quand la correction ne compte pas, et pas quand elle compte', async () => {
      const sansRaison = await refus(
        base.db.insert(t.corrections).values(correction({ questionId: 'W1', compte: false })),
      )
      const raisonInutile = await refus(
        base.db
          .insert(t.corrections)
          .values(correction({ questionId: 'W2', compte: true, raisonNonCompte: 'relance' })),
      )
      const inconnue = await refus(
        base.db
          .insert(t.corrections)
          .values(correction({ questionId: 'W3', compte: false, raisonNonCompte: 'paresse' })),
      )

      expect(sansRaison.contrainte).toBe('corrections_raison_non_compte')
      expect(raisonInutile.contrainte).toBe('corrections_raison_non_compte')
      expect(inconnue.contrainte).toBe('corrections_raison_non_compte')
    })
  })

  describe('statuts_forces', () => {
    const forcage = (surcharge: Partial<typeof t.statutsForces.$inferInsert>) => ({
      id: id(),
      userId,
      blocId,
      action: 'forcer',
      statut: 'acquis',
      raison: 'Je le maîtrise',
      dateServeur: DATE,
      ...surcharge,
    })

    it('accepte un forçage avec statut et raison, et sa levée sans rien', async () => {
      await base.db.insert(t.statutsForces).values(forcage({}))
      await base.db
        .insert(t.statutsForces)
        .values(forcage({ action: 'lever', statut: null, raison: null }))
    })

    it('refuse un forçage sans raison ou sans statut, une levée avec un statut, un statut inconnu', async () => {
      const sansRaison = await refus(
        base.db.insert(t.statutsForces).values(forcage({ raison: ' ' })),
      )
      const sansStatut = await refus(
        base.db.insert(t.statutsForces).values(forcage({ statut: null })),
      )
      const levee = await refus(
        base.db.insert(t.statutsForces).values(forcage({ action: 'lever', raison: null })),
      )
      const inconnu = await refus(
        base.db.insert(t.statutsForces).values(forcage({ statut: 'genial' })),
      )
      const action = await refus(
        base.db.insert(t.statutsForces).values(forcage({ action: 'bloquer' })),
      )

      expect(sansRaison.contrainte).toBe('statuts_forces_forcer_a_statut_et_raison')
      expect(sansStatut.contrainte).toBe('statuts_forces_forcer_a_statut_et_raison')
      expect(levee.contrainte).toBe('statuts_forces_forcer_a_statut_et_raison')
      expect(inconnu.contrainte).toBe('statuts_forces_statut')
      expect(action.contrainte).toBe('statuts_forces_action')
    })
  })

  describe('decisions_erreurs', () => {
    const decision = (surcharge: Partial<typeof t.decisionsErreurs.$inferInsert>) => ({
      id: id(),
      userId,
      blocId,
      erreurId: 'E1',
      decision: 'cochee',
      source: 'amine',
      correctionId: null,
      dateServeur: DATE,
      ...surcharge,
    })

    it('accepte une erreur cochée par Amine et une proposition de l’IA confirmée', async () => {
      const [vue] = await base.db
        .insert(t.corrections)
        .values(correction({ questionId: 'D1' }))
        .returning()
      await base.db.insert(t.decisionsErreurs).values(decision({}))
      await base.db
        .insert(t.decisionsErreurs)
        .values(decision({ decision: 'decochee', source: 'ia_confirmee' }))
      await base.db
        .insert(t.decisionsErreurs)
        .values(decision({ decision: 'confirmee', source: null, correctionId: vue?.id ?? '' }))
    })

    it('refuse une coche sans source, une confirmation sans correction, ou les deux à la fois', async () => {
      const [vue] = await base.db
        .insert(t.corrections)
        .values(correction({ questionId: 'D2' }))
        .returning()
      const sansSource = await refus(
        base.db.insert(t.decisionsErreurs).values(decision({ source: null })),
      )
      const sansCorrection = await refus(
        base.db.insert(t.decisionsErreurs).values(decision({ decision: 'rejetee', source: null })),
      )
      const melange = await refus(
        base.db.insert(t.decisionsErreurs).values(decision({ correctionId: vue?.id ?? '' })),
      )
      const inconnue = await refus(
        base.db.insert(t.decisionsErreurs).values(decision({ decision: 'peut-etre' })),
      )
      const correctionInconnue = await refus(
        base.db
          .insert(t.decisionsErreurs)
          .values(decision({ decision: 'rejetee', source: null, correctionId: id() })),
      )

      expect(sansSource.contrainte).toBe('decisions_erreurs_forme')
      expect(sansCorrection.contrainte).toBe('decisions_erreurs_forme')
      expect(melange.contrainte).toBe('decisions_erreurs_forme')
      expect(inconnue.contrainte).toBe('decisions_erreurs_decision')
      expect(correctionInconnue.code).toBe('23503')
    })
  })

  describe('journal : notes, idées, revues', () => {
    it('garde chaque version d’une note sous le même note_id, et refuse un texte vide ou trop long', async () => {
      const noteId = id()
      const note = (texte: string) => ({
        id: id(),
        noteId,
        userId,
        entree: 'ligne-1',
        texte,
        dateServeur: DATE,
      })
      await base.db.insert(t.notesJournal).values(note('Première version'))
      await base.db.insert(t.notesJournal).values(note('Version corrigée'))

      const vide = await refus(base.db.insert(t.notesJournal).values(note('  ')))
      const longue = await refus(base.db.insert(t.notesJournal).values(note('x'.repeat(1001))))

      const lignes = await base.db
        .select()
        .from(t.notesJournal)
        .where(sql`${t.notesJournal.noteId} = ${noteId}`)
      expect(lignes).toHaveLength(2)
      expect(vide.contrainte).toBe('notes_journal_texte')
      expect(longue.contrainte).toBe('notes_journal_texte')
    })

    it('refuse une idée vide ou trop longue, accepte une revue sans texte mais pas vide', async () => {
      const idee = (texte: string) => ({ id: id(), userId, texte, dateServeur: DATE })
      const revue = (texte: string | null) => ({ id: id(), userId, texte, dateServeur: DATE })
      await base.db.insert(t.idees).values(idee('Un mode révision rapide'))
      await base.db.insert(t.revuesMethode).values(revue(null))
      await base.db.insert(t.revuesMethode).values(revue('Les retests marchent moins bien.'))

      const ideeVide = await refus(base.db.insert(t.idees).values(idee('')))
      const ideeLongue = await refus(base.db.insert(t.idees).values(idee('x'.repeat(10_001))))
      const revueVide = await refus(base.db.insert(t.revuesMethode).values(revue('   ')))

      expect(ideeVide.contrainte).toBe('idees_texte')
      expect(ideeLongue.contrainte).toBe('idees_texte')
      expect(revueVide.contrainte).toBe('revues_methode_texte')
    })
  })

  describe('tirages, rappels, sessions', () => {
    it('refuse un type de vérification inconnu', async () => {
      await base.db.insert(t.verificationsTirees).values({
        id: id(),
        userId,
        blocId,
        type: 'retest',
        tirage: { questions: [] },
        dateServeur: DATE,
      })

      const echec = await refus(
        base.db
          .insert(t.verificationsTirees)
          .values({ id: id(), userId, blocId, type: 'examen', tirage: {}, dateServeur: DATE }),
      )

      expect(echec.contrainte).toBe('verifications_tirees_type')
    })

    it('garde une seule série de début par utilisateur et par jour', async () => {
      const serie = (jour: string) => ({ id: id(), userId, jour, questions: [], dateServeur: DATE })
      await base.db.insert(t.seriesQuestionsDebut).values(serie('2026-10-01'))
      await base.db.insert(t.seriesQuestionsDebut).values(serie('2026-10-02'))

      const echec = await refus(base.db.insert(t.seriesQuestionsDebut).values(serie('2026-10-01')))

      expect(echec.contrainte).toBe('series_questions_debut_user_jour')
    })

    it('envoie au plus un rappel par utilisateur et par jour', async () => {
      const rappel = (jour: string) => ({ id: id(), userId, jour, envoyeLe: DATE })
      await base.db.insert(t.rappelsEnvoyes).values(rappel('2026-10-01'))
      const autreJour = await base.db
        .insert(t.rappelsEnvoyes)
        .values(rappel('2026-10-02'))
        .returning()

      const echec = await refus(base.db.insert(t.rappelsEnvoyes).values(rappel('2026-10-01')))

      expect(autreJour).toHaveLength(1)
      expect(echec.contrainte).toBe('rappels_envoyes_user_jour')
    })

    it('garde l’empreinte du jeton, unique, et une expiration après la création', async () => {
      const session = (surcharge: Partial<typeof t.sessions.$inferInsert>) => ({
        id: id(),
        userId,
        empreinteJeton: HASH,
        creeLe: DATE,
        expireLe: '2026-10-31T10:00:00.000Z',
        appareil: 'Android',
        ...surcharge,
      })
      const [creee] = await base.db.insert(t.sessions).values(session({})).returning()

      const doublon = await refus(base.db.insert(t.sessions).values(session({})))
      const brut = await refus(
        base.db.insert(t.sessions).values(session({ empreinteJeton: 'le-jeton-en-clair' })),
      )
      const expiree = await refus(
        base.db
          .insert(t.sessions)
          .values(
            session({ empreinteJeton: 'd'.repeat(64), expireLe: '2026-09-01T10:00:00.000Z' }),
          ),
      )

      expect(doublon.code).toBe('23505')
      expect(brut.contrainte).toBe('sessions_empreinte_sha256')
      expect(expiree.contrainte).toBe('sessions_expire_apres_creation')
      expect(creee?.appareil).toBe('Android')
    })

    it('révoque une session en ajoutant une ligne, une seule fois', async () => {
      const [creee] = await base.db
        .insert(t.sessions)
        .values({
          id: id(),
          userId,
          empreinteJeton: 'e'.repeat(64),
          creeLe: DATE,
          expireLe: '2026-10-31T10:00:00.000Z',
          appareil: null,
        })
        .returning()
      const sessionId = creee?.id ?? ''
      await base.db.insert(t.sessionsRevoquees).values({ sessionId, revoqueeLe: DATE })

      const double = await refus(
        base.db.insert(t.sessionsRevoquees).values({ sessionId, revoqueeLe: DATE }),
      )
      const inconnue = await refus(
        base.db.insert(t.sessionsRevoquees).values({ sessionId: id(), revoqueeLe: DATE }),
      )

      expect(double.code).toBe('23505')
      expect(inconnue.code).toBe('23503')
    })
  })
})
