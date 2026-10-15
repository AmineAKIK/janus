// @vitest-environment-options {"runScripts": "dangerously"}
import { fireEvent, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
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
function pontSimule(etat: Record<string, unknown>, correction?: Record<string, unknown>) {
  const envois: Envoi[] = []
  const statuts = new Set<Rappel>()
  const erreurs = new Set<Rappel>()
  const pont = {
    demarrer: () =>
      Promise.resolve({
        mode: 'appli',
        etat,
        init: { statut: 'vu', serie_ouverte: { restitution: true, consolidation: false } },
      }),
    envoyer: (type: string, donnees: unknown) => {
      envois.push({ type, donnees })
      return 'message-' + String(envois.length)
    },
    sauver: () => undefined,
    demanderCorrection: () =>
      correction === undefined ? new Promise(() => undefined) : Promise.resolve(correction),
    surStatut: (rappel: Rappel) => {
      statuts.add(rappel)
      return () => statuts.delete(rappel)
    },
    surErreur: (rappel: Rappel) => {
      erreurs.add(rappel)
      return () => erreurs.delete(rappel)
    },
    surEtape: () => () => undefined,
    surInit: () => () => undefined,
  }
  const direStatut = (statut: unknown) => {
    for (const rappel of statuts) rappel(statut)
  }
  /** L'appli refuse le dernier message envoyé. */
  const refuserDernier = (detail: string) => {
    for (const rappel of erreurs)
      rappel({ code: 'message_refuse', detail, message_id: 'message-' + String(envois.length) })
  }
  return { pont, envois, direStatut, refuserDernier }
}

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

    // Une réponse solide a refermé E1 : plus d'erreur ouverte dans ce qui manque.
    direStatut({ statut: 'vu', manque: [] })
    expect(premiere).not.toBeChecked()
    expect(bouton).toBeDisabled()
    fireEvent.click(premiere)
    expect(bouton).toBeEnabled()
    fireEvent.click(premiere)
    expect(bouton).toBeDisabled()
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

  it('demande l’avis sur le niveau dans un groupe à part, puis remercie', async () => {
    const etat = { etape: 'ET4', envoyees: {}, pratique: {}, retourCours: false }
    const { pont, envois } = pontSimule(etat, correction)
    monter(GABARIT, pont)
    const [zone] = await screen.findAllByRole('textbox')
    const question = zone?.closest('.item')
    if (!(zone instanceof HTMLTextAreaElement) || !(question instanceof HTMLElement))
      throw new Error('Aucune question à répondre')

    fireEvent.input(zone, { target: { value: 'Une réponse.' } })
    fireEvent.click(within(question).getByRole('radio', { name: 'Sûr' }))
    fireEvent.click(within(question).getByRole('button', { name: 'Envoyer' }))
    const accord = await within(question).findByRole('group', { name: /D’accord avec ce niveau/ })

    expect(accord.closest('[aria-live="polite"]')).not.toBeNull()
    fireEvent.click(within(accord).getByRole('button', { name: 'Oui' }))
    expect(envois).toContainEqual({
      type: 'correction.accord',
      donnees: { correction: correction.id, accord: true },
    })
    expect(within(question).queryByRole('group', { name: /D’accord/ })).toBeNull()
    expect(within(question).getByText('Merci, c’est noté.')).toBeInTheDocument()
  })
})

describe('la pratique', () => {
  /** Le gabarit, avec un premier item dont un outil contrôle la réponse. */
  const avecOutil = GABARIT.replace(
    '<template data-item="PR1-1"><p>À REMPLACER : énoncé de l\'item PR1-1.</p></template>',
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
    expect(screen.getByText('Réussi')).toBeInTheDocument()
    expect(screen.getByText('1 réussi sur 3.')).toBeInTheDocument()
    expect(rendus).toBe(1)
    document.removeEventListener('fiche:rendu', compter)
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
    ['ensemble', 'Comprendre'],
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
    ).toEqual(['Restitution', 'Consolidation', 'Bilan'])
    expect(within(entrainer).getByRole('button', { name: 'Pratique' })).toHaveAttribute(
      'aria-current',
      'step',
    )
  })
})
