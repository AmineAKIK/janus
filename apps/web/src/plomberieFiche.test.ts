// @vitest-environment-options {"runScripts": "dangerously"}
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Le gabarit est une fiche complète (bloc X00). Ces tests font tourner sa plomberie, telle que l'appli
// la charge dans son iframe, contre un pont simulé.
const GABARIT = readFileSync(join(process.cwd(), '../../contenu/dwwm/gabarit/fiche.html'), 'utf8')
/** L'objectif du gabarit, que la carte et la pratique rappellent sous « Ce qui sera vérifié ». */
const OBJECTIF = 'À REMPLACER : ce que tu sauras faire à la fin, vérifiable en une phrase.'
/** Une page ouverte sur une étape, rien d'envoyé. */
const aLEtape = (etape: string) => ({ etape, envoyees: {}, pratique: {}, retourCours: false })

type Rappel = (valeur: unknown) => void
type Envoi = { type: string; donnees: unknown }

/** Un pont en mode appli : il note ce que la page envoie, et le test lui fait dire un statut. */
function pontSimule(
  etat: Record<string, unknown>,
  correction?: Record<string, unknown>,
  serieOuverte = { restitution: true },
  aisance: readonly { le: string; duree_s: number }[] = [],
) {
  const envois: Envoi[] = []
  /** Chaque demande de correction de la page. */
  const demandes: Record<string, unknown>[] = []
  /** Chaque état que la page a demandé de sauver. */
  const sauvees: Record<string, unknown>[] = []
  const statuts = new Set<Rappel>()
  const erreurs = new Set<Rappel>()
  const rejets = new Set<Rappel>()
  const inits = new Set<Rappel>()
  const pont = {
    demarrer: () =>
      Promise.resolve({
        mode: 'appli',
        etat,
        init: { statut: 'vu', serie_ouverte: serieOuverte, aisance },
      }),
    envoyer: (type: string, donnees: unknown) => {
      envois.push({ type, donnees })
      return 'message-' + String(envois.length)
    },
    sauver: (etat: Record<string, unknown>) => {
      sauvees.push(structuredClone(etat))
    },
    demanderCorrection: (demande: Record<string, unknown>) => {
      demandes.push(demande)
      return correction === undefined ? new Promise(() => undefined) : Promise.resolve(correction)
    },
    surStatut: (rappel: Rappel) => {
      statuts.add(rappel)
      return () => statuts.delete(rappel)
    },
    surErreur: (rappel: Rappel) => {
      erreurs.add(rappel)
      return () => erreurs.delete(rappel)
    },
    surEtape: () => () => undefined,
    surInit: (rappel: Rappel) => {
      inits.add(rappel)
      return () => inits.delete(rappel)
    },
    surRejet: (rappel: Rappel) => {
      rejets.add(rappel)
      return () => rejets.delete(rappel)
    },
  }
  const direStatut = (statut: unknown) => {
    for (const rappel of statuts) rappel(statut)
  }
  /** L'appli renvoie un etat.init (le serveur a relu le bloc : une série s'ouvre ou se ferme). */
  const direInit = (init: Record<string, unknown>) => {
    for (const rappel of inits)
      rappel({ statut: 'vu', serie_ouverte: serieOuverte, aisance, ...init })
  }
  /** L'appli refuse le dernier message envoyé. */
  const refuserDernier = (detail: string) => {
    for (const rappel of erreurs)
      rappel({ code: 'message_refuse', detail, message_id: 'message-' + String(envois.length) })
  }
  /** Amine rejette, dans l'appli, une erreur que la correction d'une question avait repérée. */
  const rejeter = (question: string, erreur: string) => {
    for (const rappel of rejets) rappel({ question, erreur })
  }
  return { pont, envois, demandes, sauvees, direStatut, direInit, refuserDernier, rejeter }
}

/**
 * Ce que la page garde dans son état, et rien d'autre. Leçon du B01 (PR #265, #269, #270, #274,
 * #275) : chaque fois que la page a déduit elle-même un état que le serveur calcule (série ouverte,
 * niveaux d'aisance réussis, étapes vues, erreurs ouvertes, statut), les deux ont divergé. La page
 * lit ces états dans etat.init et statut.maj ; elle ne les sauve pas.
 */
const CLES_DE_LA_PAGE = new Set([
  'etape',
  'ecrans',
  'itemCourant',
  'envoyees',
  'corrigees',
  'enCours',
  'retourCours',
  'pratique',
  'atelier',
  'bilan',
  'aCocher',
  'erreurs',
  'traces',
])

/** Met la page de la fiche dans le document du test, puis lance sa plomberie. */
function monter(fiche: string, pont: object) {
  const page = new DOMParser().parseFromString(fiche, 'text/html')
  const plomberie = page.getElementById('plomberie')?.textContent ?? ''
  for (const script of page.querySelectorAll('#pont, #plomberie, #outils-bloc')) script.remove()
  document.body.replaceChildren(
    ...Array.from(page.body.childNodes, (noeud) => document.importNode(noeud, true)),
  )
  Object.assign(window, { JanusPont: pont })
  window.eval(plomberie)
}

/** Répond à chaque question de la série affichée, une à une, jusqu'à la dernière. */
async function repondreATout(reponse = 'Une réponse.') {
  for (;;) {
    const zone = screen
      .queryAllByRole('textbox')
      .find((champ) => champ instanceof HTMLTextAreaElement && !champ.disabled)
    if (!(zone instanceof HTMLTextAreaElement)) return
    const question = zone.closest('.item')
    if (!(question instanceof HTMLElement)) throw new Error('Une question sans sa carte')
    fireEvent.input(zone, { target: { value: reponse } })
    fireEvent.click(within(question).getByRole('radio', { name: 'Sûr' }))
    fireEvent.click(within(question).getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => {
      expect(zone).toBeDisabled()
    })
  }
}

/** Une page arrivée au bilan, la restitution faite (les cinq questions du gabarit répondues). */
const auBilan = (suite: Record<string, unknown> = {}) => ({
  etape: 'ET6',
  envoyees: Object.fromEntries(
    ['R1', 'R2', 'R3', 'R4', 'R5'].map((id) => [id, { reponse: 'Réponse.', confiance: 'sur' }]),
  ),
  pratique: {},
  retourCours: false,
  ...suite,
})

