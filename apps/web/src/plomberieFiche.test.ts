// @vitest-environment-options {"runScripts": "dangerously"}
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { texteDeLaTable } from '@janus/contrats'

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
  /** Pour chaque état sauvé, s'il part aussitôt (`immediat`) ou peut se regrouper. */
  const immediats: boolean[] = []
  type RappelEtape = (etape: string, options: { readonly retourCours: boolean }) => void
  const etapes = new Set<RappelEtape>()
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
    sauver: (etat: Record<string, unknown>, options: { immediat?: boolean } = {}) => {
      sauvees.push(structuredClone(etat))
      immediats.push(options.immediat === true)
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
    surEtape: (rappel: RappelEtape) => {
      etapes.add(rappel)
      return () => etapes.delete(rappel)
    },
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
  /** L'appli demande une étape (`etape.aller`), depuis « Revoir le cours » ou non. */
  const direEtape = (etape: string, retourCours = false) => {
    for (const rappel of etapes) rappel(etape, { retourCours })
  }
  return {
    pont,
    envois,
    demandes,
    sauvees,
    immediats,
    direStatut,
    direInit,
    direEtape,
    refuserDernier,
    rejeter,
  }
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
      screen.getByText(
        /seule une réponse solide, écrite sans aide, à une question qui la touche la referme/,
      ),
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

  it('la série finie et fermée par l’appli, le complément reste permis', async () => {
    const partielle = { ...correction, niveau: 'partiel', message: 'Il manque la raison.' }
    const { pont, direInit } = pontSimule(aLEtape('ET4'), partielle)
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout('Ma première réponse.')
    // Le serveur ferme la série dès la dernière réponse : la page reçoit un etat.init fermé.
    direInit({ serie_ouverte: { restitution: false } })

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Compléter ma réponse' }).length,
      ).toBeGreaterThan(0)
    })
  })

  it('une réponse part aussitôt à l’appli, sans attendre le regroupement des sauvegardes', async () => {
    const { pont, sauvees, immediats } = pontSimule(aLEtape('ET4'), correction)
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondreATout()
    const derniere = sauvees.length - 1
    expect(sauvees[derniere]).toMatchObject({ envoyees: { R5: {} } })
    expect(immediats[derniere]).toBe(true)
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

describe('une table de vérité à remplir', () => {
  const GRILLE = { type: 'table', entrees: ['A', 'B'], colonnes: ['NON B', 'A OU NON B'] } as const
  /** Le gabarit dont la question R1 fait remplir la table de A OU NON B. */
  const avecTable = GABARIT.replace(
    '"question": "À REMPLACER : question R1.",',
    `"question": "Sans le cours, remplis la table de vérité de A OU NON B.", "saisie": ${JSON.stringify(GRILLE)},`,
  )
  /** La réponse juste : NON B, puis A OU NON B, pour chaque cas. */
  const JUSTE = [
    [true, true],
    [false, false],
    [true, true],
    [false, true],
  ]
  const correction = {
    id: '0199f5a0-0000-7000-8000-000000000003',
    echantillon: false,
    question: 'R1',
    tour: 1,
    message: 'Il manque une ligne.',
    niveau: 'partiel',
    erreurs_critiques: [],
    source: 'deduit',
    ref: 'R1',
    certitude: 'sur',
    compte: true,
  }

  /** Choisit VRAI ou FAUX dans chaque case de la table, ligne par ligne. */
  function remplir(table: HTMLElement, valeurs: readonly (readonly boolean[])[]) {
    const groupes = within(table).getAllByRole('radiogroup')
    groupes.forEach((groupe, rang) => {
      const valeur = valeurs[Math.floor(rang / 2)]?.[rang % 2]
      if (valeur === undefined) return
      fireEvent.click(within(groupe).getByRole('radio', { name: valeur ? 'VRAI' : 'FAUX' }))
    })
  }

  it('montre les cas rangés comme on compte en binaire, et une case VRAI ou FAUX par colonne demandée', async () => {
    const { pont } = pontSimule(aLEtape('ET4'), correction)
    monter(avecTable, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    const table = await screen.findByRole('table', {
      name: 'Sans le cours, remplis la table de vérité de A OU NON B.',
    })

    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['A', 'B', 'NON B', 'A OU NON B'])
    const lignes = within(table).getAllByRole('row').slice(1)
    expect(
      lignes.map((ligne) =>
        Array.from(ligne.querySelectorAll('td.entree'), (td) => td.textContent).join(' '),
      ),
    ).toEqual(['FAUX FAUX', 'FAUX VRAI', 'VRAI FAUX', 'VRAI VRAI'])
    const groupes = within(table).getAllByRole('radiogroup')
    expect(groupes.map((groupe) => groupe.getAttribute('aria-label'))).toEqual([
      'A FAUX, B FAUX : NON B',
      'A FAUX, B FAUX : A OU NON B',
      'A FAUX, B VRAI : NON B',
      'A FAUX, B VRAI : A OU NON B',
      'A VRAI, B FAUX : NON B',
      'A VRAI, B FAUX : A OU NON B',
      'A VRAI, B VRAI : NON B',
      'A VRAI, B VRAI : A OU NON B',
    ])
    for (const groupe of groupes)
      expect(
        within(groupe)
          .getAllByRole('radio')
          .map((radio) => radio.closest('label')?.textContent),
      ).toEqual(['VRAI', 'FAUX'])
    // « Écouter » la dit par sa phrase, sans lire chaque case.
    expect(table.dataset['lecture']).toBe(
      'Une table à remplir, une ligne par cas, de A FAUX, B FAUX à A VRAI, B VRAI. Pour chaque ligne, choisis VRAI ou FAUX pour NON B, puis pour A OU NON B.',
    )
  })

  it('n’envoie rien tant qu’une case est vide, puis envoie une ligne par cas', async () => {
    const { pont, demandes } = pontSimule(aLEtape('ET4'), correction)
    monter(avecTable, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    const table = await screen.findByRole('table')
    const question = table.closest('.item')
    if (!(question instanceof HTMLElement)) throw new Error('Une table hors de sa carte')
    fireEvent.click(within(question).getByRole('radio', { name: 'Sûr' }))

    const envoyer = within(question).getByRole('button', { name: 'Envoyer' })
    fireEvent.click(envoyer)
    expect(within(question).getByRole('alert')).toHaveTextContent(
      'Choisis VRAI ou FAUX dans chaque case avant d’envoyer : il en reste 8.',
    )
    remplir(table, JUSTE.slice(0, 3))
    fireEvent.click(envoyer)
    expect(within(question).getByRole('alert')).toHaveTextContent('il en reste 2.')
    expect(document.activeElement).toBe(
      within(table).getAllByRole('radiogroup')[6]?.querySelector('input'),
    )
    expect(demandes).toHaveLength(0)

    remplir(table, JUSTE)
    // Ce qui manquait s'efface quand la dernière case est remplie.
    expect(within(question).getByRole('alert')).toBeEmptyDOMElement()
    fireEvent.click(envoyer)
    await waitFor(() => {
      expect(demandes).toHaveLength(1)
    })
    expect(demandes[0]?.['reponse']).toBe(texteDeLaTable(GRILLE, JUSTE))
    expect(demandes[0]?.['reponse']).toBe(
      [
        'A FAUX, B FAUX : NON B VRAI ; A OU NON B VRAI',
        'A FAUX, B VRAI : NON B FAUX ; A OU NON B FAUX',
        'A VRAI, B FAUX : NON B VRAI ; A OU NON B VRAI',
        'A VRAI, B VRAI : NON B FAUX ; A OU NON B VRAI',
      ].join('\n'),
    )
    await waitFor(() => {
      for (const radio of within(table).getAllByRole('radio')) expect(radio).toBeDisabled()
    })
  })

  it('la série finie, la réponse se relit dans la table, rechargement compris, et se complète dans la table', async () => {
    const { pont, demandes, sauvees } = pontSimule(aLEtape('ET4'), correction)
    monter(avecTable, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer' }))
    const table = await screen.findByRole('table')
    const question = table.closest('.item')
    if (!(question instanceof HTMLElement)) throw new Error('Une table hors de sa carte')
    remplir(table, JUSTE)
    fireEvent.click(within(question).getByRole('radio', { name: 'Sûr' }))
    fireEvent.click(within(question).getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
    })
    await repondreATout()

    /** La table lue d'une carte : ses valeurs, ligne par ligne. */
    const valeursLues = (carte: HTMLElement) =>
      Array.from(carte.querySelectorAll('table.table-saisie tbody tr'), (ligne) =>
        Array.from(ligne.querySelectorAll('td.valeur'), (td) => td.textContent),
      )
    const LUES = [
      ['VRAI', 'VRAI'],
      ['FAUX', 'FAUX'],
      ['VRAI', 'VRAI'],
      ['FAUX', 'VRAI'],
    ]
    const carteR1 = () => {
      const carte = screen
        .getByText('Sans le cours, remplis la table de vérité de A OU NON B.')
        .closest('.item')
      if (!(carte instanceof HTMLElement)) throw new Error('Pas de carte pour R1')
      return carte
    }
    expect(valeursLues(carteR1())).toEqual(LUES)
    expect(within(carteR1()).getAllByText('Il manque une ligne.').length).toBeGreaterThan(0)

    // Rechargement : la page repart de l'état sauvé.
    const { pont: pontRecharge } = pontSimule(sauvees.at(-1) ?? {}, correction)
    monter(avecTable, pontRecharge)
    await waitFor(() => {
      expect(valeursLues(carteR1())).toEqual(LUES)
    })
    expect(within(carteR1()).getByText('Il manque une ligne.')).toBeInTheDocument()

    // Le complément se fait dans la table, préremplie de la première réponse.
    fireEvent.click(within(carteR1()).getByRole('button', { name: 'Compléter ma réponse' }))
    const complement = within(carteR1()).getByRole('table', { name: /Complète ta réponse/ })
    const cochees = Array.from(
      complement.querySelectorAll<HTMLInputElement>('input:checked'),
      (radio) => radio.value,
    )
    expect(cochees).toEqual(['vrai', 'vrai', 'faux', 'faux', 'vrai', 'vrai', 'faux', 'vrai'])
    expect(demandes).toHaveLength(5)
  })
})

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
      "c'est l'erreur « À REMPLACER : confusion centrale 1 ». D'après les étapes « Explication » et « Pratique ».",
    )
    expect(attendu).not.toHaveTextContent(/\bE1\b/)
    expect(attendu).not.toHaveTextContent(/étapes? \d/)
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

  it('l’étape montrée à l’ouverture est vue, sauf masquée ; « Revenir au cours » la fait voir', async () => {
    const libre = pontSimule(aLEtape('ET2'))
    monter(GABARIT, libre.pont)
    await screen.findByRole('heading', { name: 'Explication' })
    expect(libre.envois).toContainEqual({ type: 'etape.vue', donnees: { etape: 'ET2' } })

    document.body.replaceChildren()
    const { pont, envois } = pontSimule({ ...aLEtape('ET2'), enCours: { restitution: true } })
    monter(GABARIT, pont)
    fireEvent.click(await screen.findByRole('button', { name: 'Revenir au cours' }))
    await screen.findByRole('heading', { name: 'Explication' })
    expect(envois.filter((envoi) => envoi.type === 'etape.vue')).toEqual([
      { type: 'etape.vue', donnees: { etape: 'ET2' } },
    ])
  })

  it('« Revoir le cours » de l’appli rouvre le cours en un geste, pendant la série', async () => {
    const { pont, envois, sauvees, direEtape } = pontSimule({
      ...aLEtape('ET4'),
      enCours: { restitution: true },
    })
    monter(GABARIT, pont)
    await screen.findByRole('heading', { name: 'Restitution' })
    // Un etape.aller sans retour au cours garde l'étape masquée, et ne la coche pas.
    direEtape('ET2')
    expect(await screen.findByText(masque)).toBeInTheDocument()
    expect(envois).not.toContainEqual({ type: 'etape.vue', donnees: { etape: 'ET2' } })

    direEtape('ET2', true)
    await screen.findByRole('heading', { name: 'Explication' })
    expect(screen.queryByText(masque)).toBeNull()
    expect(sauvees.at(-1)).toMatchObject({ retourCours: true, etape: 'ET2' })
    expect(envois).toContainEqual({ type: 'etape.vue', donnees: { etape: 'ET2' } })
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
    const items = within(bilan).getAllByRole('listitem')
    expect(items.map((li) => li.dataset.etat)).toEqual(['juste', 'passe'])
    expect(items[0]).toHaveTextContent('✓ Juste')
    expect(items[0]).toHaveTextContent('Ta réponse : 7.')
    expect(items[1]).toHaveTextContent('? À découvrir')
    // Sans réponse, la solution ne se donne pas à garder : l'étape suivante l'explique.
    expect(
      within(bilan).getByText('Tu ne savais pas : les étapes suivantes te l’apprennent.'),
    ).toBeInTheDocument()
    expect(within(bilan).queryByText(/Il double|Compare 8 et 16/)).toBeNull()
  })

  it('redonne dans « Tes essais » les lignes que l’essai faisait lire', async () => {
    const avecLignes = avecPretest.replace(
      '<p class="q">Que devient le nombre de valeurs ?</p>',
      '<p class="q">Qu’affiche le thermostat ?</p><pre class="pseudo"><code>SI température ≥ 15 : afficher « tiède »</code></pre>',
    )
    expect(avecLignes).not.toBe(avecPretest)
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(avecLignes, pont)
    await screen.findByRole('heading', { name: 'Compter avec des lampes' })
    essai('c1', { reponse: '7', juste: true, attendu: '7' })
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
    essai('c2', { reponse: 'chaud', juste: false, attendu: 'tiède' })

    const bilan = screen.getByRole('heading', { name: 'Tes essais' }).parentElement
    if (!(bilan instanceof HTMLElement)) throw new Error('Pas de bilan des essais')
    const item = within(bilan).getAllByRole('listitem')[1]
    expect(item).toHaveTextContent('Qu’affiche le thermostat ?')
    expect(item?.querySelector('pre')).toHaveTextContent('SI température ≥ 15 : afficher « tiède »')
  })

  it('garde « Étape suivante » inactif tant qu’un essai attend sa réponse', async () => {
    const { pont, envois } = pontSimule(aLEtape('ET2'))
    monter(avecPretest, pont)
    await screen.findByRole('heading', { name: 'Compter avec des lampes' })
    // Un écran ne se quitte pas en avant avec un essai sans réponse.
    const suivant = screen.getByRole('button', { name: 'Suivant' })
    expect(suivant).toBeDisabled()
    expect(screen.getByText(/Réponds à chaque essai de cet écran/)).toBeInTheDocument()
    fireEvent.click(suivant)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    essai('c1', { reponse: '7', juste: true, attendu: '7' })
    expect(suivant).toBeEnabled()
    fireEvent.click(suivant)
    const suivante = screen.getByRole('button', { name: 'Étape suivante' })

    expect(suivante).toBeDisabled()
    expect(
      screen.getByText(/Réponds à chaque essai avant de passer à la suite/),
    ).toBeInTheDocument()
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

    const faux = screen.getByText('✗ Pas juste').closest('li')
    expect(faux).toHaveAttribute('data-etat', 'faux')
    expect(faux).toHaveTextContent('Ta réponse : 8.')
    expect(faux).toHaveTextContent('Attendu : 7.')
    expect(screen.queryByRole('button', { name: 'Je ne sais pas' })).toBeNull()
    expect(envois.filter((e) => e.type === 'pretest.reponse')).toEqual([])
  })

  it('au retour sur la page, la réponse figée reste affichée, et le bouton dit qu’il enregistre', async () => {
    const avecBoutons = avecPretest
      .replace(
        '<input aria-label="Ta réponse" />',
        '<input aria-label="Ta réponse" /><button type="button">Vérifier</button>',
      )
      .replace(
        '<ul class="options"><li data-option="deux">Il augmente de 2.</li><li data-option="double">Il double.</li></ul>',
        '<ul class="options"><li><button type="button">Il augmente de 2.</button></li><li><button type="button">Il double.</button></li></ul><button type="button" aria-pressed="false">VRAI</button>',
      )
    const traces = {
      // Noté avant que la page ne garde sa vue : le champ unique reprend la réponse.
      'essai:c1': { reponse: '8', juste: false, attendu: '7', retour: '', le: '2026-10-20' },
      'essai:c2': {
        reponse: 'Il double.',
        juste: true,
        attendu: 'Il double',
        retour: '',
        le: '2026-10-20',
        vue: { champs: [], enfonces: [[2, 'VRAI']] },
      },
    }
    const { pont } = pontSimule({ ...aLEtape('ET2'), traces })
    monter(avecBoutons, pont)
    await screen.findByRole('heading', { name: 'Compter avec des lampes' })

    expect(screen.getByRole('textbox', { name: 'Ta réponse' })).toHaveValue('8')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Vérifier' })).toBeNull()
    const choisie = screen.getByRole('button', { name: 'Il double.', hidden: true })
    expect(choisie).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Il augmente de 2.', hidden: true }),
    ).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('button', { name: 'VRAI', hidden: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('garde ce que voyait l’apprenant en répondant', async () => {
    const { pont, sauvees } = pontSimule(aLEtape('ET2'))
    monter(avecPretest, pont)
    await screen.findByRole('heading', { name: 'Compter avec des lampes' })
    const champ = screen.getByRole('textbox', { name: 'Ta réponse' })
    fireEvent.input(champ, { target: { value: '7' } })
    essai('c1', { reponse: '7', juste: true, attendu: '7' })

    const derniere = sauvees.at(-1) as { traces?: Record<string, { vue?: unknown }> } | undefined
    expect(derniere?.traces?.['essai:c1']?.vue).toEqual({ champs: ['7'], enfonces: [] })
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

describe('un exercice du cours', () => {
  /**
   * Le gabarit, son explication en deux écrans, un exercice du cours sur chacun, sans outil de fiche.
   * Le test joue l'outil : il marque l'exercice fini (`data-fini`), comme le fait celui d'une fiche
   * quand la réponse est juste ou la solution vue.
   */
  const avecExercices = GABARIT.replace(
    '<template data-etape="ET2">',
    '<template data-etape="ET2"><div data-ecran="Lire"><div class="ex" data-id="x1"><p class="q">Combien ?</p><input aria-label="Ta réponse" /></div></div>' +
      '<div data-ecran="Écrire"><div class="ex" data-id="x2"><p class="q">Et ici ?</p><input aria-label="Ta réponse" /></div></div></template><template data-etape="ET0">',
  )
  const finir = (cle: string) => {
    const ex = document.querySelector<HTMLElement>('[data-id="' + cle + '"]')
    if (!ex) throw new Error('Pas d’exercice ' + cle)
    ex.dataset.fini = 'oui'
  }

  it('garde « Suivant » et « Étape suivante » inactifs tant que l’exercice de l’écran n’est pas fini', async () => {
    const { pont, envois } = pontSimule(aLEtape('ET2'))
    monter(avecExercices, pont)
    await screen.findByRole('heading', { name: 'Explication' })
    const suivant = screen.getByRole('button', { name: 'Suivant' })
    expect(suivant).toBeDisabled()
    expect(screen.getByText(/Termine les exercices de cet écran/)).toBeInTheDocument()
    fireEvent.click(suivant)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    finir('x1')
    await waitFor(() => expect(suivant).toBeEnabled())
    fireEvent.click(suivant)
    const suivante = screen.getByRole('button', { name: 'Étape suivante' })

    expect(suivante).toBeDisabled()
    fireEvent.click(suivante)
    expect(envois).not.toContainEqual({ type: 'etape.vue', donnees: { etape: 'ET3' } })
    finir('x2')
    await waitFor(() => expect(suivante).toBeEnabled())
    fireEvent.click(suivante)
    expect(envois).toContainEqual({ type: 'etape.vue', donnees: { etape: 'ET3' } })
  })

  it('une solution vue à refaire (data-reprise) retient l’écran jusqu’à ce qu’elle soit refaite', async () => {
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(avecExercices, pont)
    await screen.findByRole('heading', { name: 'Explication' })
    const suivant = screen.getByRole('button', { name: 'Suivant' })
    const ex = document.querySelector<HTMLElement>('[data-id="x1"]')
    if (!ex) throw new Error('Pas d’exercice x1')
    ex.dataset.reprise = 'oui'
    finir('x1')
    await waitFor(() =>
      expect(screen.getByText(/Termine les exercices de cet écran/)).toBeVisible(),
    )
    expect(suivant).toBeDisabled()
    delete ex.dataset.reprise
    await waitFor(() => expect(suivant).toBeEnabled())
  })

  it('un exercice encore caché n’attend pas : il compte dès qu’il paraît', async () => {
    const cache = avecExercices.replace(
      '<div class="ex" data-id="x1">',
      '<div class="ex" data-id="x0" hidden><p class="q">Pas encore là</p></div><div class="ex" data-id="x1">',
    )
    const { pont } = pontSimule(aLEtape('ET2'))
    monter(cache, pont)
    await screen.findByRole('heading', { name: 'Explication' })
    finir('x1')
    const suivant = screen.getByRole('button', { name: 'Suivant' })
    await waitFor(() => expect(suivant).toBeEnabled())
    const x0 = document.querySelector<HTMLElement>('[data-id="x0"]')
    if (!x0) throw new Error('Pas d’exercice x0')
    x0.hidden = false
    await waitFor(() => expect(suivant).toBeDisabled())
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
    expect(screen.getByText('1 sur 3.')).toBeInTheDocument()
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

  it('une aide reçue reste dans la foulée : refait sans autre item entre-temps, l’item part avec elle', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')

    verifier({ juste: true, aide: 2 })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 2 })
    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 2 })
    expect(
      screen.getByText(
        'Envoyé : réussi, aide 2. Tu as eu de l’aide : réussis un autre item, puis reviens le refaire sans aide, sur un autre cas, pour qu’il compte.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Outil de la fiche').closest('.item')).not.toHaveAttribute(
      'data-solution-vue',
    )
  })

  it('après un autre item réussi, le même jour, l’item aidé se refait sur un autre cas et compte sans aide', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')
    const rendus: { refaire?: boolean }[] = []
    const lire = (evenement: Event) => {
      const detail = (
        evenement as CustomEvent<{ pratique?: Record<string, { refaire?: boolean }> }>
      ).detail
      rendus.push(detail.pratique?.['PR1-1'] ?? {})
    }
    document.addEventListener('fiche:rendu', lire)

    verifier({ juste: true, aide: 2 })
    fireEvent.click(screen.getByRole('button', { name: /^Item 2 sur 3/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'J’ai réussi' }))
    expect(envois.filter(({ type }) => type === 'pratique.resultat').at(-1)?.donnees).toMatchObject(
      { item: 'PR1-2', reussi: true },
    )
    fireEvent.click(screen.getByRole('button', { name: /^Item 1 sur 3/ }))
    const boite = (await screen.findByText('Outil de la fiche')).closest('.item')

    // La boîte le dit à l'outil (un autre cas), et fiche:rendu aussi (`refaire`).
    expect(boite).toHaveAttribute('data-solution-vue')
    expect(rendus.at(-1)?.refaire).toBe(true)
    expect(
      screen.getByText(
        'Envoyé : réussi, aide 2. Refais-le maintenant sans aide, sur un autre cas, pour qu’il compte.',
      ),
    ).toBeInTheDocument()
    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ item: 'PR1-1', reussi: true, aide: 0 })
    expect(screen.getByText('Réussi')).toBeInTheDocument()
    document.removeEventListener('fiche:rendu', lire)
  })

  it('un « Pas réussi » sur un autre item ne suffit pas : l’aide reste', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')

    verifier({ juste: true, aide: 2 })
    fireEvent.click(screen.getByRole('button', { name: /^Item 2 sur 3/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pas réussi' }))
    fireEvent.click(screen.getByRole('button', { name: /^Item 1 sur 3/ }))
    const boite = (await screen.findByText('Outil de la fiche')).closest('.item')

    expect(boite).not.toHaveAttribute('data-solution-vue')
    expect(screen.getByText(/réussis un autre item, puis reviens/)).toBeInTheDocument()
    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ item: 'PR1-1', reussi: true, aide: 2 })
  })

  it('un item aidé raté sur l’autre cas reste à refaire, sans aide après un autre item', async () => {
    const { pont, envois } = pontSimule(auPratique())
    monter(avecOutil, pont)
    await screen.findByText('Outil de la fiche')

    verifier({ juste: true, aide: 2 })
    fireEvent.click(screen.getByRole('button', { name: /^Item 2 sur 3/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'J’ai réussi' }))
    fireEvent.click(screen.getByRole('button', { name: /^Item 1 sur 3/ }))
    await screen.findByText('Outil de la fiche')
    // L'autre cas, aidé à son tour : l'aide revient, et il faut un autre item avant de compter.
    verifier({ juste: true, aide: 1 })
    expect(envois.at(-1)?.donnees).toMatchObject({ item: 'PR1-1', reussi: true, aide: 1 })
    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ item: 'PR1-1', reussi: true, aide: 1 })
    expect(screen.getByText(/réussis un autre item, puis reviens/)).toBeInTheDocument()
  })

  it('une aide notée sans rang (d’avant cette règle) est tenue pour éloignée', async () => {
    const d = new Date()
    const jour = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
      .map((n, k) => (k ? String(n).padStart(2, '0') : String(n)))
      .join('-')
    const { pont, envois } = pontSimule(
      auPratique({
        itemCourant: 0,
        pratique: {
          'PR1-1': {
            reussi: true,
            aide: 2,
            essais: 1,
            solutionVue: false,
            aideLe: jour,
            aideMax: 2,
          },
        },
      }),
    )
    monter(avecOutil, pont)
    const boite = (await screen.findByText('Outil de la fiche')).closest('.item')

    expect(boite).toHaveAttribute('data-solution-vue')
    verifier({ juste: true })
    expect(envois.at(-1)?.donnees).toMatchObject({ reussi: true, aide: 0 })
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
    expect(screen.getByText('1 sur 3, dont 1 avec de l’aide.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Envoyé : réussi, aide 4. Tu as vu la solution : réussis un autre item, puis reviens le refaire sans aide, sur un autre cas, pour qu’il compte.',
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
        screen.getByText(
          'Envoyé : réussi, aide 4. Refais-le maintenant sans aide, sur un autre cas, pour qu’il compte.',
        ),
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
      screen.getByText('Réussis les 3 items avant de passer à la suite : 0 sur 3, pour l’instant.'),
    ).toBeInTheDocument()
    verifier({ juste: true, aide: 2 })
    expect(suite()).toBeDisabled()
    expect(
      screen.getByText(/: 1 sur 3, dont 1 avec de l’aide, pour l’instant\./),
    ).toBeInTheDocument()
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

describe('un item déclaré qui pose une question', () => {
  /** Un item sans `data-verifie` : une prédiction, que l'outil vérifie, puis une manipulation déclarée. */
  const avecPrediction = GABARIT.replace(
    '<template data-item="PR1-1"><p data-erreur="E1">À REMPLACER : item PR1-1 (E1).</p></template>',
    '<template data-item="PR1-1"><div class="ex" data-widget="choix" data-erreur="E1">Prédiction</div></template>',
  )
  const auPratique = { etape: 'ET3', envoyees: {}, pratique: {}, retourCours: false }

  it('« J’ai réussi » attend la réponse à la question de l’item', async () => {
    const { pont } = pontSimule(auPratique)
    monter(avecPrediction, pont)
    const jaiReussi = await screen.findByRole('button', { name: 'J’ai réussi' })
    expect(jaiReussi).toBeDisabled()
    expect(screen.getByText(/« J’ai réussi » attend ta réponse/)).toBeVisible()
    const ex = screen.getByText('Prédiction')
    ex.dataset.fini = 'oui'
    await waitFor(() => expect(jaiReussi).toBeEnabled())
    expect(screen.getByText(/« J’ai réussi » attend ta réponse/)).not.toBeVisible()
  })

  it('la solution montrée par l’outil se note avec l’aide 4, et l’item se redessine sur fiche:refaire', async () => {
    const { pont, envois } = pontSimule(auPratique)
    monter(avecPrediction, pont)
    const ex = await screen.findByText('Prédiction')
    // Une réponse vérifiée ne compte pas : dans un item déclaré, l'apprenant déclare.
    ex.dispatchEvent(
      new CustomEvent('fiche:verification', { bubbles: true, detail: { juste: true, aide: 0 } }),
    )
    expect(envois.filter((envoi) => envoi.type === 'pratique.resultat')).toHaveLength(0)
    ex.dispatchEvent(
      new CustomEvent('fiche:verification', {
        bubbles: true,
        detail: { juste: false, aide: 4, garder: true },
      }),
    )
    expect(envois.at(-1)).toMatchObject({
      type: 'pratique.resultat',
      donnees: { item: 'PR1-1', reussi: false, aide: 4 },
    })
    ex.dispatchEvent(new CustomEvent('fiche:refaire', { bubbles: true }))
    const neuf = await screen.findByText('Prédiction')
    expect(neuf).not.toBe(ex)
    expect(neuf.closest('[data-solution-vue]')).not.toBeNull()
  })
})

describe('une explication jugée par l’IA', () => {
  /** Le gabarit, avec un premier item vérifié par un outil, et son explication déclarée. */
  const fiche = GABARIT.replace(
    '<template data-item="PR1-1"><p data-erreur="E1">À REMPLACER : item PR1-1 (E1).</p></template>',
    '<template data-item="PR1-1"><div data-verifie>Outil de la fiche</div></template>',
  ).replace(
    '"explication": [],',
    '"explication": [{ "id": "PR1-1", "item": "PR1-1", "question": "Pourquoi le bit de gauche vaut-il 128 ?", "attendu": "Chaque place double.", "erreurs": [] }],',
  )
  const correction = (niveau: string, compte = true) => ({
    id: '0190a000-0000-7000-8000-' + String(Math.random()).slice(2, 14).padEnd(12, '0'),
    echantillon: false,
    question: 'PR1-1',
    tour: 1,
    niveau,
    message: niveau === 'solide' ? 'Tu as l’idée.' : 'Il manque la place.',
    erreurs_critiques: [],
    source: 'deduit',
    ref: '',
    certitude: 'sur',
    compte,
    ...(compte ? {} : { raison_non_compte: 'avec_support' }),
  })
  /** La page sur la pratique ; chaque demande de correction reçoit la réponse suivante de la liste. */
  async function ouvrir(reponses: (Record<string, unknown> | Error)[]) {
    const simule = pontSimule({ etape: 'ET3', envoyees: {}, pratique: {}, retourCours: false })
    Object.assign(simule.pont, {
      demanderCorrection: (demande: Record<string, unknown>) => {
        simule.demandes.push(demande)
        const suivante = reponses.shift()
        return suivante instanceof Error ? Promise.reject(suivante) : Promise.resolve(suivante)
      },
    })
    monter(fiche, simule.pont)
    const outil = await screen.findByText('Outil de la fiche')
    return { ...simule, outil }
  }
  const expliquer = (outil: HTMLElement, cle = 'PR1-1') =>
    outil.dispatchEvent(
      new CustomEvent('fiche:expliquer', {
        bubbles: true,
        detail: { cle, solution: '128.', consigne: 'Pourquoi ?' },
      }),
    )
  async function envoyer(texte: string) {
    const champ = screen
      .getAllByRole('textbox')
      .filter((element) => element instanceof HTMLTextAreaElement && !element.disabled)
      .at(-1)
    if (!(champ instanceof HTMLTextAreaElement)) throw new Error('Aucun champ ouvert')
    const essai = champ.closest('.expliquer-essai')
    if (!(essai instanceof HTMLElement)) throw new Error('Un champ hors d’un essai')
    fireEvent.input(champ, { target: { value: texte } })
    fireEvent.click(within(essai).getByRole('radio', { name: 'Sûr' }))
    fireEvent.click(within(essai).getByRole('button', { name: 'Envoyer mon explication' }))
    await waitFor(() => {
      expect(essai.isConnected).toBe(false)
    })
  }
  const verifierJuste = (outil: HTMLElement) =>
    outil.dispatchEvent(
      new CustomEvent('fiche:verification', { bubbles: true, detail: { juste: true } }),
    )

  it('l’item attend une explication Solide : la première se reprend, la seconde Solide le fait réussir', async () => {
    const { outil, demandes, sauvees } = await ouvrir([correction('partiel'), correction('solide')])
    verifierJuste(outil)
    expliquer(outil)
    expect(screen.getByText('Explication attendue')).toBeInTheDocument()
    expect(screen.getByText('0 sur 3.')).toBeInTheDocument()

    await envoyer('Le bit compte.')
    expect(demandes.at(-1)).toMatchObject({
      serie: 'explication',
      question: 'PR1-1',
      reponse: 'Le bit compte.',
      confiance: 'sur',
      relance: '',
    })
    expect(demandes.at(-1)).not.toHaveProperty('libre')
    expect(screen.getByText('Il manque la place.')).toBeInTheDocument()
    expect(
      screen.getByText('Reprends ton explication, d’après la correction :'),
    ).toBeInTheDocument()

    await envoyer('Chaque place vers la gauche double.')
    expect(screen.getByText('Tu as l’idée.')).toBeInTheDocument()
    expect(screen.getByText('Réussi')).toBeInTheDocument()
    expect(screen.getByText('1 sur 3.')).toBeInTheDocument()
    const etat = sauvees.at(-1) as {
      pratique: Record<string, { explique?: boolean }>
      traces: Record<string, { fin: string; essais: unknown[] }>
    }
    expect(etat.pratique['PR1-1']?.explique).toBe(true)
    expect(etat.traces['explique:PR1-1']).toMatchObject({ fin: 'solide' })
    expect(etat.traces['explique:PR1-1']?.essais).toHaveLength(2)
  })

  it('deux explications qui ne sont pas Solides : la page demande à l’outil de montrer la solution', async () => {
    const { outil } = await ouvrir([correction('fragile'), correction('solide', false)])
    let ratee: unknown
    outil.addEventListener('fiche:explication-ratee', (evenement) => {
      ratee = (evenement as CustomEvent).detail
    })
    verifierJuste(outil)
    expliquer(outil)
    await envoyer('Je ne sais pas trop.')
    await envoyer('Je recopie la fiche.')

    expect(JSON.stringify(ratee)).toContain('voici la solution de l’item')
    expect(screen.getByText('Explication attendue')).toBeInTheDocument()
  })

  it('après une solution vue, l’explication se juge sur la solution de la page, une fois', async () => {
    const { outil, demandes, sauvees } = await ouvrir([correction('partiel', false)])
    expliquer(outil, 'ex:c1')
    await envoyer('Parce que 128.')

    expect(demandes.at(-1)).toMatchObject({
      serie: 'explication',
      question: 'ex:c1',
      libre: {
        question:
          'Pourquoi ?\nL’apprenant n’écrit qu’une explication\u00a0: dis ce qui est juste et ce qui manquait, sans lui demander de la refaire.',
        attendu: '128.',
      },
    })
    const etat = sauvees.at(-1) as { traces: Record<string, { fin: string }> }
    expect(etat.traces['explique:ex:c1']).toMatchObject({ fin: 'jugee' })
    expect(screen.queryByRole('button', { name: 'Envoyer mon explication' })).toBeNull()
  })

  it('une explication libre donne au correcteur ce que l’écran montre : la règle, la question, le retour', async () => {
    const { outil, demandes } = await ouvrir([correction('partiel', false)])
    const ecran = document.createElement('div')
    ecran.className = 'ecran'
    const regle = document.createElement('p')
    regle.textContent = 'Exemple : « Le code promo marche pour les nouveaux clients, sauf soldés. »'
    outil.replaceWith(ecran)
    ecran.append(regle, outil)
    const enonce = document.createElement('p')
    enonce.className = 'q'
    enonce.textContent = 'Un nouveau client aurait-il le code ?'
    const retour = document.createElement('p')
    retour.className = 'retour'
    retour.textContent = 'ET passe avant OU. Solution : Oui.'
    outil.append(enonce, retour)
    expliquer(outil, 'ex:t6')
    await envoyer('Les parenthèses changent le sens.')

    const libre = (demandes.at(-1) as { libre: { question: string; attendu: string } }).libre
    expect(libre.question).toContain('Exercice\u00a0: Un nouveau client aurait-il le code ?')
    expect(libre.question).toContain('Le code promo marche pour les nouveaux clients')
    expect(libre.attendu).toBe('128. ET passe avant OU. Solution : Oui.')
  })

  it('sans correction possible, l’explication attend d’être renvoyée : rien ne la juge à la place', async () => {
    const indisponible = Object.assign(new Error('indisponible'), {
      detail: 'Le correcteur ne répond pas.',
    })
    const { outil, sauvees } = await ouvrir([indisponible, correction('solide')])
    verifierJuste(outil)
    expliquer(outil)
    const champ = screen
      .getAllByRole('textbox')
      .find((element) => element instanceof HTMLTextAreaElement)
    if (!(champ instanceof HTMLTextAreaElement)) throw new Error('Aucun champ')
    fireEvent.input(champ, { target: { value: 'Chaque place double.' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Sûr' }))
    const bouton = screen.getByRole('button', { name: 'Envoyer mon explication' })
    fireEvent.click(bouton)

    expect(
      await screen.findByText(
        /Correction impossible : Le correcteur ne répond pas\. Ton explication attend : renvoie-la\./,
      ),
    ).toBeInTheDocument()
    expect(bouton).not.toBeDisabled()
    expect(screen.getByText('Explication attendue')).toBeInTheDocument()
    expect(sauvees.some((etat) => JSON.stringify(etat).includes('explique:PR1-1'))).toBe(false)
    fireEvent.click(bouton)
    expect(await screen.findByText('Réussi')).toBeInTheDocument()
  })

  it('un schéma sans départ : boîtes et flèches écrites, jugées par l’IA sur la chaîne, deux essais', async () => {
    const { outil, demandes, sauvees } = await ouvrir([
      correction('partiel', false),
      correction('solide', false),
    ])
    const ex = document.createElement('div')
    ex.dataset.id = 'f2'
    ex.innerHTML =
      '<div class="modele" hidden><div class="chaine"><span class="boite">des bits</span>' +
      '<span class="fleche">lus par</span><span class="boite">un programme</span></div></div>'
    outil.append(ex)
    const gabarit: unknown = Reflect.get(window, 'JanusGabarit')
    const fabrique: unknown =
      typeof gabarit === 'object' && gabarit !== null ? Reflect.get(gabarit, 'schema') : undefined
    if (typeof fabrique !== 'function') throw new Error('Le gabarit n’expose pas son schéma')
    const schema: unknown = Reflect.apply(fabrique, undefined, [ex])
    if (typeof schema !== 'object' || schema === null) throw new Error('Aucun schéma')
    const attendu: unknown = Reflect.get(schema, 'attendu')
    const question: unknown = Reflect.get(schema, 'question')
    const saisie: unknown = Reflect.get(schema, 'saisie')
    expect(attendu).toBe('[des bits] —lus par→ [un programme].')
    ex.dispatchEvent(
      new CustomEvent('fiche:expliquer', {
        bubbles: true,
        detail: {
          cle: 'ex:f2',
          solution: attendu,
          consigne: 'Ton schéma :',
          question,
          saisie,
          essais: 2,
          envoyer: 'Faire juger mon schéma',
        },
      }),
    )
    const modele = ex.querySelector('.modele')
    expect(modele).not.toBeVisible()
    const envoyerSchema = (valeurs: string[]) => {
      const champs = within(ex).getAllByRole('textbox')
      valeurs.forEach((valeur, i) => {
        const champ = champs[i]
        if (champ) fireEvent.input(champ, { target: { value: valeur } })
      })
      const essai = ex.querySelector('.expliquer-essai')
      if (!(essai instanceof HTMLElement)) throw new Error('Aucun essai ouvert')
      fireEvent.click(within(essai).getByRole('radio', { name: 'Sûr' }))
      fireEvent.click(within(essai).getByRole('button', { name: 'Faire juger mon schéma' }))
      return essai
    }

    // Rien n'est donné : deux boîtes et une flèche vides, à écrire ; une boîte de plus s'ajoute.
    expect(within(ex).getAllByRole('textbox')).toHaveLength(3)
    envoyerSchema(['des bits'])
    expect(
      within(ex).getByText(
        'Écris chaque boîte et chaque flèche, ou retire celles qui sont en trop.',
      ),
    ).toBeInTheDocument()
    expect(demandes).toHaveLength(0)
    // Deux boîtes : rien à retirer ; une de plus s'ajoute au bout, et se retire.
    expect(
      within(ex).queryByRole('button', { name: 'Retirer cette boîte et sa flèche' }),
    ).toBeNull()
    fireEvent.click(within(ex).getByRole('button', { name: 'Ajouter une flèche et une boîte' }))
    expect(within(ex).getAllByRole('textbox')).toHaveLength(5)
    const retirer = within(ex).getAllByRole('button', { name: 'Retirer cette boîte et sa flèche' })
    expect(retirer).toHaveLength(3)
    const derniere = retirer.at(-1)
    if (derniere) fireEvent.click(derniere)
    expect(within(ex).getAllByRole('textbox')).toHaveLength(3)

    const premier = envoyerSchema(['les bits', 'donnent', 'un sens'])
    await waitFor(() => {
      expect(premier.isConnected).toBe(false)
    })
    expect(demandes.at(-1)).toMatchObject({
      serie: 'explication',
      question: 'ex:f2',
      reponse: '[les bits] —donnent→ [un sens]',
      libre: { attendu: '[des bits] —lus par→ [un programme].' },
    })
    // Le correcteur juge la chaîne, pas la ressemblance au schéma du cours.
    expect(JSON.stringify(demandes.at(-1))).toContain(
      'le nombre de boîtes et les mots peuvent différer du schéma du cours',
    )
    expect(JSON.stringify(demandes.at(-1))).not.toContain('de mémoire')
    expect(within(ex).getByText('Reprends-le, d’après la correction :')).toBeInTheDocument()

    const second = envoyerSchema(['des bits', 'lus par', 'un programme'])
    await waitFor(() => {
      expect(second.isConnected).toBe(false)
    })
    const etat = sauvees.at(-1) as { traces: Record<string, { fin: string; essais: unknown[] }> }
    expect(etat.traces['explique:ex:f2']).toMatchObject({ fin: 'jugee' })
    expect(etat.traces['explique:ex:f2']?.essais).toHaveLength(2)
    expect(within(ex).queryByRole('button', { name: 'Faire juger mon schéma' })).toBeNull()
  })

  it('un schéma construit pour un cas : boîtes posées, questions d’aide, jugé sur la chaîne du cas', async () => {
    const { outil, demandes } = await ouvrir([correction('solide', false)])
    const ex = document.createElement('div')
    ex.dataset.id = 'f1'
    ex.dataset.cas = 'Pour Léna, la chaîne juste : 10 €.'
    ex.innerHTML =
      '<p class="q">Fais passer Léna dans le schéma.</p>' +
      '<ol class="depart" hidden><li class="boite" data-pose>Les données de Léna</li>' +
      '<li class="fleche">Que fait le guichet avec ces données ?</li>' +
      '<li class="boite">Qu’est-ce que le guichet en tire ?</li>' +
      '<li class="fleche">Comment choisit-il ?</li>' +
      '<li class="boite" data-pose data-champ="Combien paie Léna ?">le prix affiché</li></ol>' +
      '<div class="modele" hidden><div class="chaine"><span class="boite">les données</span>' +
      '<span class="fleche">donnent</span><span class="boite">une branche</span></div></div>'
    outil.append(ex)
    const gabarit: unknown = Reflect.get(window, 'JanusGabarit')
    const fabrique: unknown =
      typeof gabarit === 'object' && gabarit !== null ? Reflect.get(gabarit, 'schema') : undefined
    if (typeof fabrique !== 'function') throw new Error('Le gabarit n’expose pas son schéma')
    const schema: unknown = Reflect.apply(fabrique, undefined, [ex])
    if (typeof schema !== 'object' || schema === null) throw new Error('Aucun schéma')
    const attendu: unknown = Reflect.get(schema, 'attendu')
    const question: unknown = Reflect.get(schema, 'question')
    const saisie: unknown = Reflect.get(schema, 'saisie')
    expect(attendu).toBe(
      'Pour Léna, la chaîne juste : 10 €. Le schéma du cours, pour comparer\u00a0: [les données] —donnent→ [une branche].',
    )
    ex.dispatchEvent(
      new CustomEvent('fiche:expliquer', {
        bubbles: true,
        detail: {
          cle: 'ex:f1',
          solution: attendu,
          consigne: 'Ton schéma :',
          question: question,
          saisie: saisie,
          essais: 2,
          envoyer: 'Faire juger mon schéma',
        },
      }),
    )
    // Les boîtes posées se lisent ; chaque case à écrire porte sa question ; la dernière, un champ.
    const editeur = ex.querySelector('.schema-chaine')
    if (!(editeur instanceof HTMLElement)) throw new Error('Aucun éditeur de schéma')
    expect(within(editeur).getByText('Les données de Léna')).toBeVisible()
    expect(within(editeur).getByText('le prix affiché')).toBeVisible()
    expect(within(ex).getByLabelText('Que fait le guichet avec ces données ?')).toBeInTheDocument()
    expect(within(ex).getByLabelText('Qu’est-ce que le guichet en tire ?')).toBeInTheDocument()
    expect(within(ex).getAllByRole('textbox')).toHaveLength(4)
    // Une boîte s'ajoute avant la dernière, qui reste posée.
    fireEvent.click(within(ex).getByRole('button', { name: 'Ajouter une boîte avant la dernière' }))
    expect(within(ex).getAllByRole('textbox')).toHaveLength(6)
    expect(editeur.lastElementChild).toHaveTextContent('le prix affiché')
    const retirer = within(ex).getAllByRole('button', { name: 'Retirer cette boîte et sa flèche' })
    const ajoutee = retirer.at(-1)
    if (ajoutee) fireEvent.click(ajoutee)
    expect(within(ex).getAllByRole('textbox')).toHaveLength(4)

    const champs = within(ex).getAllByRole('textbox')
    ;['lues ou comparées', 'des faits', 'aucune VRAIE, le SINON', '10 €'].forEach((v, i) => {
      const champ = champs[i]
      if (champ) fireEvent.input(champ, { target: { value: v } })
    })
    const essai = ex.querySelector('.expliquer-essai')
    if (!(essai instanceof HTMLElement)) throw new Error('Aucun essai ouvert')
    fireEvent.click(within(essai).getByRole('radio', { name: 'Sûr' }))
    fireEvent.click(within(essai).getByRole('button', { name: 'Faire juger mon schéma' }))
    await waitFor(() => {
      expect(demandes).toHaveLength(1)
    })
    expect(demandes.at(-1)).toMatchObject({
      reponse:
        '[Les données de Léna] —lues ou comparées→ [des faits] —aucune VRAIE, le SINON→ [le prix affiché\u00a0: 10 €]',
    })
    const envoi = JSON.stringify(demandes.at(-1))
    expect(envoi).toContain('Fais passer Léna dans le schéma.')
    expect(envoi).toContain('« Les données de Léna », « le prix affiché »')
    expect(envoi).toContain('Une étape qui manque ou une relation fausse est une erreur.')
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
    await screen.findByText('0 sur 3.')

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

describe('l’atelier : faire hors de la page', () => {
  /** Le gabarit, avec un atelier (ET7) après la pratique : un guide, un coup de pouce, deux critères. */
  const avecAtelier = GABARIT.replace(
    '"id": "ET3",\n            "titre": "Pratique",\n            "type": "pratique"\n          },',
    '"id": "ET3",\n            "titre": "Pratique",\n            "type": "pratique"\n          },\n          { "id": "ET7", "titre": "Sur ta machine", "type": "atelier" },',
  )
    .replace(
      '"pratique": [',
      '"atelier": { "id": "AT1", "reussite_aide_max": 0, "criteres": ["J’ai relevé la RAM.", "J’ai relevé le disque."] }, "pratique": [',
    )
    .replace(
      '<template data-etape="ET2">',
      '<template data-etape="ET7"><p>Ouvre le gestionnaire des tâches.</p><details data-cran="2"><summary>Un coup de pouce</summary><p>Ctrl+Maj+Échap.</p></details></template>\n    <template data-etape="ET2">',
    )
  const envoisAtelier = (envois: readonly Envoi[]) =>
    envois.filter(({ type }) => type === 'atelier.resultat').map(({ donnees }) => donnees)

  it('montre son guide, puis le constat : chaque critère coché, l’aide dite', async () => {
    expect(avecAtelier).not.toBe(GABARIT)
    const { pont, envois } = pontSimule(aLEtape('ET7'))
    monter(avecAtelier, pont)

    expect(await screen.findByText('Ouvre le gestionnaire des tâches.')).toBeInTheDocument()
    const envoyer = screen.getByRole('button', { name: 'Envoyer mon constat' })
    expect(envoyer).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Étape suivante' })).toBeDisabled()
    expect(screen.getByText('Envoie ton constat avant de passer à la suite.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'J’ai relevé la RAM.' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Aucune aide' }))
    fireEvent.click(envoyer)
    // Un critère manque : pas réussi, et l'étape suivante s'ouvre quand même.
    expect(envoisAtelier(envois)).toEqual([{ reussi: false, predictions_justes: 0, aide: 0 }])
    expect(screen.getByText(/pas encore réussi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Étape suivante' })).toBeEnabled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'J’ai relevé le disque.' }))
    fireEvent.click(envoyer)
    expect(envoisAtelier(envois).at(-1)).toEqual({ reussi: true, predictions_justes: 3, aide: 0 })
    expect(screen.getByText('Envoyé : réussi sans aide.')).toBeInTheDocument()
  })

  it('un coup de pouce ouvert fixe l’aide au moins à son cran, même au retour', async () => {
    const { pont, sauvees } = pontSimule(aLEtape('ET7'))
    monter(avecAtelier, pont)
    await screen.findByText('Ouvre le gestionnaire des tâches.')

    const details = document.querySelector('details[data-cran]')
    if (!(details instanceof HTMLDetailsElement)) throw new Error('Pas de coup de pouce')
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    expect(screen.getByRole('radio', { name: 'Aucune aide' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Un indice' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Une piste détaillée' })).toBeEnabled()

    document.body.replaceChildren()
    const { pont: retour, envois } = pontSimule(sauvees.at(-1) ?? {})
    monter(avecAtelier, retour)
    await screen.findByText('Ouvre le gestionnaire des tâches.')
    expect(screen.getByRole('radio', { name: 'Aucune aide' })).toBeDisabled()
    for (const nom of ['J’ai relevé la RAM.', 'J’ai relevé le disque.'])
      fireEvent.click(screen.getByRole('checkbox', { name: nom }))
    fireEvent.click(screen.getByRole('radio', { name: 'Une piste détaillée' }))
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer mon constat' }))
    expect(envoisAtelier(envois)).toEqual([{ reussi: true, predictions_justes: 3, aide: 2 }])
    expect(
      screen.getByText(/réussi, aide 2\. Refais-le un autre jour sans aide/),
    ).toBeInTheDocument()
  })
})

describe('l’échelle d’aide, la même pour toutes les fiches', () => {
  type Echelle = {
    zone: HTMLElement
    tentative: () => void
    cran: () => number
    maj: () => void
    toutOuvrir: () => void
  }
  /** L'échelle du gabarit, posée sur un exercice de la page. */
  const echelleDe = (
    ex: HTMLElement,
    options: {
      crans?: unknown[]
      fini?: () => boolean
      surSolution?: () => void
      restantes?: () => number
      enchaine?: boolean
    },
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
    ['tentative', 'cran', 'maj', 'toutOuvrir'].every(
      (nom) => typeof Reflect.get(valeur, nom) === 'function',
    )
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

  it('un choix enchaîne ses crans après la première réponse fausse, la solution s’il reste à choisir', async () => {
    const ex = await pose()
    Object.assign(ex.dataset, { aide1: 'Que compare-t-on ?', aide2: 'Compare 3 à 2, puis à 4.' })
    const restantes = 2
    let solution = 0
    const echelle = echelleDe(ex, {
      enchaine: true,
      restantes: () => restantes,
      surSolution: () => (solution += 1),
    })
    echelle.tentative()
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Un coup de pouce' }))
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Un autre coup de pouce' }))
    expect(within(echelle.zone).getByText('Compare 3 à 2, puis à 4.')).toBeInTheDocument()
    expect(echelle.cran()).toBe(2)
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Voir la solution' }))
    expect(solution).toBe(1)
    expect(echelle.cran()).toBe(4)
  })

  it('une solution montrée d’office ouvre d’abord les crans qui restent', async () => {
    const ex = await pose()
    Object.assign(ex.dataset, { aide1: 'Que compare-t-on ?', aide2: 'Compare 3 à 2, puis à 4.' })
    const echelle = echelleDe(ex, { enchaine: true, restantes: () => 1 })
    echelle.tentative()
    echelle.toutOuvrir()
    expect(within(echelle.zone).getByText('Que compare-t-on ?')).toBeInTheDocument()
    expect(within(echelle.zone).getByText('Compare 3 à 2, puis à 4.')).toBeInTheDocument()
    expect(echelle.cran()).toBe(2)
    expect(within(echelle.zone).queryByRole('button')).toBeNull()
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

  it('un choix dont la dernière option se montre d’office n’a pas de « Voir la solution »', async () => {
    const ex = await pose()
    // Trois options, un cran : après deux réponses fausses, il ne reste qu'une option.
    let restantes = 3
    const echelle = echelleDe(ex, { crans: ['Relis la règle.'], restantes: () => restantes })
    restantes = 2
    echelle.tentative()
    fireEvent.click(within(echelle.zone).getByRole('button', { name: 'Un coup de pouce' }))
    expect(within(echelle.zone).queryByRole('button', { name: 'Voir la solution' })).toBeNull()

    // Quatre options : la solution sert encore.
    const autre = document.createElement('div')
    document.body.append(autre)
    let quatre = 4
    const large = echelleDe(autre, { crans: ['Relis la règle.'], restantes: () => quatre })
    quatre = 3
    large.tentative()
    fireEvent.click(within(large.zone).getByRole('button', { name: 'Un coup de pouce' }))
    expect(within(large.zone).getByRole('button', { name: 'Voir la solution' })).toBeVisible()
  })
})
