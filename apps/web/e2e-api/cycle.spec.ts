import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { remettreAZero } from './banc.ts'
import { diagnostiquerLesEchecs, ouvrirSession } from '../e2e/session.ts'
import {
  detailDuBloc,
  envoyerLeBilan,
  etapeDuType,
  faireLaVerification,
  fichesDuDepot,
  forcerAcquis,
  jouerLaRestitution,
  lendemain,
  ouvrirEtape,
  recommencerLaFiche,
  REPONSE_FAUSSE,
  reponseSolide,
  reussirLaPratique,
  reussirLaVitesse,
} from './parcours.ts'
import type { Manifeste } from './parcours.ts'

// Le cycle de vie complet d'un bloc, joué par la machine sur l'API réelle avec la vraie fiche, pour
// chaque fiche du dépôt (leçons du B01, AGENTS.md) : les branches que l'épreuve 4 demande de jouer
// à la main le sont ici à chaque PR. Le statut se lit au serveur, comme l'appli le lit.

/** Fait passer les jours un à un jusqu'à ce que le bloc porte ce manque (une échéance arrivée). */
async function jusquAuManque(
  page: Page,
  request: APIRequestContext,
  bloc: string,
  code: string,
  maxJours: number,
) {
  for (let jour = 0; jour < maxJours; jour += 1) {
    const { manque } = await detailDuBloc(request, bloc)
    if (manque.some((m) => m.code === code)) return
    await lendemain(page, request)
  }
  const { manque } = await detailDuBloc(request, bloc)
  throw new Error(
    `${bloc} n’a pas « ${code} » après ${String(maxJours)} jours : ${JSON.stringify(manque)}`,
  )
}

/** La première question de la restitution qui touche une erreur critique, et cette erreur. */
function questionFautive(manifeste: Manifeste) {
  const question = manifeste.restitution.find((q) => (q.erreurs ?? []).length > 0)
  const erreur = question?.erreurs?.[0]
  if (question === undefined || erreur === undefined) {
    throw new Error(
      `${manifeste.bloc} : aucune question de restitution ne touche une erreur critique.`,
    )
  }
  const libelle = manifeste.erreurs_critiques.find((e) => e.id === erreur)?.libelle ?? erreur
  return { question, erreur, libelle }
}

