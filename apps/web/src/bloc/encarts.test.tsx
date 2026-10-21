import { EXEMPLES_PAGE } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MANIFESTES_GRAINE } from '../demo/graine.ts'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

const MANIFESTE = MANIFESTES_GRAINE['B03']
const ETAPES = MANIFESTE?.etapes ?? []
const etape = (type: string) => ETAPES.find((candidate) => candidate.type === type)?.id
const QUESTIONS = MANIFESTE?.restitution.map(({ id }) => id) ?? []

async function afficher() {
  const banc = creerContexteTest()
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: ['/blocs/B03'] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  const iframe = await screen.findByTitle(/^Fiche du bloc B03/)
  if (!(iframe instanceof HTMLIFrameElement) || iframe.contentWindow === null) {
    throw new Error('iframe absente')
  }
  const fenetre = iframe.contentWindow
  const recu = vi.spyOn(fenetre, 'postMessage').mockImplementation(() => undefined)
  const envoyer = async (data: unknown) => {
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data, source: fenetre }))
      await Promise.resolve()
    })
  }
  const message = (type: keyof typeof EXEMPLES_PAGE, extra: object = {}) => ({
    ...EXEMPLES_PAGE[type],
    bloc: 'B03',
    version: 1,
    ...extra,
  })
  const repondreATout = async () => {
    for (const [rang, question] of QUESTIONS.entries()) {
      await envoyer(
        message('restitution.demande', {
          id: `0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a${String(rang).padStart(2, '0')}`,
          question,
        }),
      )
    }
    await waitFor(() => {
      expect(
        banc.magasin.lire().faits.filter(({ type }) => type === 'correction').length,
      ).toBeGreaterThan(QUESTIONS.length - 1)
    })
  }
  return { ...banc, routeur, recu, envoyer, message, repondreATout }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encart du bilan', () => {
  it('donne le statut calculé et ce qui manque pour le suivant', async () => {
    const { envoyer, message, repondreATout } = await afficher()
    await repondreATout()

    await envoyer(message('etape.vue', { etape: etape('bilan') }))

    expect(await screen.findByText('Pour passer à Acquis provisoirement')).toBeVisible()
    expect(screen.getByText(/Statut calculé/)).toBeVisible()
    expect(screen.getByText('Fais l’atelier.')).toBeVisible()
  })

  it('ne s’affiche qu’à l’étape du bilan', async () => {
    const { envoyer, message } = await afficher()

    await envoyer(message('etape.vue', { etape: etape('restitution') }))

    expect(screen.queryByText(/Statut calculé/)).not.toBeInTheDocument()
  })
})

