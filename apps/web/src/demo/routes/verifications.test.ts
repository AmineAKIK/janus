import { nouvelId, ROUTES } from '@janus/contrats'
import type { SortieRoute } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { MANIFESTES_GRAINE } from '../graine.ts'
import { monterDemo, PREMIER_LANCEMENT } from './banc.ts'

type Vue = SortieRoute<(typeof ROUTES)['GET /verifications/:id']>
type Partie = Vue['parties'][number]

let compteur = 0
const SANS_SUPPORT = { colle: false, retour_cours: false }

/** La vérification de B02 que l'écran Aujourd'hui propose. */
async function ouvrirVerification(banc: ReturnType<typeof monterDemo>) {
  const { taches } = await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})
  const lien = taches.find(({ tache }) => tache.type === 'verification')?.lien
  const id = lien?.replace('/verifications/', '')
  if (id === undefined) throw new Error('Aucune vérification dans la file')
  const vue = await banc.transport.appeler(ROUTES['GET /verifications/:id'], { params: { id } })
  return { id, vue }
}

/** Une réponse qui contient les mots attendus sans recopier la phrase : les mots à l'envers. */
const reponseSolide = (attendu: string) => attendu.split(/\s+/u).reverse().join(' ')

function reponseJuste(partie: Partie) {
  const differee = MANIFESTES_GRAINE['B02']?.differees.find(({ id }) => id === partie.id)
  if (differee === undefined) throw new Error(`Partie inconnue ${partie.id}`)
  if (partie.type === 'tache') {
    const cas = partie.tache?.mode === 'code' ? partie.tache.cas.length : 0
    return cas > 0
      ? { reponse: differee.attendu, code: { reussis: cas, total: cas } }
      : { reponse: differee.attendu }
  }
  return { reponse: reponseSolide(differee.attendu) }
}

async function repondre(
  banc: ReturnType<typeof monterDemo>,
  id: string,
  partie: Partie,
  saisie: { reponse: string; code?: { reussis: number; total: number } },
  support = SANS_SUPPORT,
) {
  return banc.transport.appeler(ROUTES['POST /verifications/:id/reponses'], {
    params: { id },
    corps: {
      id: nouvelId(Date.parse(PREMIER_LANCEMENT) + (compteur += 1)),
      partie: partie.id,
      confiance: 'sur',
      support,
      ...saisie,
    },
  })
}

async function toutRepondre(
  banc: ReturnType<typeof monterDemo>,
  id: string,
  vue: Vue,
  reponse: (partie: Partie) => { reponse: string; code?: { reussis: number; total: number } },
) {
  let derniere: Awaited<ReturnType<typeof repondre>> | undefined
  for (const partie of vue.parties) derniere = await repondre(banc, id, partie, reponse(partie))
  if (derniere === undefined) throw new Error('Aucune partie')
  return derniere
}