describe('le bilan de la fiche', () => {
  it('ne se renvoie que si les cases disent autre chose que le bilan déjà envoyé', async () => {
    const { pont } = pontSimule(auBilan({ bilan: { ids: [] } }))
    monter(GABARIT, pont)
    const bouton = await screen.findByRole('button', { name: 'Bilan envoyé' })
    const [premiere] = screen.getAllByRole('checkbox')
    if (premiere === undefined) throw new Error('Aucune erreur à cocher')

    expect(bouton).toBeDisabled()
    fireEvent.click(premiere)
    expect(bouton).toBeEnabled()
    expect(bouton).toHaveTextContent('Envoyer le bilan')
    fireEvent.click(premiere)
    expect(bouton).toBeDisabled()
    expect(bouton).toHaveTextContent('Bilan envoyé')
  })

  it('après un envoi, cocher puis décocher une case ne le rallume pas', async () => {
    const { pont, envois } = pontSimule(auBilan())
    monter(GABARIT, pont)
    const bouton = await screen.findByRole('button', { name: 'Envoyer le bilan' })
    const [premiere, deuxieme] = screen.getAllByRole('checkbox')
    if (premiere === undefined || deuxieme === undefined) throw new Error('Deux erreurs attendues')

    fireEvent.click(premiere)
    fireEvent.click(bouton)
    expect(envois).toContainEqual({ type: 'bilan.erreurs', donnees: { ids: ['E1'] } })
    expect(bouton).toBeDisabled()
    fireEvent.click(deuxieme)
    expect(bouton).toBeEnabled()
    fireEvent.click(deuxieme)
    expect(bouton).toBeDisabled()
  })

  it('quand l’appli referme une erreur, les cases la suivent et deviennent la référence', async () => {
    const { pont, direStatut } = pontSimule(auBilan({ bilan: { ids: ['E1'] } }))
    monter(GABARIT, pont)
    const bouton = await screen.findByRole('button', { name: 'Bilan envoyé' })
    const [premiere] = screen.getAllByRole('checkbox')
    if (premiere === undefined) throw new Error('Aucune erreur à cocher')
    expect(premiere).toBeChecked()
    expect(premiere).toBeDisabled()

    // Une réponse solide a refermé E1 : plus d'erreur ouverte dans ce qui manque.
    direStatut({ statut: 'vu', manque: [] })
    expect(premiere).not.toBeChecked()
    expect(premiere).toBeEnabled()
    expect(bouton).toBeDisabled()
    fireEvent.click(premiere)
    expect(bouton).toBeEnabled()
    fireEvent.click(premiere)
    expect(bouton).toBeDisabled()
  })

  it('une erreur ouverte reste cochée : décocher ne la ferme pas, seule une réponse solide', async () => {
    const { pont, direStatut } = pontSimule(auBilan({ bilan: { ids: ['E1'] } }))
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Bilan envoyé' })
    const [premiere] = screen.getAllByRole('checkbox')
    if (premiere === undefined) throw new Error('Aucune erreur à cocher')

    expect(premiere).toBeChecked()
    expect(premiere).toBeDisabled()
    expect(
      screen.getByText(/seule une réponse solide à une question qui la touche la referme/),
    ).toBeInTheDocument()
    // L'appli dit E1 encore ouverte : la case reste cochée et verrouillée.
    direStatut({ statut: 'a_reprendre', manque: [{ code: 'erreur_ouverte', erreurs: ['E1'] }] })
    expect(premiere).toBeChecked()
    expect(premiere).toBeDisabled()
  })

  it('une erreur repérée dans les réponses arrive cochée, verrouillée, et part avec le bilan', async () => {
    const { pont, envois } = pontSimule(
      auBilan({ erreurs: { R2: ['E2'] }, aCocher: ['E2'], bilan: { ids: [] } }),
    )
    monter(GABARIT, pont)
    const bouton = await screen.findByRole('button', { name: 'Envoyer le bilan' })
    const [premiere, deuxieme] = screen.getAllByRole('checkbox')
    if (premiere === undefined || deuxieme === undefined) throw new Error('Deux erreurs attendues')

    expect(premiere).not.toBeChecked()
    expect(deuxieme).toBeChecked()
    expect(deuxieme).toBeDisabled()
    fireEvent.click(bouton)
    expect(envois).toContainEqual({ type: 'bilan.erreurs', donnees: { ids: ['E2'] } })
  })

  it('une erreur repérée qu’Amine rejette n’est plus cochée d’office', async () => {
    const { pont, envois, sauvees, rejeter } = pontSimule(
      auBilan({ erreurs: { R2: ['E2'] }, aCocher: ['E2'], bilan: { ids: [] } }),
    )
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Envoyer le bilan' })

    rejeter('R2', 'E2')

    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked()
    })
    expect(screen.getAllByRole('checkbox')[1]).toBeEnabled()
    expect(screen.queryByText(/Repérée dans tes réponses/)).not.toBeInTheDocument()
    expect(sauvees.at(-1)).toMatchObject({ aCocher: [], erreurs: { R2: [] } })
    // Le dernier bilan ne cochait rien : il n'y a plus rien à envoyer.
    expect(screen.getByRole('button', { name: 'Bilan envoyé' })).toBeDisabled()
    expect(envois).not.toContainEqual(expect.objectContaining({ type: 'bilan.erreurs' }))
  })

  it('une erreur rejetée pour une question reste cochée si un outil ou une autre réponse l’a repérée', async () => {
    const { pont, sauvees, rejeter } = pontSimule(
      auBilan({
        erreurs: { R2: ['E2'], 'outil:PR1-1': ['E2'] },
        aCocher: ['E2'],
        bilan: { ids: [] },
      }),
    )
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Envoyer le bilan' })

    rejeter('R2', 'E2')

    await waitFor(() => {
      expect(sauvees.at(-1)).toMatchObject({ aCocher: ['E2'], erreurs: { R2: [] } })
    })
    expect(screen.getAllByRole('checkbox')[1]).toBeChecked()
    expect(screen.getAllByRole('checkbox')[1]).toBeDisabled()
  })

  it('refusé, il garde les cases cochées et peut repartir', async () => {
    const { pont, refuserDernier } = pontSimule(auBilan({ bilan: { ids: [] } }))
    monter(GABARIT, pont)
    const bouton = await screen.findByRole('button', { name: 'Bilan envoyé' })
    const [premiere] = screen.getAllByRole('checkbox')
    if (premiere === undefined) throw new Error('Aucune erreur à cocher')

    fireEvent.click(premiere)
    fireEvent.click(bouton)
    refuserDernier('Bloc fermé.')
    expect(screen.getByText('Le bilan n’est pas parti : Bloc fermé.')).toBeInTheDocument()
    expect(premiere).toBeChecked()
    expect(bouton).toBeEnabled()
    expect(bouton).toHaveTextContent('Envoyer le bilan')
    fireEvent.click(premiere)
    expect(bouton).toBeDisabled()
  })
})

describe('une correction tirée au sort', () => {
  const correction = {
    id: '0199f5a0-0000-7000-8000-000000000001',
    echantillon: true,
    question: 'R1',
    tour: 1,
    message: 'Bien vu.',
    niveau: 'solide',
    erreurs_critiques: [],
    source: 'deduit',
    ref: 'R1',
    certitude: 'non_verifie',
    compte: true,
  }

  it('demande l’avis sur le niveau à la fin de la série, dans un groupe à part, puis remercie', async () => {
    const etat = { etape: 'ET4', envoyees: {}, pratique: {}, retourCours: false }
    const { pont, envois, sauvees } = pontSimule(etat, correction)
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout()
    const [question] = document.querySelectorAll<HTMLElement>('.item')
    if (question === undefined) throw new Error('Aucune carte de question')
    const accord = within(question).getByRole('group', { name: /D’accord avec ce niveau/ })

    expect(accord.closest('[aria-live="polite"]')).not.toBeNull()
    fireEvent.click(within(accord).getByRole('button', { name: 'Oui' }))
    expect(envois).toContainEqual({
      type: 'correction.accord',
      donnees: { correction: correction.id, accord: true },
    })
    expect(within(question).queryByRole('group', { name: /D’accord/ })).toBeNull()
    expect(within(question).getByText('Merci, c’est noté.')).toBeInTheDocument()
    // L'avis est gardé : il n'est pas redemandé à la visite suivante.
    expect(sauvees.at(-1)?.['corrigees']).toMatchObject({ R1: { premiere: { avis: true } } })
  })
})