for (const manifeste of fichesDuDepot()) {
  const { bloc } = manifeste
  test.describe(`${bloc} de bout en bout sur l’API réelle`, () => {
    diagnostiquerLesEchecs(test)
    test.beforeEach(async ({ page, request }) => {
      await remettreAZero(request)
      await ouvrirSession(page)
      for (const prerequis of manifeste.prerequis) await forcerAcquis(page.request, prerequis)
    })

    test('de la première restitution à Maîtrisé : réponse fausse, erreur cochée puis reprise, Recommencer, Vitesse, vérification ratée puis réussie, retest', async ({
      page,
    }) => {
      test.setTimeout(300_000)
      const { request } = page
      const detail = () => detailDuBloc(request, bloc)

      // La page porte le titre de la fiche ; la pratique retient tant que ses items ne sont pas réussis.
      const fiche = await ouvrirEtape(page, bloc, etapeDuType(manifeste, 'pratique'))
      await expect(page.getByRole('heading', { level: 1, name: manifeste.titre })).toBeVisible()
      await expect(fiche.getByRole('button', { name: 'Étape suivante' })).toBeDisabled()
      await expect(
        fiche.getByText(/^Réussis les \d+ items avant de passer à la suite/),
      ).toBeVisible()

      // Restitution, une réponse fausse à une question qui touche une erreur critique : Vu, la pratique manque.
      const { question: fautive, erreur, libelle } = questionFautive(manifeste)
      await jouerLaRestitution(page, manifeste, {
        reponse: (q) => (q.id === fautive.id ? REPONSE_FAUSSE : reponseSolide(q.attendu)),
      })
      // La barre du gabarit est cachée dans l'appli : le statut que la fiche a reçu se lit sans être visible.
      await expect(fiche.locator('#statut')).toHaveText('Statut : Vu')
      let etat = await detail()
      expect(etat.statut).toBe('vu')
      expect(etat.manque.map((m) => m.code)).toEqual(['pratique_aide'])
      expect(etat.serie_ouverte.restitution).toBe(false)

      // La pratique réussie sans aide, comme la fiche l'envoie : acquis provisoirement.
      await reussirLaPratique(request, manifeste)
      etat = await detail()
      expect(etat.statut).toBe('acquis_provisoirement')
      expect(etat.preuves.faire_seul).not.toBeNull()

      // Le bilan : l'erreur cochée met le bloc À reprendre et rouvre la restitution.
      await envoyerLeBilan(page, manifeste, [erreur])
      await expect.poll(async () => (await detail()).statut).toBe('a_reprendre')
      etat = await detail()
      expect(etat.erreurs_ouvertes).toEqual([erreur])
      expect(etat.serie_ouverte.restitution).toBe(true)

      // La reprise : la fiche relit la dernière réponse et repose la question ; solide, elle referme l'erreur.
      await jouerLaRestitution(page, manifeste, {
        reprise: {
          aPoser: manifeste.restitution.filter((q) => (q.erreurs ?? []).includes(erreur)),
          libelle,
        },
      })
      await expect.poll(async () => (await detail()).statut).toBe('acquis_provisoirement')
      etat = await detail()
      expect(etat.erreurs_ouvertes).toEqual([])
      expect(etat.serie_ouverte.restitution).toBe(false)

      // Recommencer : les étapes vues repartent de zéro, le statut et les preuves restent.
      expect(etat.avancement.etapes_vues.length).toBeGreaterThan(1)
      await recommencerLaFiche(page, bloc)
      await expect
        .poll(async () =>
          (await detail()).avancement.etapes_vues.filter((id) => id !== manifeste.etapes[0]?.id),
        )
        .toEqual([])
      etat = await detail()
      expect(etat.statut).toBe('acquis_provisoirement')
      expect(etat.preuves.faire_seul).not.toBeNull()

      // Vitesse : un palier par jour ; deux séries le même jour n'en valident qu'un.
      const paliers = manifeste.aisance?.paliers_s ?? []
      expect(paliers.length).toBeGreaterThan(0)
      for (const [rang, palier] of paliers.entries()) {
        if (rang > 0) await lendemain(page, request)
        await reussirLaVitesse(request, manifeste, palier)
        if (rang === 0) await reussirLaVitesse(request, manifeste, palier)
        etat = await detail()
        expect(etat.aisance_reussies).toHaveLength(rang + 2)
        expect(etat.preuves.aisance === null).toBe(rang < paliers.length - 1)
      }

      // La vérification, trois jours après « acquis provisoirement » : ratée, le statut ne bouge pas.
      await jusquAuManque(page, request, bloc, 'verification_a_faire', 7)
      await faireLaVerification(page, manifeste, 'verification', true)
      await expect(page.getByText('Statut inchangé')).toBeVisible()
      etat = await detail()
      expect(etat.statut).toBe('acquis_provisoirement')
      expect(etat.manque.map((m) => m.code)).toEqual(['verification_a_venir'])

      // Le nouvel essai, deux jours plus tard : réussi, le bloc passe à Acquis.
      await jusquAuManque(page, request, bloc, 'verification_a_faire', 7)
      await faireLaVerification(page, manifeste, 'verification', false)
      await expect(page.getByText(`${bloc} passe à Acquis`)).toBeVisible()
      etat = await detail()
      expect(etat.statut).toBe('acquis')
      expect(etat.preuves.comprendre).not.toBeNull()
      expect(etat.preuves.transferer).not.toBeNull()
      expect(etat.preuves.retenir.date).not.toBeNull()
      expect(etat.manque.map((m) => m.code)).toEqual(['retest_a_venir'])

      // Le retest, trente jours plus tard : réussi, avec la Vitesse atteinte, le bloc est Maîtrisé.
      await lendemain(page, request, 29)
      await jusquAuManque(page, request, bloc, 'retest_a_faire', 7)
      await faireLaVerification(page, manifeste, 'retest', false)
      await expect(page.getByText(`${bloc} passe à Maîtrisé`)).toBeVisible()
      etat = await detail()
      expect(etat.statut).toBe('maitrise')
      expect(etat.manque).toEqual([])
    })

    test('deux vérifications ratées de suite : le bloc redescend À reprendre, restitution et pratique à refaire', async ({
      page,
    }) => {
      test.setTimeout(180_000)
      const { request } = page
      const detail = () => detailDuBloc(request, bloc)

      await jouerLaRestitution(page, manifeste)
      await reussirLaPratique(request, manifeste)
      expect((await detail()).statut).toBe('acquis_provisoirement')

      await jusquAuManque(page, request, bloc, 'verification_a_faire', 7)
      await faireLaVerification(page, manifeste, 'verification', true)
      await expect(page.getByText('Statut inchangé')).toBeVisible()
      await jusquAuManque(page, request, bloc, 'verification_a_faire', 7)
      await faireLaVerification(page, manifeste, 'verification', true)
      await expect(page.getByText(`${bloc} descend à À reprendre`)).toBeVisible()

      const etat = await detail()
      expect(etat.statut).toBe('a_reprendre')
      expect(etat.manque.map((m) => m.code)).toContain('reprise_a_faire')
      expect(etat.serie_ouverte.restitution).toBe(true)
    })
  })
}