describe('vérifications de la démo', () => {
  it('l’écran Aujourd’hui mène à une vérification de trois parties qui ne dit rien du bloc', async () => {
    const banc = monterDemo()
    const { vue } = await ouvrirVerification(banc)

    expect(vue.type).toBe('verification')
    expect(vue.parties.map(({ type }) => type)).toEqual(['explication', 'tache', 'transfert'])
    expect(vue.terminee).toBe(false)
    expect(vue.revu_recemment).toBeNull()
    expect(JSON.stringify(vue)).not.toMatch(/B02|Logique/)
    expect(vue.parties.every(({ envoyee }) => !envoyee)).toBe(true)
  })

  it('ne rend aucune correction avant la dernière partie', async () => {
    const banc = monterDemo()
    const { id, vue } = await ouvrirVerification(banc)
    const [premiere] = vue.parties
    if (premiere === undefined) throw new Error('Aucune partie')

    const reponse = await repondre(banc, id, premiere, reponseJuste(premiere))

    expect(reponse).toEqual({ partie: premiere.id, terminee: false })
    const apres = await banc.transport.appeler(ROUTES['GET /verifications/:id'], { params: { id } })
    expect(apres.parties[0]?.envoyee).toBe(true)
    expect(apres.resultat).toBeNull()
  })

  it('réussie, la vérification de B02 le passe à « Acquis » avec un retest dans 30 jours', async () => {
    const banc = monterDemo()
    const { id, vue } = await ouvrirVerification(banc)

    const derniere = await toutRepondre(banc, id, vue, reponseJuste)

    expect(derniere.terminee).toBe(true)
    expect(derniere.resultat).toMatchObject({
      bloc: { code: 'B02' },
      issue: 'reussie',
      valable: true,
      statut_avant: 'acquis_provisoirement',
      statut: 'acquis',
      descend: false,
      prochaine: { type: 'retest' },
    })
    const jour = (await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})).jour
    const retest = derniere.resultat?.prochaine?.apres ?? ''
    const ecart = (Date.parse(retest) - Date.parse(jour)) / 86_400_000
    expect(ecart).toBe(30)
  })

  it('ratée, la vérification reprogramme un nouvel essai dans 2 jours et laisse le statut', async () => {
    const banc = monterDemo()
    const { id, vue } = await ouvrirVerification(banc)

    const derniere = await toutRepondre(banc, id, vue, (partie) =>
      partie.type === 'tache'
        ? {
            reponse: 'faux',
            ...(partie.tache?.mode === 'code' ? { code: { reussis: 0, total: 1 } } : {}),
          }
        : { reponse: 'Je ne sais pas' },
    )

    expect(derniere.resultat).toMatchObject({
      issue: 'ratee',
      statut_avant: 'acquis_provisoirement',
      statut: 'acquis_provisoirement',
      prochaine: { type: 'verification' },
    })
    const jour = (await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})).jour
    const nouvelle = derniere.resultat?.prochaine?.apres ?? ''
    expect((Date.parse(nouvelle) - Date.parse(jour)) / 86_400_000).toBe(2)
  })

  it('la vérification faite sort de la file du jour', async () => {
    const banc = monterDemo()
    const { id, vue } = await ouvrirVerification(banc)

    await toutRepondre(banc, id, vue, reponseJuste)

    const { taches } = await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})
    expect(taches.some(({ tache }) => tache.type === 'verification')).toBe(false)
  })

  it('une page ouverte dans les 24 h dit « revu récemment » et la vérification ne compte pas', async () => {
    const banc = monterDemo()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      faits: [
        ...etat.faits,
        {
          id: 'ouverture-recente',
          bloc: 'B02',
          date: new Date(Date.parse(PREMIER_LANCEMENT) - 3_600_000).toISOString(),
          type: 'bloc_ouvert' as const,
          horsPrerequis: false,
        },
      ],
    }))
    const { id, vue } = await ouvrirVerification(banc)

    expect(vue.revu_recemment).toBe('aujourdhui')
    const derniere = await toutRepondre(banc, id, vue, reponseJuste)

    expect(derniere.resultat).toMatchObject({
      issue: 'ratee',
      valable: false,
      raison_invalide: 'revu_avant',
      statut: 'acquis_provisoirement',
    })
  })

  it('un collage ne compte pas : la vérification n’est pas valable', async () => {
    const banc = monterDemo()
    const { id, vue } = await ouvrirVerification(banc)

    const derniere = await toutRepondre(banc, id, vue, reponseJuste)
    expect(derniere.resultat?.valable).toBe(true)

    const autre = monterDemo()
    const ouverte = await ouvrirVerification(autre)
    let reponse: Awaited<ReturnType<typeof repondre>> | undefined
    for (const partie of ouverte.vue.parties) {
      reponse = await repondre(
        autre,
        ouverte.id,
        partie,
        reponseJuste(partie),
        partie.type === 'transfert' ? { colle: true, retour_cours: false } : SANS_SUPPORT,
      )
    }
    expect(reponse?.resultat).toMatchObject({ valable: false, raison_invalide: 'avec_support' })
  })

  it('reporter reprogramme la vérification à demain et la retire de la file', async () => {
    const banc = monterDemo()
    const { id } = await ouvrirVerification(banc)
    const jour = (await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})).jour

    const { due_le: dueLe } = await banc.transport.appeler(
      ROUTES['POST /verifications/:id/reporter'],
      {
        params: { id },
        corps: { id: nouvelId(Date.parse(PREMIER_LANCEMENT)) },
      },
    )

    expect((Date.parse(dueLe) - Date.parse(jour)) / 86_400_000).toBe(1)
    const { taches } = await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})
    expect(taches.some(({ tache }) => tache.type === 'verification')).toBe(false)
  })

  it('une erreur critique proposée par le tuteur met le résultat « à examiner »', async () => {
    const banc = monterDemo()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, erreurIa: true },
    }))
    const { id, vue } = await ouvrirVerification(banc)

    const derniere = await toutRepondre(banc, id, vue, reponseJuste)

    expect(derniere.resultat?.issue).toBe('a_examiner')
    expect(derniere.resultat?.erreur_a_confirmer?.erreur).toBeTruthy()
    // L'erreur n'ouvre rien tant qu'Amine ne la confirme pas.
    expect(derniere.resultat?.statut).toBe('acquis')
  })

  it('refuse une tâche de code envoyée sans résultat de test', async () => {
    const banc = monterDemo()
    const { id, vue } = await ouvrirVerification(banc)
    const code = vue.parties.find(({ tache }) => tache?.mode === 'code')
    if (code === undefined) return

    await expect(repondre(banc, id, code, { reponse: 'function f() {}' })).rejects.toMatchObject({
      status: 400,
    })
  })

  it('refuse une partie inconnue', async () => {
    const banc = monterDemo()
    const { id } = await ouvrirVerification(banc)

    await expect(
      repondre(
        banc,
        id,
        { id: 'inconnue', type: 'explication', consigne: 'x', envoyee: false },
        { reponse: 'x' },
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})