describe('une série de questions', () => {
  const correction = {
    id: '0199f5a0-0000-7000-8000-000000000002',
    echantillon: false,
    question: 'R1',
    tour: 1,
    message: 'Bien vu.',
    niveau: 'solide',
    erreurs_critiques: [],
    source: 'deduit',
    ref: 'R1',
    certitude: 'sur',
    compte: true,
  }

  it('commence sur « Commencer » : rien à répondre avant, et le cours se masque dès le clic', async () => {
    const { pont } = pontSimule(aLEtape('ET4'), correction)
    monter(GABARIT, pont)
    const commencer = await screen.findByRole('button', { name: 'Commencer' })

    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(
      screen.getByText(/dès que tu commences, il est masqué jusqu’à ta dernière réponse/),
    ).toBeInTheDocument()
    fireEvent.click(commencer)
    expect(await screen.findAllByRole('textbox')).toHaveLength(1)
  })

  it('pose une question à la fois : la suivante paraît sous la précédente, une fois finie', async () => {
    const { pont } = pontSimule(aLEtape('ET4'), correction)
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    const [zone, ...autres] = await screen.findAllByRole('textbox')
    const question = zone?.closest('.item')
    if (!(zone instanceof HTMLTextAreaElement) || !(question instanceof HTMLElement))
      throw new Error('Aucune question à répondre')
    expect(autres).toHaveLength(0)

    fireEvent.input(zone, { target: { value: 'Une réponse.' } })
    fireEvent.click(within(question).getByRole('radio', { name: 'Sûr' }))
    fireEvent.click(within(question).getByRole('button', { name: 'Envoyer' }))
    await within(question).findByText(/Envoyée\. Sa correction s’affichera à la fin de la série/)

    // La correction ne souffle pas la question suivante : elle attend la fin de la série.
    expect(screen.queryByText('Bien vu.')).toBeNull()
    const zones = screen.getAllByRole('textbox')
    expect(zones).toHaveLength(2)
    expect(zones[0]).toBe(zone)
    expect(zones[0]).toBeDisabled()
    expect(zones[1]).not.toBeDisabled()
    expect(zones[1]?.closest('.item')?.previousElementSibling).toBe(question)
  })

  it('corrige toute la série à la fin : après la dernière réponse, chaque carte a sa correction', async () => {
    const { pont, demandes } = pontSimule(aLEtape('ET4'), correction)
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout()

    expect(demandes.map((demande) => demande['question'])).toEqual(['R1', 'R2', 'R3', 'R4', 'R5'])
    expect(demandes.every((demande) => demande['relance'] === '')).toBe(true)
    expect(screen.getAllByText('Bien vu.')).toHaveLength(5)
    expect(screen.getByText(/Restitution terminée/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Compléter ma réponse' })).toBeNull()
  })

  it('un etat.init reçu pendant que la dernière correction est en attente ne la perd pas', async () => {
    // Leçon du B01 (captures « bilan secours ») : l'appli ferme la restitution dès que la dernière
    // réponse est enregistrée, souvent avant que sa correction n'arrive ; la page se redessine alors.
    const simule = pontSimule(aLEtape('ET4'), correction, { restitution: true })
    let rendreLaDerniere: (correction: Record<string, unknown>) => void = () => undefined
    const demanderCorrection = simule.pont.demanderCorrection
    simule.pont.demanderCorrection = (demande: Record<string, unknown>) =>
      simule.demandes.length === 4
        ? new Promise<unknown>((resoudre) => {
            simule.demandes.push(demande)
            rendreLaDerniere = resoudre
          })
        : demanderCorrection(demande)
    monter(GABARIT, simule.pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    for (let rang = 0; rang < 5; rang += 1) {
      const zone = screen
        .getAllByRole('textbox')
        .find((champ) => champ instanceof HTMLTextAreaElement && !champ.disabled)
      if (!(zone instanceof HTMLTextAreaElement)) throw new Error('Pas de question à répondre')
      const question = zone.closest('.item')
      if (!(question instanceof HTMLElement)) throw new Error('Une question sans sa carte')
      fireEvent.input(zone, { target: { value: 'Une réponse.' } })
      fireEvent.click(within(question).getByRole('radio', { name: 'Sûr' }))
      fireEvent.click(within(question).getByRole('button', { name: 'Envoyer' }))
      if (rang < 4) {
        await waitFor(() => {
          expect(zone).toBeDisabled()
        })
      }
    }
    expect(simule.demandes).toHaveLength(5)

    simule.direInit({ serie_ouverte: { restitution: false } })
    await screen.findByText('Cette série n’est pas ouverte.')
    rendreLaDerniere({ ...correction, question: 'R5', ref: 'R5' })

    await waitFor(() => {
      expect(screen.getAllByText('Bien vu.')).toHaveLength(5)
    })
    expect(screen.getByText(/Restitution terminée/)).toBeInTheDocument()
  })

  it('ne sauve que l’état de la page : rien de ce que le serveur calcule', async () => {
    const { pont, sauvees } = pontSimule(aLEtape('ET4'), correction)
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout()

    expect(sauvees.length).toBeGreaterThan(0)
    const cles = new Set(sauvees.flatMap((etat) => Object.keys(etat)))
    for (const cle of cles) expect(CLES_DE_LA_PAGE).toContain(cle)
  })

  it('garde les corrections dans l’état : la série reprise après un rechargement les cache, finie les montre', async () => {
    const envoyees = { R1: { reponse: 'Ma réponse à R1.', confiance: 'sur' } }
    const corrigees = {
      R1: {
        premiere: { ...correction, message: 'Gardée.', raison_non_compte: null },
        relance: null,
      },
    }
    const { pont } = pontSimule(
      { ...aLEtape('ET4'), envoyees, corrigees, enCours: { restitution: true } },
      correction,
    )
    monter(GABARIT, pont)
    await screen.findByText('Ma réponse à R1.')

    expect(screen.queryByText('Gardée.')).toBeNull()
    expect(screen.getByText('Corrigée à la fin de la série.')).toBeInTheDocument()
    await repondreATout()
    expect(screen.getByText('Gardée.')).toBeInTheDocument()
  })

  it('une erreur restée ouverte : avant de reprendre, la dernière réponse se relit avec sa correction', async () => {
    const envoyees = Object.fromEntries(
      ['R1', 'R2', 'R3', 'R4', 'R5'].map((id) => [
        id,
        { reponse: 'Ma réponse à ' + id + '.', confiance: 'sur' },
      ]),
    )
    const corrigees = {
      R1: {
        premiere: {
          ...correction,
          message: 'Juste, mais collée.',
          compte: false,
          raison_non_compte: 'avec_support',
        },
        relance: null,
      },
    }
    const { pont, direStatut } = pontSimule(
      { ...aLEtape('ET6'), envoyees, corrigees, bilan: { ids: ['E1'] } },
      correction,
    )
    monter(GABARIT, pont)
    direStatut({ statut: 'a_reprendre', manque: [{ code: 'erreur_ouverte', erreurs: ['E1'] }] })
    fireEvent.click(await screen.findByRole('button', { name: 'Aller à la restitution' }))

    expect(
      await screen.findByRole('heading', { name: 'Tes dernières réponses à reprendre' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ma réponse à R1.')).toBeInTheDocument()
    expect(screen.getByText('Juste, mais collée.')).toBeInTheDocument()
    expect(screen.getByText('Ne compte pas · Avec support')).toBeInTheDocument()
    // Un complément ne compte jamais : il ne refermerait pas l'erreur, la carte ne le propose pas.
    expect(screen.queryByRole('button', { name: 'Compléter ma réponse' })).toBeNull()

    // Commencée, la reprise ne montre plus que la question, sans sa correction.
    fireEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect(screen.queryByText('Juste, mais collée.')).toBeNull()
  })

  it('une réponse nouvelle remplace les erreurs repérées sur sa question', async () => {
    const { pont, sauvees } = pontSimule(
      { ...aLEtape('ET4'), erreurs: { R1: ['E1'], 'outil:PR1-1': ['E1'] }, aCocher: ['E1'] },
      correction,
    )
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout()
    expect(sauvees.at(-1)).toMatchObject({
      erreurs: { R1: [], 'outil:PR1-1': ['E1'] },
      aCocher: ['E1'],
    })
  })

  it('une réponse nouvelle décoche l’erreur que seule la précédente avait fait repérer', async () => {
    const { pont, sauvees } = pontSimule(
      { ...aLEtape('ET4'), erreurs: { R1: ['E1'] }, aCocher: ['E1'] },
      correction,
    )
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout()
    expect(sauvees.at(-1)).toMatchObject({ erreurs: { R1: [] }, aCocher: [] })
  })

  it('la série finie, une réponse qui n’est pas solide se complète une fois, sans compter', async () => {
    const partielle = { ...correction, niveau: 'partiel', message: 'Il manque la raison.' }
    const { pont, demandes } = pontSimule(aLEtape('ET4'), partielle)
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout('Ma première réponse.')
    const [completer] = screen.getAllByRole('button', { name: 'Compléter ma réponse' })
    if (completer === undefined) throw new Error('Rien à compléter')
    const carte = completer.closest('.item')
    if (!(carte instanceof HTMLElement)) throw new Error('Un complément hors de sa carte')

    fireEvent.click(completer)
    const zone = within(carte).getByRole('textbox', { name: /Complète ta réponse/ })
    expect(zone).toHaveValue('Ma première réponse.')
    fireEvent.input(zone, { target: { value: 'Ma réponse complétée.' } })
    fireEvent.click(within(carte).getByRole('radio', { name: 'Sûr' }))
    fireEvent.click(within(carte).getByRole('button', { name: 'Envoyer le complément' }))
    await waitFor(() => {
      expect(zone).toBeDisabled()
    })

    expect(demandes.at(-1)).toMatchObject({ question: 'R1', relance: 'Il manque la raison.' })
    expect(within(carte).getAllByText('Il manque la raison.')).toHaveLength(2)
    expect(within(carte).queryByRole('button', { name: 'Compléter ma réponse' })).toBeNull()
  })

  it('montre les réponses déjà envoyées, puis la première question qui attend', async () => {
    const envoyees = { R1: { reponse: 'Ma réponse à R1.', confiance: 'sur' } }
    const { pont } = pontSimule({ ...aLEtape('ET4'), envoyees, enCours: { restitution: true } })
    monter(GABARIT, pont)
    await screen.findByText('Ma réponse à R1.')

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })
})

/** Un pont en mode autonome : comme le vrai, il fait corriger la page par sa propre fonction `ask`. */
function pontAutonome(etat: Record<string, unknown>) {
  const { pont } = pontSimule(etat)
  let ask: ((demande: Record<string, unknown>) => Promise<unknown>) | undefined
  return {
    ...pont,
    demarrer: ({ autonome }: { autonome: { ask: NonNullable<typeof ask> } }) => {
      ask = autonome.ask
      return Promise.resolve({ mode: 'autonome', etat, init: null })
    },
    demanderCorrection: (demande: Record<string, unknown>) => {
      if (ask === undefined) throw new Error('Pas de correcteur autonome')
      return ask(demande)
    },
  }
}

describe('la correction simulée, hors de l’appli', () => {
  it('ne dit jamais « solide », même à une réponse qui reprend les mots de l’attendu', async () => {
    monter(GABARIT, pontAutonome(aLEtape('ET4')))
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout(
      'À remplacer : ce qu’une bonne réponse contient, une réponse qui contient les mots.',
    )

    const bulles = await screen.findAllByText('À comparer', {}, { timeout: 3000 })
    expect(bulles).toHaveLength(5)
    expect(screen.queryByText('Solide')).toBeNull()
    expect(screen.getAllByText('Ne compte pas · Non vérifiée')).toHaveLength(5)
    // Le texte se lit espaces normalisées : une espace insécable s'y lit comme une espace.
    expect(
      screen.getByText(
        /Ce qui était attendu : « À REMPLACER : ce qu'une bonne réponse contient \(question R1\)\. »/,
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Compléter ma réponse' })).toHaveLength(5)
  })

  it('dit l’attendu avec des mots : le titre de l’étape, le nom de l’erreur, jamais leurs codes', async () => {
    const avecCodes = GABARIT.replace(
      "À REMPLACER : ce qu'une bonne réponse contient (question R1).",
      "Lu à l'envers, on trouverait 45 : c'est l'erreur E1. D'après les étapes 2 et 3.",
    )
    expect(avecCodes).not.toBe(GABARIT)
    monter(avecCodes, pontAutonome(aLEtape('ET4')))
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout(
      'Une réponse assez longue pour montrer une idée, avec quelques mots de plus.',
    )

    await screen.findAllByText('À comparer', {}, { timeout: 3000 })
    const attendu = screen.getByText(/Lu à l'envers, on trouverait 45/)
    expect(attendu).toHaveTextContent(
      "c'est l'erreur « À REMPLACER : confusion centrale 1 ». D'après les étapes 2 (Explication) et 3 (Pratique).",
    )
    expect(attendu).not.toHaveTextContent(/\bE1\b/)
  })

  it('dit « Pas encore » à « je ne sais pas », et « Trop courte » à une réponse trop courte', async () => {
    monter(GABARIT, pontAutonome(aLEtape('ET4')))
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout('Je ne sais pas')
    expect(await screen.findAllByText('Pas encore', {}, { timeout: 3000 })).toHaveLength(5)

    monter(GABARIT, pontAutonome(aLEtape('ET4')))
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout('Une idée.')
    expect(await screen.findAllByText('Trop courte', {}, { timeout: 3000 })).toHaveLength(5)
  })
})

describe('le cours pendant une série', () => {
  const masque = /Masqué : la restitution se fait sans le cours/

  it('masque aussi le reste de la fiche : la carte, la pratique et le bilan', async () => {
    for (const etape of ['ET1', 'ET3', 'ET6']) {
      document.body.replaceChildren()
      const { pont } = pontSimule({ ...aLEtape(etape), enCours: { restitution: true } })
      monter(GABARIT, pont)

      expect(
        await screen.findByText(/Cette étape s’ouvrira après ta dernière réponse/),
      ).toBeInTheDocument()
      // Le bilan nomme les erreurs critiques : il soufflerait des réponses.
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    }
  })

  it('reste ouvert tant que la restitution n’est pas commencée', async () => {
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(GABARIT, pont)
    await screen.findByRole('heading', { name: 'Explication' })

    expect(screen.queryByText(masque)).toBeNull()
  })

  it('est masqué dès « Commencer », avant la première réponse', async () => {
    const { pont } = pontSimule({ ...aLEtape('ET2'), enCours: { restitution: true } })
    monter(GABARIT, pont)

    expect(
      await screen.findByText(/Masqué : la restitution se fait sans le cours/),
    ).toBeInTheDocument()
  })
})

describe('les traces de la fiche', () => {
  it('garde ce qu’un outil émet sur fiche:trace et le lui rend dans fiche:rendu', async () => {
    const { pont, sauvees } = pontSimule(aLEtape('ET2'))
    const rendus: unknown[] = []
    document.addEventListener('fiche:rendu', (evenement) => {
      rendus.push((evenement as CustomEvent<{ traces: unknown }>).detail.traces)
    })
    monter(GABARIT, pont)
    await screen.findByRole('heading', { name: 'Explication' })

    document.body.dispatchEvent(
      new CustomEvent('fiche:trace', {
        bubbles: true,
        detail: { cle: 'pari-ET1', valeur: 'abime' },
      }),
    )
    expect(sauvees.at(-1)?.['traces']).toEqual({ 'pari-ET1': 'abime' })
    fireEvent.click(screen.getByRole('button', { name: /Étape suivante/ }))
    expect(rendus.at(-1)).toEqual({ 'pari-ET1': 'abime' })
  })

  it('rend dans fiche:rendu les séries d’aisance réussies que l’appli connaît, même sans traces', async () => {
    const reussies = [{ le: '2026-10-19T08:00:00Z', duree_s: 21.4 }]
    const { pont } = pontSimule(aLEtape('ET2'), undefined, undefined, reussies)
    const rendus: unknown[] = []
    document.addEventListener('fiche:rendu', (evenement) => {
      rendus.push((evenement as CustomEvent<{ aisance: unknown }>).detail.aisance)
    })
    monter(GABARIT, pont)
    await screen.findByRole('heading', { name: 'Explication' })

    expect(rendus.at(-1)).toEqual(reussies)
  })
})

describe('la tentative avant l’explication (pré-test)', () => {
  /**
   * Le gabarit, son explication changée en pré-test de deux écrans : un essai par écran, sans outil
   * de fiche. Le test joue l'outil en émettant fiche:essai, comme le ferait celui d'une fiche.
   */
  const avecPretest = GABARIT.replace(
    '"id": "ET2",\n            "titre": "Explication",\n            "type": "explication"',
    '"id": "ET2",\n            "titre": "Compter avec des lampes",\n            "type": "pretest"',
  ).replace(
    '<template data-etape="ET2">',
    '<template data-etape="ET2"><div data-ecran="Le compteur"><div class="ex" data-essai data-id="c1" data-reponse="7"><p class="q">Le plus grand nombre avec 3 lampes ?</p><input aria-label="Ta réponse" /></div></div>' +
      '<div data-ecran="Une lampe de plus"><div class="ex" data-essai data-id="c2" data-reponse="double" data-explication="Compare 8 et 16."><p class="q">Que devient le nombre de valeurs ?</p><ul class="options"><li data-option="deux">Il augmente de 2.</li><li data-option="double">Il double.</li></ul></div></div></template><template data-etape="ET0">',
  )
  const essai = (cle: string, detail: Record<string, unknown>) => {
    const ex = document.querySelector('[data-id="' + cle + '"]')
    if (!ex) throw new Error('Pas d’essai ' + cle)
    ex.dispatchEvent(new CustomEvent('fiche:essai', { bubbles: true, detail: { cle, ...detail } }))
  }

  it('note chaque essai sans dire juste ou faux, et l’envoie une fois à l’appli', async () => {
    expect(avecPretest).not.toBe(GABARIT)
    const { pont, envois, sauvees } = pontSimule(aLEtape('ET2'))
    monter(avecPretest, pont)
    await screen.findByRole('heading', { name: 'Compter avec des lampes' })

    essai('c1', {
      reponse: '8',
      juste: false,
      attendu: '7',
      retour: 'Le plus grand est avant le retour à 0.',
    })
    essai('c1', { reponse: '7', juste: true, attendu: '7', retour: '' })

    expect(envois.filter((e) => e.type === 'pretest.reponse')).toEqual([
      { type: 'pretest.reponse', donnees: { question: 'c1', reponse: '8' } },
    ])
    expect(
      screen.getByText(/Noté : « 8 »\. La correction vient à la fin de l’étape\./),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Juste|Attendu/)).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Ta réponse' })).toBeDisabled()
    expect(sauvees.at(-1)?.['traces']).toMatchObject({
      'essai:c1': { reponse: '8', juste: false, attendu: '7' },
    })
  })

  it('« Je ne sais pas » est une réponse : l’attendu se lit dans la fiche quand aucun outil ne répond', async () => {
    const { pont, envois } = pontSimule(aLEtape('ET2'))
    monter(avecPretest, pont)
    await screen.findByRole('heading', { name: 'Compter avec des lampes' })
    essai('c1', { reponse: '7', juste: true, attendu: '7' })
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))

    const passer = screen
      .getAllByRole('button', { name: 'Je ne sais pas' })
      .find((b) => b.closest('[data-id="c2"]'))
    if (!passer) throw new Error('Pas de « Je ne sais pas » sur c2')
    fireEvent.click(passer)

    expect(envois).toContainEqual({
      type: 'pretest.reponse',
      donnees: { question: 'c2', reponse: 'Je ne sais pas' },
    })
    const bilan = screen.getByRole('heading', { name: 'Tes essais' }).parentElement
    if (!(bilan instanceof HTMLElement)) throw new Error('Pas de bilan des essais')
    expect(within(bilan).getByText('Ta réponse : 7. Juste.')).toBeInTheDocument()
    // Sans réponse, la solution ne se donne pas à garder : l'étape suivante l'explique.
    expect(
      within(bilan).getByText('Tu ne savais pas : l’étape suivante te l’apprend.'),
    ).toBeInTheDocument()
    expect(within(bilan).queryByText(/Il double|Compare 8 et 16/)).toBeNull()
  })

  it('garde « Étape suivante » inactif tant qu’un essai attend sa réponse', async () => {
    const { pont, envois } = pontSimule(aLEtape('ET2'))
    monter(avecPretest, pont)
    await screen.findByRole('heading', { name: 'Compter avec des lampes' })
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
    const suivante = screen.getByRole('button', { name: 'Étape suivante' })

    expect(suivante).toBeDisabled()
    expect(
      screen.getByText(/Réponds à chaque essai avant de passer à la suite/),
    ).toBeInTheDocument()
    essai('c1', { reponse: '7', juste: true, attendu: '7' })
    essai('c2', { reponse: 'Il double.', juste: true, attendu: 'Il double' })
    expect(suivante).toBeEnabled()
    fireEvent.click(suivante)
    expect(envois).toContainEqual({ type: 'etape.vue', donnees: { etape: 'ET3' } })
  })

  it('rendue plus tard, la série finie garde ses réponses figées et sa correction', async () => {
    const traces = {
      'essai:c1': { reponse: '8', juste: false, attendu: '7', retour: '', le: '2026-10-20' },
      'essai:c2': {
        reponse: null,
        juste: false,
        attendu: 'Il double',
        retour: '',
        le: '2026-10-20',
      },
    }
    const { pont, envois } = pontSimule({ ...aLEtape('ET2'), ecrans: { ET2: 1 }, traces })
    monter(avecPretest, pont)
    await screen.findByRole('heading', { name: 'Tes essais' })

    expect(screen.getByText('Ta réponse : 8.')).toBeInTheDocument()
    expect(screen.getByText('Attendu : 7.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Je ne sais pas' })).toBeNull()
    expect(envois.filter((e) => e.type === 'pretest.reponse')).toEqual([])
  })

  it('l’explication qui suit part des réponses de l’apprenant', async () => {
    const avecExplication = avecPretest
      .replace(
        '"id": "ET3",\n            "titre": "Pratique"',
        '"id": "ET5",\n            "titre": "Pourquoi",\n            "type": "explication"\n          },\n          {\n            "id": "ET3",\n            "titre": "Pratique"',
      )
      .replace(
        '<template data-etape="ET0">',
        '<template data-etape="ET5"><p data-si-essai="c1:faux">Tu as répondu <span data-essai-rappel="c1">autre chose</span> : c’est le nombre de valeurs, pas le plus grand.</p><p data-si-essai="c1:juste">Tu avais trouvé 7.</p><p data-si-essai="c2:passe|absent">Une lampe de plus double le nombre de valeurs.</p></template><template data-etape="ET0">',
      )
    expect(avecExplication).toContain('data-etape="ET5"')
    const traces = {
      'essai:c1': { reponse: '8', juste: false, attendu: '7', retour: '', le: '2026-10-20' },
      'essai:c2': { reponse: null, juste: false, attendu: '', retour: '', le: '2026-10-20' },
    }
    const { pont } = pontSimule({ ...aLEtape('ET5'), traces })
    monter(avecExplication, pont)
    await screen.findByRole('heading', { name: 'Pourquoi' })

    const rappel = document.querySelector('[data-si-essai="c1:faux"]')
    expect(rappel).toBeVisible()
    expect(rappel?.textContent).toBe(
      'Tu as répondu « 8 » : c’est le nombre de valeurs, pas le plus grand.',
    )
    expect(screen.getByText('Tu avais trouvé 7.')).not.toBeVisible()
    expect(screen.getByText('Une lampe de plus double le nombre de valeurs.')).toBeVisible()
  })
})

describe('la pratique', () => {
  /** Le gabarit, avec un premier item dont un outil contrôle la réponse. */
  const avecOutil = GABARIT.replace(
    '<template data-item="PR1-1"><p data-erreur="E1">À REMPLACER : item PR1-1 (E1).</p></template>',
    '<template data-item="PR1-1"><div data-verifie>Outil de la fiche</div></template>',
  )
  const auPratique = (suite: Record<string, unknown> = {}) => ({
    etape: 'ET3',
    envoyees: {},
    pratique: {},
    retourCours: false,
    ...suite,
  })
  const verifier = (detail: Record<string, unknown>) => {
    const outil = screen.getByText('Outil de la fiche')
    outil.dispatchEvent(new CustomEvent('fiche:verification', { bubbles: true, detail }))
    return outil
  }

  it('un item que la fiche vérifie ne demande pas « J’ai réussi » : l’outil dit juste ou faux', async () => {
    expect(avecOutil).not.toBe(GABARIT)
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    const outil = await screen.findByText('Outil de la fiche')

    expect(screen.queryByRole('button', { name: 'J’ai réussi' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pas réussi' })).toBeNull()
    verifier({ juste: false })
    expect(envois.at(-1)).toEqual({
      type: 'pratique.resultat',
      donnees: { exercice: 'PR1', item: 'PR1-1', reussi: false, aide: 0, essais: 1 },
    })
    expect(screen.getByText('À refaire')).toBeInTheDocument()
    verifier({ juste: true })
    expect(envois.at(-1)).toEqual({
      type: 'pratique.resultat',
      donnees: { exercice: 'PR1', item: 'PR1-1', reussi: true, aide: 0, essais: 2 },
    })
    // L'item n'est pas redessiné : l'outil et son message restent à l'écran.
    expect(screen.getByText('Outil de la fiche')).toBe(outil)
    expect(screen.getByText('Réussi')).toBeInTheDocument()
    expect(screen.getByText('1 réussi sur 3.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Item 1 sur 3, réussi' })).toBeInTheDocument()
  })

  it('note l’aide la plus forte : celle que l’apprenant déclare ou celle que l’outil a donnée', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')

    fireEvent.click(screen.getByRole('button', { name: 'Aide 2' }))
    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 2 })
    verifier({ juste: true, aide: 3 })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 3 })
    // Ce qui n'est pas un résultat ne part pas.
    const avant = envois.length
    verifier({})
    verifier({ juste: 'oui' })
    expect(envois).toHaveLength(avant)
  })

  it('une aide reçue garde son jour : refait sans aide ce jour-là, l’item part avec elle', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')

    verifier({ juste: true, aide: 2 })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 2 })
    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 2 })
    expect(
      screen.getByText(/Tu as eu de l’aide aujourd’hui : refais-le un autre jour/),
    ).toBeInTheDocument()
  })

  it('une aide d’un autre jour ne retient plus rien', async () => {
    const hier = { reussi: false, aide: 3, essais: 1, solutionVue: false }
    const { pont, envois } = pontSimule(
      auPratique({ pratique: { 'PR1-1': { ...hier, aideLe: '2020-01-01', aideMax: 3 } } }),
    )
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')

    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 0 })
  })

  it('une solution montrée à l’instant (garder) se note tout de suite, et l’item se redessine sur fiche:refaire', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    const outil = await screen.findByText('Outil de la fiche')

    verifier({ juste: false, aide: 4, garder: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: false, aide: 4 })
    expect(screen.getByText('Outil de la fiche')).toBe(outil)
    outil.dispatchEvent(new CustomEvent('fiche:refaire', { bubbles: true }))
    const neuf = await screen.findByText('Outil de la fiche')
    expect(neuf).not.toBe(outil)
    expect(neuf.closest('[data-solution-vue]')).not.toBeNull()
  })

  it('après la solution montrée (aide 4), l’item n’est pas réussi : il se refait à neuf, puis compte avec l’aide 4', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    const outil = await screen.findByText('Outil de la fiche')
    let rendus = 0
    const compter = () => {
      rendus += 1
    }
    document.addEventListener('fiche:rendu', compter)

    // Une réponse juste, mais l'outil avait montré la solution : rien n'est réussi.
    verifier({ juste: true, aide: 4 })
    expect(envois.at(-1)).toEqual({
      type: 'pratique.resultat',
      donnees: { exercice: 'PR1', item: 'PR1-1', reussi: false, aide: 4, essais: 1 },
    })
    expect(screen.queryByText('Réussi')).toBeNull()
    expect(screen.getByText('Solution vue')).toBeInTheDocument()
    expect(
      screen.getByText('Tu as vu la solution. Refais-la sans la regarder.'),
    ).toBeInTheDocument()
    // L'item est redessiné à neuf : l'outil se remonte sur fiche:rendu, l'aide repart de zéro.
    expect(screen.getByText('Outil de la fiche')).not.toBe(outil)
    expect(rendus).toBe(1)
    expect(screen.getByRole('button', { name: 'Aide 4' })).toHaveAttribute('aria-pressed', 'false')
    // Refaite sans la regarder : l'item est réussi, et le pont le sait avec l'aide 4.
    verifier({ juste: true })
    expect(envois.at(-1)).toEqual({
      type: 'pratique.resultat',
      donnees: { exercice: 'PR1', item: 'PR1-1', reussi: true, aide: 4, essais: 2 },
    })
    expect(screen.getByText('Réussi avec de l’aide')).toBeInTheDocument()
    expect(screen.getByText('0 réussi sur 3, et 1 avec de l’aide.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Envoyé : réussi, aide 4. Tu as vu la solution aujourd’hui : refais-le un autre jour, sans aide, pour qu’il compte.',
      ),
    ).toBeInTheDocument()
    expect(rendus).toBe(1)
    document.removeEventListener('fiche:rendu', compter)
  })

  // Une solution vue un jour passé, et une marque d'avant, sans jour.
  it.each(['2020-01-01', true])(
    'un autre jour (%s), l’item dont la solution a été vue repart sans aide, sur sa variante',
    async (solutionVue) => {
      const { pont, envois } = pontSimule(
        auPratique({
          itemCourant: 0,
          pratique: { 'PR1-1': { reussi: true, aide: 4, essais: 2, solutionVue } },
        }),
      )
      monter(avecOutil, pont)
      const boite = (await screen.findByText('Outil de la fiche')).closest('.item')

      expect(boite).toHaveAttribute('data-solution-vue')
      expect(
        screen.getByText('Envoyé : réussi, aide 4. Refais-le sans aide pour qu’il compte.'),
      ).toBeInTheDocument()
      verifier({ juste: true })
      expect(envois.at(-1)).toEqual({
        type: 'pratique.resultat',
        donnees: { exercice: 'PR1', item: 'PR1-1', reussi: true, aide: 0, essais: 3 },
      })
      expect(screen.getByText('Envoyé : réussi, aide 0')).toBeInTheDocument()
    },
  )

  it('après la solution montrée, la boîte de l’item le dit à l’outil, qui propose une variante', async () => {
    const { pont } = pontSimule(auPratique())
    monter(avecOutil, pont)
    const boite = (await screen.findByText('Outil de la fiche')).closest('.item')

    expect(boite).not.toHaveAttribute('data-solution-vue')
    verifier({ juste: true, aide: 4 })
    // L'item redessiné porte la marque, et la garde quand il est refait.
    const redessinee = screen.getByText('Outil de la fiche').closest('.item')
    expect(redessinee).toHaveAttribute('data-solution-vue')
    verifier({ juste: true })
    expect(screen.getByText('Outil de la fiche').closest('.item')).toHaveAttribute(
      'data-solution-vue',
    )
  })

  it('garde « Étape suivante » inactif tant que chaque item n’est pas réussi, aide permise', async () => {
    const { pont } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')

    const suite = () => screen.getByRole('button', { name: 'Étape suivante' })
    expect(suite()).toBeDisabled()
    expect(
      screen.getByText('Réussis les 3 items avant de passer à la suite : 0 sur 3 pour l’instant.'),
    ).toBeInTheDocument()
    verifier({ juste: true, aide: 2 })
    expect(suite()).toBeDisabled()
    expect(screen.getByText(/: 1 sur 3 pour l’instant\./)).toBeInTheDocument()
  })

  it('rend « Étape suivante » actif une fois chaque item réussi, même avec de l’aide', async () => {
    const suite = () => screen.getByRole('button', { name: 'Étape suivante' })
    const reussi = { reussi: true, aide: 0, essais: 1 }
    const { pont: finie } = pontSimule(
      auPratique({
        pratique: { 'PR1-1': reussi, 'PR1-2': { ...reussi, aide: 3 }, 'PR1-3': reussi },
      }),
    )
    monter(avecOutil, finie)
    await screen.findByText('Outil de la fiche')
    expect(suite()).toBeEnabled()
  })

  it('rappelle l’objectif, replié, à l’entrée de la pratique', async () => {
    const { pont } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')
    const details = screen.getByText('Ce qui sera vérifié').closest('details')
    if (!(details instanceof HTMLDetailsElement)) throw new Error('Pas de détails repliables')

    expect(details.open).toBe(false)
    expect(within(details).getByText(OBJECTIF)).toBeInTheDocument()
  })

  it('un objectif qui aligne plusieurs attendus, séparés par « ; », se lit en puces', async () => {
    const enPuces = avecOutil.replace(
      OBJECTIF,
      'Faire cinq conversions à la main ; expliquer pourquoi 255 et pas 256 ; lire un octet de trois façons. Aisance : dix conversions en 30 s.',
    )
    expect(enPuces).not.toBe(avecOutil)
    const { pont } = pontSimule(auPratique())
    monter(enPuces, pont)
    await screen.findByText('Outil de la fiche')
    const details = screen.getByText('Ce qui sera vérifié').closest('details')
    if (!(details instanceof HTMLDetailsElement)) throw new Error('Pas de détails repliables')

    expect(
      within(details)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Faire cinq conversions à la main',
      'Expliquer pourquoi 255 et pas 256',
      'Lire un octet de trois façons. Aisance : dix conversions en 30 s.',
    ])
  })

  it('un item sans outil qui vérifie garde « J’ai réussi » et « Pas réussi »', async () => {
    const { pont, envois } = pontSimule(auPratique({ itemCourant: 1 }))
    monter(avecOutil, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'J’ai réussi' }))

    expect(envois).toContainEqual({
      type: 'pratique.resultat',
      donnees: { exercice: 'PR1', item: 'PR1-2', reussi: true, aide: 0, essais: 1 },
    })
  })
})

