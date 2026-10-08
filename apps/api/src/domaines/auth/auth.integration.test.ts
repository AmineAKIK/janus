import { nouvelId, Reglages } from '@janus/contrats'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from './composition.ts'

const MOT_DE_PASSE = 'un mot de passe solide'
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const MINUTE = 60_000
const HEURE = 3_600_000
const JOUR = 24 * HEURE

describe.skipIf(URL_SERVEUR_TEST === undefined)('authentification contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let amineId = ''
  const hacheur = creerHacheur(4)

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    amineId = await creerUtilisateur('amine', MOT_DE_PASSE)
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  async function creerUtilisateur(nom: string, motDePasse: string): Promise<string> {
    const id = nouvelId(Date.parse('2026-09-01T10:00:00.000Z') + Math.floor(Math.random() * 1e6))
    await bases.db.insert(t.users).values({
      id,
      nomUtilisateur: nom,
      motDePasseHash: await hacheur.hacher(motDePasse),
      reglages: Reglages.parse({}),
      creeLe: '2026-09-01T10:00:00.000Z',
    })
    return id
  }

  async function serveur(config: Record<string, string> = {}, hacheurUtilise = hacheur) {
    const base = baseDepuisPool(bases.db, bases.pool)
    return serveurDeTest({
      base,
      proprietaire: base,
      hacheur: hacheurUtilise,
      config: configDeTest({ NIVEAU_JOURNAL: 'silent', ...config }),
    })
  }
  type Serveur = Awaited<ReturnType<typeof serveur>>

  const ENTETES_ECRITURE = { origin: ORIGINE_TEST, 'user-agent': UA_ANDROID }

  function connecter(
    s: Serveur,
    corps: Record<string, unknown> = {},
    entetes: Record<string, string> = {},
  ) {
    return s.app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { ...ENTETES_ECRITURE, ...entetes },
      payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE, ...corps },
    })
  }

  /** Se connecte et rend l'en-tête `cookie` à rejouer. */
  async function ouvrir(s: Serveur, corps: Record<string, unknown> = {}) {
    s.horloge.avancer(MINUTE) // sort de la fenêtre du limiteur
    const reponse = await connecter(s, corps)
    expect(reponse.statusCode).toBe(200)
    const cookie = reponse.cookies.find(({ name }) => name === 'janus_session')
    return { reponse, cookie: `janus_session=${cookie?.value ?? ''}` }
  }

  const empreinteDe = (cookie: string) =>
    createHash('sha256').update(cookie.replace('janus_session=', '')).digest('hex')
  const idDeSession = async (cookie: string) => {
    const [ligne] = await bases.db
      .select({ id: t.sessions.id })
      .from(t.sessions)
      .where(eq(t.sessions.empreinteJeton, empreinteDe(cookie)))
    return ligne?.id ?? ''
  }

  const lire = (s: Serveur, url: string, cookie: string) =>
    s.app.inject({ method: 'GET', url, headers: { cookie } })

  describe('POST /session', () => {
    it('ouvre une session : le cookie est HttpOnly, Secure, SameSite=Lax, Path=/, sans Domain, sans durée', async () => {
      const s = await serveur()

      const reponse = await connecter(s)

      expect(reponse.statusCode).toBe(200)
      expect(reponse.json()).toEqual({
        id: amineId,
        nom_utilisateur: 'amine',
        fuseau: 'Europe/Paris',
        cle_vapid: 'publique',
      })
      const cookie = reponse.cookies.find(({ name }) => name === 'janus_session')
      expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' })
      expect(cookie?.domain).toBeUndefined()
      expect(cookie?.maxAge).toBeUndefined()
      expect(cookie?.expires).toBeUndefined()
      expect(cookie?.value).toHaveLength(43)
    })

    it('« Rester connecté » donne un cookie de 30 jours', async () => {
      const s = await serveur()

      const reponse = await connecter(s, { rester_connecte: true })

      const cookie = reponse.cookies.find(({ name }) => name === 'janus_session')
      expect(cookie?.maxAge).toBe(30 * 24 * 3600)
    })

    it('n’est pas Secure quand COOKIE_SECURE vaut false (test)', async () => {
      const s = await serveur({ COOKIE_SECURE: 'false' })

      const reponse = await connecter(s)

      expect(reponse.cookies.find(({ name }) => name === 'janus_session')?.secure).toBeFalsy()
    })

    it('ne garde en base que le SHA-256 du jeton, avec l’appareil', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s)
      const jeton = cookie.replace('janus_session=', '')

      const lignes = await bases.db.select().from(t.sessions).where(eq(t.sessions.userId, amineId))

      const ligne = lignes.find(
        ({ empreinteJeton }) => empreinteJeton !== jeton && /^[0-9a-f]{64}$/.test(empreinteJeton),
      )
      expect(ligne).toBeDefined()
      expect(lignes.some(({ empreinteJeton }) => empreinteJeton === jeton)).toBe(false)
      expect(lignes.some(({ appareil }) => appareil === 'Android · Chrome')).toBe(true)
    })

    it('donne un nouveau jeton à chaque connexion', async () => {
      const s = await serveur()

      const premiere = await ouvrir(s)
      const seconde = await ouvrir(s)

      expect(premiere.cookie).not.toBe(seconde.cookie)
    })

    it('répond pareil à un nom inconnu, à un mauvais mot de passe et à un mot de passe trop long', async () => {
      const s = await serveur()

      const inconnu = await connecter(s, { nom_utilisateur: 'personne' })
      s.horloge.avancer(MINUTE)
      const faux = await connecter(s, { mot_de_passe: 'pas le bon mot de passe' })
      s.horloge.avancer(MINUTE)
      const long = await connecter(s, { mot_de_passe: `${MOT_DE_PASSE}${'x'.repeat(80)}` })

      expect(inconnu.statusCode).toBe(401)
      expect(inconnu.headers['content-type']).toContain('application/problem+json')
      expect(faux.json()).toEqual(inconnu.json())
      expect(long.json()).toEqual(inconnu.json())
      expect(inconnu.json()).toMatchObject({
        code: 'non_authentifie',
        detail: 'Identifiant ou mot de passe incorrect.',
      })
      expect(inconnu.cookies).toHaveLength(0)
    })

    it('ne confond pas les majuscules d’un nom d’utilisateur', async () => {
      const s = await serveur()

      const reponse = await connecter(s, { nom_utilisateur: 'AMINE' })

      expect(reponse.statusCode).toBe(200)
    })

    it('refuse une écriture dont l’Origin est étrangère, ou absente', async () => {
      const s = await serveur()

      const etrangere = await connecter(s, {}, { origin: 'https://pirate.example' })
      const absente = await s.app.inject({
        method: 'POST',
        url: '/api/session',
        payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
      })

      expect(etrangere.statusCode).toBe(403)
      expect(etrangere.json()).toMatchObject({ code: 'origine_refusee' })
      expect(absente.statusCode).toBe(403)
    })

    it('refuse 6 essais en une minute pour une même adresse et un même nom, avec retry-after', async () => {
      const s = await serveur()
      for (let essai = 0; essai < 5; essai += 1) {
        expect((await connecter(s, { mot_de_passe: 'faux faux faux' })).statusCode).toBe(401)
      }

      const sixieme = await connecter(s)

      expect(sixieme.statusCode).toBe(429)
      expect(sixieme.headers['retry-after']).toBe('60')
      expect(sixieme.json()).toMatchObject({ code: 'trop_de_requetes' })

      s.horloge.avancer(30_000)
      const plusTard = await connecter(s)
      expect(plusTard.headers['retry-after']).toBe('30')

      s.horloge.avancer(30_000)
      expect((await connecter(s)).statusCode).toBe(200)
    })

    it('ne bloque pas un autre nom d’utilisateur', async () => {
      const s = await serveur()
      for (let essai = 0; essai < 5; essai += 1) {
        await connecter(s, { nom_utilisateur: 'cible', mot_de_passe: 'faux faux faux' })
      }

      const autre = await connecter(s)

      expect(autre.statusCode).toBe(200)
    })

    it('refuse un corps invalide', async () => {
      const s = await serveur()

      const reponse = await connecter(s, { mot_de_passe: '' })

      expect(reponse.statusCode).toBe(400)
    })
  })

  describe('le temps de réponse', () => {
    it('est du même ordre pour un nom inconnu et pour un mauvais mot de passe (bcrypt coût 12)', async () => {
      const reel = creerHacheur()
      await creerUtilisateur('lent', MOT_DE_PASSE)
      const s = await serveur({}, reel)
      // Le compte « lent » a été haché au coût 4 : on le remplace par un hachage au coût 12.
      await bases.db
        .update(t.users)
        .set({ motDePasseHash: await reel.hacher(MOT_DE_PASSE) })
        .where(eq(t.users.nomUtilisateur, 'lent'))
      const duree = async (nom: string) => {
        s.horloge.avancer(MINUTE)
        const debut = performance.now()
        await connecter(s, { nom_utilisateur: nom, mot_de_passe: 'mauvais mot de passe' })
        return performance.now() - debut
      }
      const mediane = (valeurs: number[]) =>
        [...valeurs].sort((a, b) => a - b)[valeurs.length / 2] ?? 0
      await duree('lent') // échauffement
      const inconnus: number[] = []
      const faux: number[] = []

      for (let essai = 0; essai < 10; essai += 1) {
        inconnus.push(await duree(`personne${String(essai)}`))
        faux.push(await duree('lent'))
      }

      const rapport = mediane(inconnus) / mediane(faux)
      expect(rapport).toBeGreaterThan(0.5)
      expect(rapport).toBeLessThan(2)
    }, 60_000)
  })

  describe('la session', () => {
    it('ouvre GET /moi, et sans cookie c’est 401', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s)

      const connecte = await lire(s, '/api/moi', cookie)
      const anonyme = await s.app.inject({ method: 'GET', url: '/api/moi' })
      const inconnu = await lire(s, '/api/moi', 'janus_session=inconnu')

      expect(connecte.statusCode).toBe(200)
      expect(connecte.json()).toMatchObject({ nom_utilisateur: 'amine' })
      expect(anonyme.statusCode).toBe(401)
      expect(inconnu.statusCode).toBe(401)
    })

    it('expire après 12 h sans activité quand on n’a pas coché « Rester connecté »', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s)

      s.horloge.avancer(12 * HEURE - MINUTE)
      expect((await lire(s, '/api/moi', cookie)).statusCode).toBe(200)

      s.horloge.avancer(12 * HEURE)
      expect((await lire(s, '/api/moi', cookie)).statusCode).toBe(401)
    })

    it('reste valable plus de 12 h avec « Rester connecté », jusqu’à 30 jours', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s, { rester_connecte: true })

      s.horloge.avancer(13 * HEURE)
      expect((await lire(s, '/api/moi', cookie)).statusCode).toBe(200)

      s.horloge.avancer(31 * JOUR)
      expect((await lire(s, '/api/moi', cookie)).statusCode).toBe(401)
    })

    it('met à jour la dernière activité au plus une fois par minute', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s)
      const id = await idDeSession(cookie)
      const activite = async () => {
        const { rows } = await bases.pool.query<{ a: string }>(
          `SELECT derniere_activite::text AS a FROM sessions_activite WHERE session_id = '${id}'`,
        )
        return rows[0]?.a
      }
      const ouverture = await activite()

      s.horloge.avancer(59_000)
      await lire(s, '/api/moi', cookie)
      const tropTot = await activite()
      s.horloge.avancer(2_000)
      await lire(s, '/api/moi', cookie)
      const assezTard = await activite()

      expect(tropTot).toBe(ouverture)
      expect(assezTard).not.toBe(ouverture)
    })

    it('DELETE /session déconnecte et efface le cookie', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s)

      const reponse = await s.app.inject({
        method: 'DELETE',
        url: '/api/session',
        headers: { ...ENTETES_ECRITURE, cookie },
      })

      expect(reponse.statusCode).toBe(204)
      expect(reponse.cookies.find(({ name }) => name === 'janus_session')?.value).toBe('')
      expect((await lire(s, '/api/moi', cookie)).statusCode).toBe(401)
    })
  })

  describe('GET /sessions et DELETE /sessions/:id', () => {
    it('liste les sessions ouvertes, repère la courante et nomme l’appareil', async () => {
      const s = await serveur()
      await creerUtilisateur('voisin', MOT_DE_PASSE)
      const premiere = await ouvrir(s)
      s.horloge.avancer(5 * MINUTE)
      const seconde = await ouvrir(s)

      const reponse = await lire(s, '/api/sessions', seconde.cookie)

      expect(reponse.statusCode).toBe(200)
      const { sessions } = reponse.json<{ sessions: { courante: boolean; appareil: string }[] }>()
      expect(sessions.filter(({ courante }) => courante)).toHaveLength(1)
      expect(sessions.every(({ appareil }) => appareil === 'Android · Chrome')).toBe(true)
      expect((await lire(s, '/api/sessions', premiere.cookie)).statusCode).toBe(200)
    })

    it('révoquer une session la déconnecte à sa requête suivante', async () => {
      const s = await serveur()
      const telephone = await ouvrir(s)
      const ordinateur = await ouvrir(s)
      const autre = { id: await idDeSession(telephone.cookie) }

      const revocation = await s.app.inject({
        method: 'DELETE',
        url: `/api/sessions/${autre.id}`,
        headers: { ...ENTETES_ECRITURE, cookie: ordinateur.cookie },
      })

      expect(revocation.statusCode).toBe(204)
      const apresCoup = await lire(s, '/api/sessions', ordinateur.cookie)
      expect(
        apresCoup.json<{ sessions: { id: string }[] }>().sessions.map(({ id }) => id),
      ).not.toContain(autre.id)
      expect((await lire(s, '/api/moi', telephone.cookie)).statusCode).toBe(401)
      expect((await lire(s, '/api/moi', ordinateur.cookie)).statusCode).toBe(200)
    })

    it('ne révoque pas la session d’un autre utilisateur', async () => {
      const s = await serveur()
      const autreId = await creerUtilisateur('intrus', MOT_DE_PASSE)
      const victime = await ouvrir(s)
      s.horloge.avancer(MINUTE)
      const intrus = await connecter(s, { nom_utilisateur: 'intrus' })
      const cookieIntrus = `janus_session=${intrus.cookies[0]?.value ?? ''}`
      const { sessions } = (await lire(s, '/api/sessions', victime.cookie)).json<{
        sessions: { id: string }[]
      }>()

      const reponse = await s.app.inject({
        method: 'DELETE',
        url: `/api/sessions/${sessions[0]?.id ?? ''}`,
        headers: { ...ENTETES_ECRITURE, cookie: cookieIntrus },
      })

      expect(reponse.statusCode).toBe(404)
      expect((await lire(s, '/api/moi', victime.cookie)).statusCode).toBe(200)
      expect(autreId).not.toBe(amineId)
    })
  })

  describe('PATCH /moi/mot-de-passe', () => {
    const NOUVEAU = 'un tout nouveau mot de passe'

    it('refuse un mauvais ancien mot de passe', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s)

      const reponse = await s.app.inject({
        method: 'PATCH',
        url: '/api/moi/mot-de-passe',
        headers: { ...ENTETES_ECRITURE, cookie },
        payload: { ancien: 'pas le bon mot de passe', nouveau: NOUVEAU },
      })

      expect(reponse.statusCode).toBe(403)
      expect(reponse.json()).toMatchObject({ code: 'refus' })
    })

    it('refuse un nouveau mot de passe trop court ou de plus de 72 octets', async () => {
      const s = await serveur()
      const { cookie } = await ouvrir(s)
      const changer = (nouveau: string) =>
        s.app.inject({
          method: 'PATCH',
          url: '/api/moi/mot-de-passe',
          headers: { ...ENTETES_ECRITURE, cookie },
          payload: { ancien: MOT_DE_PASSE, nouveau },
        })

      expect((await changer('court')).statusCode).toBe(400)
      expect((await changer('é'.repeat(37))).statusCode).toBe(400)
    })

    it('change le mot de passe, garde la session courante et déconnecte les autres', async () => {
      const id = await creerUtilisateur('changeur', MOT_DE_PASSE)
      const s = await serveur()
      s.horloge.avancer(MINUTE)
      const ouvrirCommeChangeur = async () => {
        s.horloge.avancer(MINUTE)
        const reponse = await connecter(s, { nom_utilisateur: 'changeur' })
        return `janus_session=${reponse.cookies[0]?.value ?? ''}`
      }
      const courante = await ouvrirCommeChangeur()
      const autre = await ouvrirCommeChangeur()

      const reponse = await s.app.inject({
        method: 'PATCH',
        url: '/api/moi/mot-de-passe',
        headers: { ...ENTETES_ECRITURE, cookie: courante },
        payload: { ancien: MOT_DE_PASSE, nouveau: NOUVEAU },
      })

      expect(reponse.statusCode).toBe(204)
      expect((await lire(s, '/api/moi', courante)).statusCode).toBe(200)
      expect((await lire(s, '/api/moi', autre)).statusCode).toBe(401)
      s.horloge.avancer(MINUTE)
      expect((await connecter(s, { nom_utilisateur: 'changeur' })).statusCode).toBe(401)
      s.horloge.avancer(MINUTE)
      expect(
        (await connecter(s, { nom_utilisateur: 'changeur', mot_de_passe: NOUVEAU })).statusCode,
      ).toBe(200)
      expect(id).not.toBe(amineId)
    })
  })

  describe('DELETE /compte', () => {
    it('refuse un mauvais mot de passe et ne supprime rien', async () => {
      const id = await creerUtilisateur('gardé', MOT_DE_PASSE)
      const s = await serveur()
      const connexion = await connecter(s, { nom_utilisateur: 'gardé' })
      const cookie = `janus_session=${connexion.cookies[0]?.value ?? ''}`

      const reponse = await s.app.inject({
        method: 'DELETE',
        url: '/api/compte',
        headers: { ...ENTETES_ECRITURE, cookie },
        payload: { mot_de_passe: 'pas le bon mot de passe' },
      })

      expect(reponse.statusCode).toBe(403)
      const restants = await bases.db.select().from(t.users).where(eq(t.users.id, id))
      expect(restants).toHaveLength(1)
    })

    it('efface le compte et toutes ses données en une transaction, sans toucher aux autres', async () => {
      const id = await creerUtilisateur('partant', MOT_DE_PASSE)
      const voisin = await creerUtilisateur('reste', MOT_DE_PASSE)
      for (const userId of [id, voisin]) {
        await bases.db.insert(t.rappelsEnvoyes).values({
          id: nouvelId(Date.parse('2026-10-01T10:00:00.000Z') + Math.floor(Math.random() * 1e6)),
          userId,
          jour: '2026-10-01',
          envoyeLe: '2026-10-01T10:00:00.000Z',
        })
        await bases.db.insert(t.budgetIa).values({
          userId,
          mois: '2026-10',
          plafondMillioniemes: 1000,
          consommeMillioniemes: 0,
          reserveMillioniemes: 0,
        })
      }
      const s = await serveur()
      const connexion = await connecter(s, { nom_utilisateur: 'partant' })
      const cookie = `janus_session=${connexion.cookies[0]?.value ?? ''}`

      const reponse = await s.app.inject({
        method: 'DELETE',
        url: '/api/compte',
        headers: { ...ENTETES_ECRITURE, cookie },
        payload: { mot_de_passe: MOT_DE_PASSE },
      })

      expect(reponse.statusCode).toBe(204)
      expect(reponse.cookies.find(({ name }) => name === 'janus_session')?.value).toBe('')
      const compter = async (
        table: 'users' | 'sessions' | 'rappels_envoyes' | 'budget_ia',
        qui: string,
      ) => {
        const colonne = table === 'users' ? 'id' : 'user_id'
        const { rows } = await bases.pool.query<{ n: string }>(
          `SELECT count(*) AS n FROM ${table} WHERE ${colonne} = '${qui}'`,
        )
        return Number(rows[0]?.n)
      }
      for (const table of ['users', 'sessions', 'rappels_envoyes', 'budget_ia'] as const) {
        expect(await compter(table, id), table).toBe(0)
      }
      expect(await compter('users', voisin)).toBe(1)
      expect(await compter('rappels_envoyes', voisin)).toBe(1)
      expect(await compter('budget_ia', voisin)).toBe(1)
      expect((await lire(s, '/api/moi', cookie)).statusCode).toBe(401)
    })
  })
})
