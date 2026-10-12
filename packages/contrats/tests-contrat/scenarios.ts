import { describe, expect, it } from 'vitest'
import { ErreurApi, ROUTES } from '../src/index.ts'
import type { MessagePage, Transport } from '../src/index.ts'

// La suite de contrat : des scénarios écrits une fois, qui prennent un `Transport`. Ils tournent contre
// le backend de démo (PR-032) et, plus tard, contre l'API réelle (PR-089). Chaque scénario part d'un
// serveur neuf, avec la graine de la démo.

/** Ce qu'un scénario reçoit du banc d'essai. */
export interface BancContrat {
  readonly transport: Transport
  /** Fait passer le temps pour le serveur de `ms` millisecondes. */
  readonly avancer: (ms: number) => Promise<void>
}

export type CreerBanc = () => Promise<BancContrat> | BancContrat

/** Le bloc des scénarios : jamais commencé dans la graine, ses prérequis ne sont pas acquis. */
const BLOC = 'B08'
const HEURE_MS = 3_600_000
const UTILISATEUR = 'amine'
const MOT_DE_PASSE = 'demo-janus'

let compteur = 0
/** Un identifiant UUID v7 valide, unique dans la suite. */
function nouvelId(): string {
  compteur += 1
  return `0190a000-0000-7000-8000-${compteur.toString(16).padStart(12, '0')}`
}

async function connecter(banc: BancContrat) {
  await banc.transport.appeler(ROUTES['POST /session'], {
    corps: { nom_utilisateur: UTILISATEUR, mot_de_passe: MOT_DE_PASSE },
  })
}

async function statutDuBloc(banc: BancContrat) {
  return banc.transport.appeler(ROUTES['GET /blocs/:id'], { params: { id: BLOC } })
}

async function ouvrir(banc: BancContrat) {
  return banc.transport.appeler(ROUTES['POST /blocs/:id/ouvrir'], {
    params: { id: BLOC },
    corps: { id: nouvelId(), hors_prerequis: true, raison: 'Je veux avancer sur UNIX.' },
  })
}

/** Répond à chaque question d'une série avec le texte attendu du manifeste, puis rend le niveau de chacune. */
async function repondre(banc: BancContrat, serie: 'restitution' | 'consolidation') {
  const { manifeste, version } = await statutDuBloc(banc)
  const niveaux: string[] = []
  for (const question of manifeste[serie]) {
    const correction = await banc.transport.appeler(ROUTES['POST /corrections'], {
      corps: {
        id: nouvelId(),
        serie,
        tentative: 1,
        question: question.id,
        reponse: `${question.attendu} Voilà ce que j’en retiens, avec mes propres mots.`,
        confiance: 'sur',
        relance: '',
        support: { colle: false, retour_cours: false },
        bloc: BLOC,
        version,
      },
    })
    niveaux.push(correction.niveau)
  }
  return niveaux
}

async function envoyerPage(
  banc: BancContrat,
  version: number,
  message:
    { type: 'pratique.resultat'; exercice: string; item: string } | { type: 'atelier.resultat' },
) {
  const commun = { id: nouvelId(), bloc: BLOC, version, t: '2026-06-01T10:00:00Z' }
  const corps: MessagePage =
    message.type === 'atelier.resultat'
      ? { ...commun, type: 'atelier.resultat', reussi: true, predictions_justes: 3, aide: 0 }
      : {
          ...commun,
          type: 'pratique.resultat',
          exercice: message.exercice,
          item: message.item,
          reussi: true,
          aide: 0,
          essais: 1,
        }
  return banc.transport.appeler(ROUTES['POST /evenements'], { corps })
}

const codesManque = (statut: { manque: readonly { code: string }[] }) =>
  statut.manque.map(({ code }) => code)