describe('la carte du bloc', () => {
  /** Le gabarit, avec la carte écrite par la fiche (où tu es, à quoi ça sert, ce que tu sauras faire). */
  const avecCarte = GABARIT.replace(
    '<template data-etape="ET2">',
    '<template data-etape="ET1"><p>Où tu es : le premier bloc du module.</p></template><template data-etape="ET2">',
  )
  /** Vrai quand `avant` précède `apres` dans la page. */
  const precede = (avant: Element, apres: Element) =>
    Boolean(avant.compareDocumentPosition(apres) & Node.DOCUMENT_POSITION_FOLLOWING)

  it('avec un template ET1 : la carte de la fiche, puis l’objectif replié, puis Commencer', async () => {
    expect(avecCarte).not.toBe(GABARIT)
    const { pont } = pontSimule(aLEtape('ET1'))
    monter(avecCarte, pont)
    const commencer = await screen.findByRole('button', { name: 'Commencer' })
    const carte = screen.getByText('Où tu es : le premier bloc du module.')
    const details = screen.getByText('Ce qui sera vérifié').closest('details')
    if (!(details instanceof HTMLDetailsElement)) throw new Error('Pas de détails repliables')

    expect(screen.getByRole('heading', { name: 'Carte du bloc' })).toBeInTheDocument()
    expect(details.open).toBe(false)
    expect(within(details).getByText(OBJECTIF)).toBeInTheDocument()
    expect(precede(carte, details)).toBe(true)
    expect(precede(details, commencer)).toBe(true)
  })

  it('après une perception : la carte lit son propre template, et mène à l’étape d’après', async () => {
    // Une perception (ET1) ouvre la fiche, la carte vient en second (ET2).
    const apresPerception = GABARIT.replace(
      '"id": "ET1",\n            "titre": "Carte du bloc",\n            "type": "carte"',
      '"id": "ET1",\n            "titre": "Une photo, de près",\n            "type": "perception"\n          },\n          {\n            "id": "ET1b",\n            "titre": "Où tu es",\n            "type": "carte"',
    ).replace(
      '<template data-etape="ET2">',
      '<template data-etape="ET1"><p>Regarde la photo.</p></template><template data-etape="ET1b"><p>Où tu es : ce bloc ouvre la partie.</p></template><template data-etape="ET2">',
    )
    expect(apresPerception).not.toBe(GABARIT)
    const { pont, envois } = pontSimule(aLEtape('ET1b'))
    monter(apresPerception, pont)
    const suivante = await screen.findByRole('button', { name: 'Étape suivante' })

    expect(screen.getByRole('heading', { name: 'Où tu es' })).toBeInTheDocument()
    expect(screen.getByText('Où tu es : ce bloc ouvre la partie.')).toBeInTheDocument()
    expect(screen.queryByText('Regarde la photo.')).toBeNull()
    expect(screen.getByText('Ce qui sera vérifié')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Commencer' })).toBeNull()
    fireEvent.click(suivante)
    expect(envois).toContainEqual({ type: 'etape.vue', donnees: { etape: 'ET2' } })
  })

  it('sans template ET1 : l’objectif, puis la liste des étapes (les fiches d’avant)', async () => {
    const { pont } = pontSimule(aLEtape('ET1'))
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Commencer' })

    expect(screen.getByText(OBJECTIF).tagName).toBe('P')
    expect(screen.queryByText('Ce qui sera vérifié')).toBeNull()
    expect(screen.getByText('Restitution', { selector: 'section li' })).toBeInTheDocument()
  })

  it('se lit à voix haute : « Écouter » est là, et dit quand la lecture est indisponible', async () => {
    const { pont } = pontSimule(aLEtape('ET1'))
    monter(avecCarte, pont)
    const ecouter = await screen.findByRole('button', { name: 'Écouter' })

    // jsdom n'a pas de synthèse vocale.
    fireEvent.click(ecouter)
    expect(ecouter).toHaveTextContent('Lecture indisponible')
  })
})

describe('une étape à lire', () => {
  const EXPLICATION = "À REMPLACER : l'explication du bloc."

  it('a « Écouter » même quand elle tient en un écran', async () => {
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(GABARIT, pont)
    await screen.findByText(EXPLICATION)

    expect(screen.getByRole('button', { name: 'Écouter' })).toBeInTheDocument()
  })

  it.each([
    ['perception', 'Découvrir'],
    ['pretest', 'Comprendre'],
    ['ensemble', 'S’entraîner'],
  ])('de type %s se dessine comme une explication, dans le moment « %s »', async (type, moment) => {
    const fiche = GABARIT.replace(
      /"titre": "Explication",\s*"type": "explication"/,
      `"titre": "Explication", "type": "${type}"`,
    )
    expect(fiche).not.toBe(GABARIT)
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(fiche, pont)
    await screen.findByText(EXPLICATION)

    expect(screen.getByRole('heading', { name: 'Explication' })).toBeInTheDocument()
    expect(document.getElementById('bascule')).toHaveTextContent(`${moment} · Explication`)
  })
})

describe('« Écouter » lit ce qui est visible, et rien d’autre', () => {
  type Lecture = { texteLu: (ecran: Element, nonLus?: Element[]) => string }
  const lecture = () => (window as unknown as { JanusLecture: Lecture }).JanusLecture
  const ecranDe = (html: string) => {
    const ecran = document.createElement('div')
    ecran.innerHTML = html
    return ecran
  }

  it('lit les énoncés, les encadrés et les options, dans l’ordre', async () => {
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Écouter' })
    const ecran = ecranDe(`
      <p class="accroche">Un octet, huit bits.</p>
      <div class="cadre a-retenir"><p>À retenir : 256 valeurs.</p></div>
      <div class="ex" data-widget="choix" data-reponse="a">
        <p class="q">Combien de valeurs ?</p>
        <ul class="options"><li data-option="a"><button type="button">256</button></li><li data-option="b"><button type="button">255</button></li></ul>
        <div class="saisie"><input type="text" aria-label="Ta réponse"><button type="button" class="bouton">Vérifier</button></div>
        <p class="retour">Juste.</p>
      </div>
      <p>Ce texte vient après.</p>`)
    expect(lecture().texteLu(ecran)).toBe(
      'Un octet, huit bits. À retenir : 256 valeurs. Combien de valeurs ? 256. 255. Ce texte vient après.',
    )
  })

  it('saute ce qui n’est pas encore dévoilé, et lit un dessin par sa description', async () => {
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Écouter' })
    const ecran = ecranDe(`
      <p>Avant.</p>
      <div class="lampes" role="img" aria-label="Lampes de gauche à droite : 01001100">0 1 0 0 1 1 0 0</div>
      <p data-attente>D’où #ff8800, la réponse.</p>
      <p hidden>Caché.</p>
      <div class="outil" data-lecture="Les seize chiffres, de 0 à f."><p class="outil-titre">Table</p><ul><li>0</li><li>1</li></ul></div>`)
    expect(lecture().texteLu(ecran)).toBe(
      'Avant. Lampes de gauche à droite : 01001100. Les seize chiffres, de 0 à f.',
    )
  })

  it('signale une table sans phrase de lecture, et un dessin sans description', async () => {
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Écouter' })
    const ecran = ecranDe(`
      <table><caption>Les poids</caption><tr><td>128</td><td>64</td></tr></table>
      <div role="img">un dessin muet</div>
      <div class="outil"><p class="outil-titre">Un extrait</p></div>`)
    const nonLus: Element[] = []
    expect(lecture().texteLu(ecran, nonLus)).toBe('Les poids. Un extrait.')
    expect(nonLus.map((n) => n.tagName)).toEqual(['TABLE', 'DIV'])
  })

  it('est sur un item de pratique, sur une question et sur le bilan', async () => {
    const { pont } = pontSimule(aLEtape('ET3'))
    monter(GABARIT, pont)
    await screen.findByRole('heading', { name: 'Pratique guidée' })
    expect(screen.getByRole('button', { name: 'Écouter' })).toBeInTheDocument()

    const { pont: aLaRestitution } = pontSimule(aLEtape('ET4'))
    monter(GABARIT, aLaRestitution)
    await screen.findByRole('button', { name: 'Commencer' })
    fireEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect((await screen.findAllByRole('button', { name: 'Écouter' })).length).toBeGreaterThan(0)

    const { pont: auBilan } = pontSimule({ ...aLEtape('ET6'), envoyees: {}, pratique: {} })
    monter(GABARIT, auBilan)
    await screen.findByRole('heading', { name: 'Bilan' })
    expect(screen.getByRole('button', { name: 'Écouter' })).toBeInTheDocument()
  })
})

describe('ce qui est visible se lit : les fiches du dépôt', () => {
  type Lecture = { texteLu: (ecran: Element, nonLus?: Element[]) => string }
  const dossier = join(process.cwd(), '../../contenu/dwwm/fiches')
  const fiches = readdirSync(dossier).filter((nom) => nom.endsWith('.html'))
  /** Un élément, nommé pour le message : balise, classe, et le début de son texte. */
  const nommer = (n: Element) => {
    const classe = n.classList.item(0)
    const texte = n.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)
    return n.tagName.toLowerCase() + (classe === null ? '' : '.' + classe) + ' « ' + texte + ' »'
  }

  it.each(fiches)('%s : chaque écran, item et variante se lit en entier', async (nom) => {
    const { pont } = pontSimule(aLEtape('ET1'))
    monter(GABARIT, pont)
    await screen.findByRole('button', { name: 'Commencer' })
    const { texteLu } = (window as unknown as { JanusLecture: Lecture }).JanusLecture
    const page = new DOMParser().parseFromString(
      readFileSync(join(dossier, nom), 'utf8'),
      'text/html',
    )
    const manques: string[] = []
    for (const modele of page.querySelectorAll<HTMLTemplateElement>(
      'template[data-etape], template[data-item], template[data-variante]',
    )) {
      const contenu = modele.content
      const ecrans = Array.from(contenu.children).filter((n) => n.hasAttribute('data-ecran'))
      const ou = modele.dataset.etape ?? modele.dataset.item ?? modele.dataset.variante ?? ''
      for (const ecran of ecrans.length > 0 ? ecrans : [contenu]) {
        const conteneur = document.createElement('div')
        conteneur.append(ecran.cloneNode(true))
        const nonLus: Element[] = []
        texteLu(
          ecran instanceof Element && ecran.hasAttribute('data-lecture') ? ecran : conteneur,
          nonLus,
        )
        const titre = ecran instanceof Element ? (ecran.getAttribute('data-ecran') ?? '') : ''
        for (const n of nonLus)
          manques.push(ou + (titre ? ' « ' + titre + ' »' : '') + ' : ' + nommer(n))
      }
    }
    expect(manques).toEqual([])
  })
})

