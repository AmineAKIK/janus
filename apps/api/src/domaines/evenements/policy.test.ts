import { EXEMPLES_PAGE, MessagePage } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import {
  decisionsDuBilan,
  empreinteDuMessage,
  enregistrementDe,
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
    ['pretest.reponse', 'pretest.reponse', {}, null, false],
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
      'restitution.demande',
    ])
  })
})

describe('decisionsDuBilan', () => {
  it.each([
    [[], ['E1'], ['E1'], []],
    [['E1'], ['E1'], [], []],
    [['E1', 'E2'], ['E2'], [], ['E1']],
    [['E1'], [], [], ['E1']],
    [[], [], [], []],
  ])('ouvertes %j, cochées %j', (ouvertes, cochees, aCocher, aDecocher) => {
    expect(decisionsDuBilan(ouvertes, cochees)).toEqual({ aCocher, aDecocher })
  })
})