describe('corrections à vérifier au bilan', () => {
  const REPONSE = 'Une fiche contient un seul bloc expliqué avec mes propres mots.'
  const QUESTION = MANIFESTE?.restitution[0]

  async function avecCorrectionNonVerifiee() {
    if (QUESTION === undefined) throw new Error('Question de restitution absente')
    const banc = await afficher()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, correctionNonVerifiee: true },
    }))
    await banc.envoyer(
      banc.message('restitution.demande', {
        question: QUESTION.id,
        reponse: REPONSE,
        support: { colle: false, retour_cours: false },
      }),
    )
    await banc.envoyer(banc.message('etape.vue', { etape: etape('bilan') }))
    const encart = await screen.findByRole('region', { name: 'À vérifier' })
    return { ...banc, encart }
  }

  it('dit quand la correction à vérifier vient du tuteur de secours', async () => {
    if (QUESTION === undefined) throw new Error('Question de restitution absente')
    const banc = await afficher()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: {
        ...etat.interrupteurs,
        correctionNonVerifiee: true,
        correctionSecours: true,
      },
    }))
    await banc.envoyer(
      banc.message('restitution.demande', {
        question: QUESTION.id,
        reponse: REPONSE,
        support: { colle: false, retour_cours: false },
      }),
    )
    await banc.envoyer(banc.message('etape.vue', { etape: etape('bilan') }))

    const encart = await screen.findByRole('region', { name: 'À vérifier' })
    expect(within(encart).getByRole('status')).toHaveTextContent(
      'Corrigé par le tuteur de secours (deepseek-flash), pas par le tuteur habituel.',
    )
  })

  it('montre la question, la réponse, le niveau proposé et les trois décisions', async () => {
    if (QUESTION === undefined) throw new Error('Question de restitution absente')
    const { encart } = await avecCorrectionNonVerifiee()

    expect(encart).toHaveTextContent(QUESTION.question)
    expect(encart).toHaveTextContent(`« ${REPONSE} »`)
    expect(encart).toHaveTextContent('À vérifier')
    expect(within(encart).getByRole('button', { name: 'Compter ce niveau' })).toBeVisible()
    expect(within(encart).getByRole('button', { name: 'Ne pas compter' })).toBeVisible()
    expect(within(encart).getByRole('button', { name: 'Changer le niveau' })).toBeVisible()
  })

  it('« Compter ce niveau » enregistre la décision et retire la correction à trancher', async () => {
    const utilisateur = userEvent.setup()
    const { encart, magasin } = await avecCorrectionNonVerifiee()

    await utilisateur.click(within(encart).getByRole('button', { name: 'Compter ce niveau' }))

    await waitFor(() => {
      expect(
        magasin.lire().faits.some((fait) => fait.type === 'correction_tranchee' && fait.compte),
      ).toBe(true)
    })
    expect(screen.queryByRole('button', { name: 'Compter ce niveau' })).not.toBeInTheDocument()
  })

  it('« Ne pas compter » enregistre une décision non comptable', async () => {
    const utilisateur = userEvent.setup()
    const { encart, magasin } = await avecCorrectionNonVerifiee()

    await utilisateur.click(within(encart).getByRole('button', { name: 'Ne pas compter' }))

    await waitFor(() => {
      expect(
        magasin.lire().faits.some((fait) => fait.type === 'correction_tranchee' && !fait.compte),
      ).toBe(true)
    })
  })

  it('« Changer le niveau » exige un niveau et une raison de dix caractères', async () => {
    const utilisateur = userEvent.setup()
    const { encart, magasin } = await avecCorrectionNonVerifiee()

    await utilisateur.click(within(encart).getByRole('button', { name: 'Changer le niveau' }))
    const dialogue = screen.getByRole('dialog', { name: 'Changer le niveau' })
    const valider = within(dialogue).getByRole('button', { name: 'Changer le niveau' })
    expect(valider).toBeDisabled()

    await utilisateur.click(within(dialogue).getByRole('radio', { name: 'Partiel' }))
    await utilisateur.type(within(dialogue).getByLabelText('Raison'), 'Trop peu')
    expect(valider).toBeDisabled()

    await utilisateur.clear(within(dialogue).getByLabelText('Raison'))
    await utilisateur.type(within(dialogue).getByLabelText('Raison'), 'Je retiens ce niveau.')
    await utilisateur.click(valider)

    await waitFor(() => {
      expect(
        magasin
          .lire()
          .faits.some(
            (fait) =>
              fait.type === 'correction_tranchee' &&
              fait.compte &&
              fait.niveau === 'partiel' &&
              fait.raison === 'Je retiens ce niveau.',
          ),
      ).toBe(true)
    })
  })
})