/** Enregistre les scénarios de contrat pour un banc d'essai. */
export function scenariosContrat(creer: CreerBanc): void {
  describe('suite de contrat', () => {
    it('connexion : refuse un mauvais mot de passe, accepte le bon, rend le compte', async () => {
      const banc = await creer()

      await expect(
        banc.transport.appeler(ROUTES['POST /session'], {
          corps: { nom_utilisateur: UTILISATEUR, mot_de_passe: 'faux' },
        }),
      ).rejects.toMatchObject({ status: 401 })
      const moi = await banc.transport.appeler(ROUTES['POST /session'], {
        corps: { nom_utilisateur: UTILISATEUR, mot_de_passe: MOT_DE_PASSE },
      })

      expect(moi.nom_utilisateur).toBe(UTILISATEUR)
      await expect(banc.transport.appeler(ROUTES['GET /moi'], {})).resolves.toEqual(moi)
    })

    it('ouverture d’un bloc : exige une raison tant que les prérequis ne sont pas acquis', async () => {
      const banc = await creer()
      await connecter(banc)

      const sansRaison = banc.transport.appeler(ROUTES['POST /blocs/:id/ouvrir'], {
        params: { id: BLOC },
        corps: { id: nouvelId(), hors_prerequis: false },
      })
      await expect(sansRaison).rejects.toBeInstanceOf(ErreurApi)
      await expect(sansRaison).rejects.toMatchObject({ status: 400 })
      expect((await statutDuBloc(banc)).statut).toBe('non_commence')

      const ouvert = await ouvrir(banc)

      expect(ouvert).toMatchObject({ acces: 'raison_requise', statut: 'en_cours' })
    })

    it('restitution complète : le statut passe à « vu »', async () => {
      const banc = await creer()
      await connecter(banc)
      await ouvrir(banc)

      const niveaux = await repondre(banc, 'restitution')
      const detail = await statutDuBloc(banc)

      expect(niveaux).toEqual(Array.from({ length: niveaux.length }, () => 'solide'))
      expect(detail.statut).toBe('vu')
    })

    it('consolidation trop tôt : refusée, le bloc reste « vu » avec le manque correspondant', async () => {
      const banc = await creer()
      await connecter(banc)
      await ouvrir(banc)
      await repondre(banc, 'restitution')

      await repondre(banc, 'consolidation')
      const detail = await statutDuBloc(banc)

      expect(detail.statut).toBe('vu')
      expect(codesManque(detail)).toContain('consolidation_trop_tot')
    })

    it('consolidation réussie après 1 h : plus de manque de consolidation, puis « acquis provisoirement »', async () => {
      const banc = await creer()
      await connecter(banc)
      await ouvrir(banc)
      await repondre(banc, 'restitution')
      await banc.avancer(HEURE_MS + 60_000)

      await repondre(banc, 'consolidation')
      const apresConsolidation = await statutDuBloc(banc)
      const { manifeste, version } = apresConsolidation
      for (const item of manifeste.pratique.flatMap(({ id, items }) =>
        items.map((i) => ({ exercice: id, item: i.id })),
      )) {
        await envoyerPage(banc, version, { type: 'pratique.resultat', ...item })
      }
      await envoyerPage(banc, version, { type: 'atelier.resultat' })
      const final = await statutDuBloc(banc)

      expect(codesManque(apresConsolidation).filter((c) => c.startsWith('consolidation_'))).toEqual(
        [],
      )
      expect(final.statut).toBe('acquis_provisoirement')
    })

    it('réglages : une modification se fait après lecture, et se relit', async () => {
      const banc = await creer()
      await connecter(banc)
      const avant = await banc.transport.appeler(ROUTES['GET /reglages'], {})
      const nouveau = avant.questionsDebut === 6 ? 7 : 6

      const modifies = await banc.transport.appeler(ROUTES['PATCH /reglages'], {
        corps: { questionsDebut: nouveau },
      })
      const relus = await banc.transport.appeler(ROUTES['GET /reglages'], {})

      expect(modifies.questionsDebut).toBe(nouveau)
      expect(relus).toEqual(modifies)
    })

    it('relances : le serveur numérote les tentatives, la cinquième relance est refusée', async () => {
      const banc = await creer()
      await connecter(banc)
      await ouvrir(banc)
      const { manifeste, version } = await statutDuBloc(banc)
      const question = manifeste.restitution[0]
      if (question === undefined) throw new Error('Le bloc n’a pas de question de restitution')
      const envoyer = (relance: string) =>
        banc.transport.appeler(ROUTES['POST /corrections'], {
          corps: {
            id: nouvelId(),
            serie: 'restitution',
            // Numéro sans importance : le serveur compte lui-même.
            tentative: 1,
            question: question.id,
            reponse: relance === '' ? question.attendu : `${question.attendu} ${relance}`,
            confiance: 'sur',
            relance,
            support: { colle: false, retour_cours: false },
            bloc: BLOC,
            version,
          },
        })

      expect((await envoyer('')).tour).toBe(1)
      // Une réponse neuve sur la même question ouvre une tentative : pas de blocage.
      expect((await envoyer('')).tour).toBe(1)
      for (let rang = 2; rang <= 5; rang += 1) {
        expect((await envoyer(`Je reprends, version ${String(rang)}.`)).tour).toBe(rang)
      }

      await expect(envoyer('Une de trop.')).rejects.toMatchObject({ status: 422 })
    })

    it('doublon : un identifiant déjà reçu est ignoré, sans erreur ni second fait', async () => {
      const banc = await creer()
      await connecter(banc)
      await ouvrir(banc)
      const { version } = await statutDuBloc(banc)
      const message: MessagePage = {
        id: nouvelId(),
        bloc: BLOC,
        version,
        t: '2026-06-01T10:00:00Z',
        type: 'etape.vue',
        etape: 'ET2',
      }

      const premier = await banc.transport.appeler(ROUTES['POST /evenements'], { corps: message })
      const second = await banc.transport.appeler(ROUTES['POST /evenements'], { corps: message })

      expect(premier.doublon).toBe(false)
      expect(second.doublon).toBe(true)
      expect(second.statut).toEqual(premier.statut)
    })

    it('état de page : rejouer l’écriture qui vient d’avoir lieu réussit, un autre contenu est un conflit', async () => {
      const banc = await creer()
      await connecter(banc)
      await ouvrir(banc)
      const ecrire = (version: number, etat: { etape: string }) =>
        banc.transport.appeler(ROUTES['PUT /blocs/:id/etat-page'], {
          params: { id: BLOC },
          corps: { version, etat },
        })

      const premiere = await ecrire(0, { etape: 'ET2' })
      const rejeu = await ecrire(0, { etape: 'ET2' })

      expect(rejeu).toEqual(premiere)
      await expect(ecrire(0, { etape: 'ET3' })).rejects.toMatchObject({
        status: 409,
        code: 'conflit',
      })
    })
  })
}