describe('le fil d’étapes', () => {
  it('nomme le moment de l’étape courante et groupe les étapes par moment', async () => {
    const { pont } = pontSimule(aLEtape('ET3'))
    monter(GABARIT, pont)
    await screen.findByRole('heading', { name: 'Pratique guidée' })
    const bascule = document.getElementById('bascule')
    const moments = Array.from(document.querySelectorAll<HTMLElement>('#etapes > li.moment'))
    const [, , entrainer, prouver] = moments
    if (entrainer === undefined || prouver === undefined) throw new Error('Quatre moments attendus')

    expect(bascule).toHaveTextContent('S’entraîner · Pratique')
    expect(bascule).not.toHaveTextContent('étape 3 sur')
    expect(moments.map((m) => m.querySelector('.moment-nom')?.textContent)).toEqual([
      'Découvrir',
      'Comprendre',
      'S’entraîner',
      'Prouver',
    ])
    expect(moments.map((m) => m.getAttribute('data-courant'))).toEqual(['non', 'non', 'oui', 'non'])
    expect(
      within(entrainer)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Pratique'])
    expect(
      within(prouver)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Restitution', 'Bilan'])
    expect(within(entrainer).getByRole('button', { name: 'Pratique' })).toHaveAttribute(
      'aria-current',
      'step',
    )
  })
})

describe('une erreur critique repérée par un outil', () => {
  const restitution = Object.fromEntries(
    ['R1', 'R2', 'R3', 'R4', 'R5'].map((id) => [id, { reponse: 'Réponse.', confiance: 'sur' }]),
  )
  /** L'outil émet fiche:erreur ; rend vrai si le gabarit a annulé l'événement. */
  const reperer = (detail: Record<string, unknown>) =>
    !document
      .getElementById('contenu')
      ?.dispatchEvent(new CustomEvent('fiche:erreur', { bubbles: true, cancelable: true, detail }))
  /** Le gabarit, avec une étape d'aisance (ET7) après la pratique. */
  const avecAisance = GABARIT.replace(
    '"id": "ET3",\n            "titre": "Pratique",\n            "type": "pratique"\n          },',
    '"id": "ET3",\n            "titre": "Pratique",\n            "type": "pratique"\n          },\n          { "id": "ET7", "titre": "Aisance", "type": "aisance" },',
  ).replace(
    '<template data-etape="ET2">',
    '<template data-etape="ET7"><p>Outil d’aisance</p></template>\n    <template data-etape="ET2">',
  )

  it('se garde pour le bilan suivant, qui la coche d’office', async () => {
    const { pont, sauvees } = pontSimule(aLEtape('ET3'))
    monter(GABARIT, pont)
    await screen.findByText('0 réussi sur 3.')

    expect(reperer({ erreur: 'E2', ou: 'PR1-1' })).toBe(false)
    expect(sauvees.at(-1)).toMatchObject({ aCocher: ['E2'], erreurs: { 'outil:PR1-1': ['E2'] } })
    // Une erreur que le bloc ne liste pas, ou sans endroit, ne compte pas.
    const avant = sauvees.length
    reperer({ erreur: 'E9', ou: 'PR1-1' })
    reperer({ erreur: 'E1' })
    expect(sauvees).toHaveLength(avant)

    document.body.replaceChildren()
    const gardee = sauvees.at(-1) ?? {}
    const { pont: auBilanEnsuite } = pontSimule(
      auBilan({ aCocher: gardee['aCocher'], erreurs: gardee['erreurs'] }),
    )
    monter(GABARIT, auBilanEnsuite)
    await screen.findByRole('button', { name: 'Envoyer le bilan' })
    const [, deuxieme] = screen.getAllByRole('checkbox')
    expect(deuxieme).toBeChecked()
    expect(deuxieme).toBeDisabled()
    expect(screen.getByText(/Repérée dans tes réponses/)).toBeInTheDocument()
  })

  it('la restitution faite, elle arrête l’aisance jusqu’au bilan', async () => {
    expect(avecAisance).not.toBe(GABARIT)
    const { pont } = pontSimule({ ...aLEtape('ET7'), envoyees: restitution, aCocher: ['E1'] })
    monter(avecAisance, pont)

    expect(
      await screen.findByText(/L’aisance reprend une fois ton bilan envoyé/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Outil d’aisance')).toBeNull()

    document.body.replaceChildren()
    const { pont: sansErreur } = pontSimule({ ...aLEtape('ET7'), envoyees: restitution })
    monter(avecAisance, sansErreur)
    expect(await screen.findByText('Outil d’aisance')).toBeInTheDocument()
  })
})

describe('l’échelle d’aide, la même pour toutes les fiches', () => {
  type Echelle = { zone: HTMLElement; tentative: () => void; cran: () => number; maj: () => void }
  /** L'échelle du gabarit, posée sur un exercice de la page. */
  const echelleDe = (
    ex: HTMLElement,
    options: { crans?: unknown[]; fini?: () => boolean; surSolution?: () => void },
  ): Echelle => {
    const gabarit: unknown = Reflect.get(window, 'JanusGabarit')
    const fabrique: unknown =
      typeof gabarit === 'object' && gabarit !== null ? Reflect.get(gabarit, 'echelle') : undefined
    if (typeof fabrique !== 'function') throw new Error('Le gabarit n’expose pas son échelle')
    const echelle: unknown = Reflect.apply(fabrique, undefined, [ex, options])
    if (!estEchelle(echelle)) throw new Error('L’échelle du gabarit n’a pas la forme attendue')
    ex.append(echelle.zone)
    return echelle
  }
  const estEchelle = (valeur: unknown): valeur is Echelle =>
    typeof valeur === 'object' &&
    valeur !== null &&
    Reflect.get(valeur, 'zone') instanceof HTMLElement &&
    ['tentative', 'cran', 'maj'].every((nom) => typeof Reflect.get(valeur, nom) === 'function')
  const pose = async () => {
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(GABARIT, pont)
    await screen.findByRole('heading', { name: 'Explication' })
    const ex = document.createElement('div')
    document.body.append(ex)
    return ex
  }

  it('n’ouvre rien avant une réponse fausse, puis un cran à la fois, la solution en dernier', async () => {
    const ex = await pose()
    Object.assign(ex.dataset, {
      aide1: 'Que compte-t-on ?',
      aide2: 'Le 0 compte.',
      aide3: 'Compte de 0 à 7.',
    })
    let solution = 0
    const echelle = echelleDe(ex, { crans: ['Calculé'], surSolution: () => (solution += 1) })

    expect(echelle.zone).not.toBeVisible()
    echelle.tentative()
    const bouton = within(echelle.zone).getByRole('button', { name: 'Un coup de pouce' })
    fireEvent.click(bouton)
    expect(within(echelle.zone).getByText('Que compte-t-on ?')).toBeInTheDocument()
    expect(within(echelle.zone).queryByText('Calculé')).toBeNull()
    // Pas de cran suivant sans une autre réponse fausse (règle F04).
    expect(
      within(echelle.zone).getByRole('button', { name: 'Un autre coup de pouce' }),
    ).toBeDisabled()
    echelle.tentative()
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Un autre coup de pouce' }))
    echelle.tentative()
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Un autre coup de pouce' }))
    expect(echelle.cran()).toBe(3)
    echelle.tentative()
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Voir la solution' }))
    expect(solution).toBe(1)
    expect(echelle.cran()).toBe(4)
  })

  it('prend les crans de l’outil quand la fiche n’en écrit pas, et rend un cran calculé à l’ouverture', async () => {
    const ex = await pose()
    let appels = 0
    const echelle = echelleDe(ex, {
      crans: [
        () => {
          appels += 1
          return 'Il reste 22.'
        },
      ],
    })
    echelle.tentative()
    expect(appels).toBe(0)
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Un coup de pouce' }))
    expect(within(echelle.zone).getByText('Il reste 22.')).toBeInTheDocument()
  })

  it('sans cran, la solution attend deux réponses fausses ; l’exercice fini, le bouton s’en va', async () => {
    const ex = await pose()
    let fini = false
    const echelle = echelleDe(ex, { fini: () => fini })
    echelle.tentative()
    const bouton = within(echelle.zone).getByRole('button', { name: 'Voir la solution' })
    expect(bouton).toBeDisabled()
    echelle.tentative()
    expect(bouton).toBeEnabled()
    fini = true
    echelle.maj()
    expect(echelle.zone).not.toBeVisible()
  })
})
