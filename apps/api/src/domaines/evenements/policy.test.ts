import { EXEMPLES_PAGE, MessagePage } from '@janus/contrats'
import type { Manifeste } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import {
  decisionsDuBilan,
  empreinteDuMessage,
  enregistrementDe,
  estSansEffet,
  incoherence,
  MESSAGES_AILLEURS,
} from './policy.ts'

/** Un exemple du contrat, relu par son schéma pour avoir le bon type. */
const exemple = (type: keyof typeof EXEMPLES_PAGE) => MessagePage.parse(EXEMPLES_PAGE[type])

describe('empreinteDuMessage', () => {
  it('ne dépend pas de l’ordre des champs', () => {
    const { id, bloc, version, t, etape } = EXEMPLES_PAGE['etape.vue']

    expect(empreinteDuMessage({ id, type: 'etape.vue', bloc, version, t, etape })).toBe(
      empreinteDuMessage({ etape, t, version, bloc, type: 'etape.vue', id }),
    )
  })

  it('change dès que le contenu change', () => {
    expect(empreinteDuMessage(exemple('etape.vue'))).not.toBe(
      empreinteDuMessage({ ...EXEMPLES_PAGE['etape.vue'], type: 'etape.vue', etape: 'ET4' }),
    )
  })
})

describe('enregistrementDe', () => {
  it.each([
    ['etape.vue', 'etape_vue', { etape: 'ET3' }, null, true],
    [
      'pratique.resultat',
      'pratique_resultat',
      { exercice: 'PR1', item: 'PR1-2', reussi: true, aide: 0 },
      0,
      true,
    ],
    ['atelier.resultat', 'atelier_resultat', { reussi: true, aide: 1 }, 1, true],
    ['aisance.resultat', 'aisance_resultat', { reussi: true, dureeS: 42.5 }, null, true],
    ['bilan.erreurs', 'bilan.erreurs', { ids: ['E1', 'E3'] }, null, true],
    ['page.prete', 'page.prete', {}, null, false],
    [
      'pretest.reponse',
      'pretest.reponse',
      { question: 'P1', reponse: 'Je pense que c’est une liste.' },
      null,
      false,
    ],
  ] as const)('%s est gardé comme %s', (type, attendu, donnees, aide, change) => {
    expect(enregistrementDe(exemple(type))).toEqual({
      type: attendu,
      donnees,
      aide,
      changeLeStatut: change,
    })
  })

  it('garde le temps actif sans changer le statut', () => {
    const id = EXEMPLES_PAGE['etape.vue'].id
    expect(
      enregistrementDe({ id, type: 'temps.actif', bloc: 'D01', secondes: 30, etape: 'pratique' }),
    ).toEqual({
      type: 'temps.actif',
      donnees: { secondes: 30, etape: 'pratique' },
      aide: null,
      changeLeStatut: false,
    })
  })

  it('refuse sur /evenements les messages qui ont leur route', () => {
    expect(Object.keys(MESSAGES_AILLEURS).sort()).toEqual([
      'correction.accord',
      'etat.sauver',
      'lien.ouvrir',
      'page.haut',
      'page.taille',
      'restitution.demande',
    ])
  })
})

describe('decisionsDuBilan', () => {
  // Une case décochée ne ferme rien : seule une réponse solide referme une erreur ouverte.
  it.each([
    [[], ['E1'], ['E1']],
    [['E1'], ['E1'], []],
    [['E1', 'E2'], ['E2'], []],
    [['E1'], [], []],
    [['E1'], ['E1', 'E3'], ['E3']],
    [[], [], []],
  ])('ouvertes %j, cochées %j', (ouvertes, cochees, aCocher) => {
    expect(decisionsDuBilan(ouvertes, cochees)).toEqual({ aCocher })
  })
})

describe('incoherence et estSansEffet', () => {
  // Seuls les champs que la règle lit.
  const fiche = {
    etapes: [{ id: 'ET3' }],
    pratique: [{ id: 'PR1', items: [{ id: 'PR1-2' }] }],
    erreurs_critiques: [{ id: 'E1' }, { id: 'E3' }],
    atelier: { id: 'AT1' },
    aisance: { libelle: 'Aisance' },
  } as unknown as Manifeste
  const sansAtelierNiAisance = { ...fiche, atelier: undefined, aisance: undefined } as Manifeste

  it('accepte les exemples du contrat quand la fiche connaît ce qu’ils citent', () => {
    for (const type of [
      'etape.vue',
      'pratique.resultat',
      'atelier.resultat',
      'aisance.resultat',
      'bilan.erreurs',
    ] as const) {
      expect(incoherence(exemple(type), fiche), type).toBeUndefined()
    }
    expect(incoherence(exemple('pretest.reponse'), fiche)).toBeUndefined()
  })

  it('nomme ce que la fiche ne connaît pas', () => {
    expect(incoherence({ ...exemple('etape.vue'), etape: 'ET9' } as never, fiche)).toContain('ET9')
    expect(
      incoherence({ ...exemple('pratique.resultat'), exercice: 'PR9' } as never, fiche),
    ).toContain('PR9')
    expect(
      incoherence({ ...exemple('pratique.resultat'), item: 'PR1-9' } as never, fiche),
    ).toContain('PR1-9')
    expect(
      incoherence({ ...exemple('bilan.erreurs'), ids: ['E1', 'E8', 'E9'] } as never, fiche),
    ).toContain('E8')
    expect(incoherence(exemple('atelier.resultat'), sansAtelierNiAisance)).toContain('atelier')
    expect(incoherence(exemple('aisance.resultat'), sansAtelierNiAisance)).toContain('aisance')
  })

  it('seul page.prete est sans effet', () => {
    expect(estSansEffet(exemple('page.prete'))).toBe(true)
    expect(estSansEffet(exemple('pretest.reponse'))).toBe(false)
  })
})
