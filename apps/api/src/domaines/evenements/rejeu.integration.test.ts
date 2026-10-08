import { nouvelId } from '@janus/contrats'
import { CAS_ACCEPTATION } from '@janus/moteur/cas-acceptation'
import type { Attendu, CasStatut } from '@janus/moteur/cas-acceptation'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from '../../base/base.ts'
import type { Base } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { ecrireFait } from '../../base/ecrireFait.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { recalculer } from '../../recalcul.ts'

const HASH = 'e'.repeat(64)
const CREE = '2026-05-01T10:00:00.000Z'
const CAS_DE_STATUT = CAS_ACCEPTATION.filter((cas): cas is CasStatut => cas.genre === 'statut')

// Les cas d'acceptation du cadrage, rejoués sur la vraie base : chaque fait est écrit dans sa table
// à sa date, le serveur recalcule, et ce qu'il range dans `statuts_courants` doit être l'attendu.
describe.skipIf(URL_SERVEUR_TEST === undefined)('cas d’acceptation rejoués sur PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let base: Base
  let blocId = ''
  let ficheVersionId = ''
  let sequence = 0
  const identifiant = () => nouvelId(Date.parse(CREE) + (sequence += 1))

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    base = baseDepuisPool(bases.db, bases.pool)
    const [premier] = CAS_DE_STATUT
    if (premier === undefined) throw new Error('aucun cas de statut')
    const formationId = identifiant()
    const moduleId = identifiant()
    blocId = identifiant()
    ficheVersionId = identifiant()
    await bases.db.insert(t.formations).values({ id: formationId, code: 'F', titre: 'F' })
    await bases.db
      .insert(t.modules)
      .values({ id: moduleId, formationId, code: 'M', titre: 'M', ordre: 1 })
    await bases.db
      .insert(t.blocs)
      .values({ id: blocId, moduleId, code: premier.manifeste.bloc, titre: 'B', ordre: 1 })
    await bases.db.insert(t.fichesVersions).values({
      id: ficheVersionId,
      blocId,
      version: 1,
      empreinte: HASH,
      chemin: 'D01/x.html',
      manifeste: premier.manifeste,
      creeLe: CREE,
    })
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  async function verifier(cas: CasStatut, userId: string, attendu: Attendu) {
    const resultat = await base.enTransaction((tx) =>
      recalculer(tx, {
        userId,
        bloc: { id: blocId, code: cas.manifeste.bloc },
        manifeste: cas.manifeste,
        reglages: cas.reglages,
        maintenant: cas.maintenant,
      }),
    )
    const [ligne] = await bases.db
      .select({ calcule: t.statutsCourants.statutCalcule, detail: t.statutsCourants.detail })
      .from(t.statutsCourants)
      .where(eq(t.statutsCourants.userId, userId))
    expect(resultat.statut).toBe(attendu.statut)
    expect(ligne?.detail).toMatchObject({ statut: attendu.statut })
    if (attendu.statutCalcule !== undefined) {
      expect(resultat.statutCalcule).toBe(attendu.statutCalcule)
      expect(ligne?.calcule).toBe(attendu.statutCalcule)
    }
    for (const code of attendu.manque ?? []) {
      expect(resultat.manque.map((manque) => manque.code)).toContain(code)
    }
    if (attendu.erreursOuvertes !== undefined) {
      expect(resultat.erreursOuvertes).toEqual(attendu.erreursOuvertes)
    }
    if (attendu.echecsConsecutifs !== undefined) {
      expect(resultat.echecsConsecutifs).toBe(attendu.echecsConsecutifs)
    }
    if (attendu.force !== undefined) expect(resultat.force).toEqual(attendu.force)
  }

  it.each(CAS_DE_STATUT.map((cas) => [cas.situation, cas] as const))('%s', async (_nom, cas) => {
    const userId = identifiant()
    await bases.db.insert(t.users).values({
      id: userId,
      nomUtilisateur: `u${String(sequence)}`,
      motDePasseHash: 'h',
      reglages: cas.reglages,
      creeLe: CREE,
    })
    const ids = new Map<string, string>()
    const etapes = [
      ...(cas.intermediaires ?? []).map(({ apresFaits, attendu }) => ({ apresFaits, attendu })),
      { apresFaits: cas.faits.length, attendu: cas.attendu },
    ]
    let ecrits = 0
    for (const { apresFaits, attendu } of etapes) {
      for (const fait of cas.faits.slice(ecrits, apresFaits)) {
        ecrits += 1
        await ecrireFait(
          { db: bases.db, userId, blocId, ficheVersionId, identifiant },
          fait,
          ids,
          ecrits,
        )
      }
      await verifier(cas, userId, attendu)
    }
  })
})