describe('réponses après retour au cours', () => {
  it('les rend visibles dans le bilan comme « Ne compte pas · Avec support »', async () => {
    const question = MANIFESTE?.restitution[0]
    if (question === undefined) throw new Error('Question de restitution absente')
    const { envoyer, message } = await afficher()
    const reponse = 'Je réponds après avoir rouvert le cours.'

    await envoyer(
      message('restitution.demande', {
        question: question.id,
        reponse,
        support: { colle: false, retour_cours: true },
      }),
    )
    await envoyer(message('etape.vue', { etape: etape('bilan') }))

    const badge = await screen.findByText('Ne compte pas · Avec support')
    const reponseBilan = badge.closest('div')
    if (reponseBilan === null) throw new Error('Réponse du bilan absente')
    expect(within(reponseBilan).getByText(question.question)).toBeVisible()
    expect(within(reponseBilan).getByText(`« ${reponse} »`)).toBeVisible()
    expect(badge).toBeVisible()
  })
})

describe('erreur critique repérée par l’IA', () => {
  const REPONSE = 'Une fiche, c’est un cours en entier.'

  async function avecErreurIa() {
    const banc = await afficher()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, erreurIa: true },
    }))
    await banc.envoyer(
      banc.message('restitution.demande', { question: QUESTIONS[0], reponse: REPONSE }),
    )
    const encart = await screen.findByRole('region', {
      name: 'Erreur critique repérée par l’IA · À confirmer',
    })
    return { ...banc, encart }
  }

  it('nomme l’erreur visée, pas seulement la réponse', async () => {
    const { encart } = await avecErreurIa()

    expect(encart).toHaveTextContent('Erreur visée : Confondre une fiche et un cours complet')
  })

  it('cite la réponse et dit ce que la confirmation change', async () => {
    const { encart } = await avecErreurIa()

    expect(encart).toHaveTextContent(`« ${REPONSE} »`)
    expect(encart).toHaveTextContent(
      'Si tu confirmes, B03 passe à À reprendre jusqu’à ce que tu réussisses une question sur ce point.',
    )
    expect(within(encart).getByRole('button', { name: 'C’est bien une erreur' })).toBeVisible()
    expect(within(encart).getByRole('button', { name: 'Ce n’en est pas une' })).toBeVisible()
  })

  it('confirmer passe le bloc à « À reprendre »', async () => {
    const utilisateur = userEvent.setup()
    const { encart, magasin, recu } = await avecErreurIa()

    await utilisateur.click(within(encart).getByRole('button', { name: 'C’est bien une erreur' }))

    await waitFor(() => {
      expect(screen.getByText('À reprendre')).toBeVisible()
    })
    expect(screen.queryByRole('region', { name: /Erreur critique/ })).not.toBeInTheDocument()
    expect(
      magasin
        .lire()
        .faits.some((fait) => fait.type === 'erreur_ia_tranchee' && fait.decision === 'confirmee'),
    ).toBe(true)
    expect(recu).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'erreur.rejetee' }), '*')
  })

  it('rejeter laisse le statut calculé, garde la décision et le dit à la fiche', async () => {
    const utilisateur = userEvent.setup()
    const { encart, magasin, recu } = await avecErreurIa()

    await utilisateur.click(within(encart).getByRole('button', { name: 'Ce n’en est pas une' }))

    // La fiche retire l'erreur de son bilan, qui sinon la cocherait d'office.
    await waitFor(() => {
      expect(recu).toHaveBeenCalledWith(
        { type: 'erreur.rejetee', question: QUESTIONS[0], erreur: 'E1' },
        '*',
      )
    })

    expect(screen.queryByRole('region', { name: /Erreur critique/ })).not.toBeInTheDocument()
    expect(screen.queryByText('À reprendre')).not.toBeInTheDocument()
    expect(
      magasin
        .lire()
        .faits.some((fait) => fait.type === 'erreur_ia_tranchee' && fait.decision === 'rejetee'),
    ).toBe(true)
  })

  it('au bilan, la phrase de ce qui manque commence par « Tranche d’abord »', async () => {
    const { envoyer, message } = await avecErreurIa()

    await envoyer(message('etape.vue', { etape: etape('bilan') }))

    expect(await screen.findByText('Tranche d’abord l’erreur repérée ci-dessous.')).toBeVisible()
  })
})
