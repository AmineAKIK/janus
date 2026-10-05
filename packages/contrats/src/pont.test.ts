import { describe, expect, it } from 'vitest'
import { EXEMPLES_APPLI, EXEMPLES_PAGE } from './pont.exemples.ts'
import {
  CodeManque,
  MessageAppli,
  MessagePage,
  TAILLE_MAX_ETAT_OCTETS,
  TAILLE_MAX_REPONSE,
} from './pont.ts'

const TYPES_PAGE = [
  'page.prete',
  'etape.vue',
  'pretest.reponse',
  'pratique.resultat',
  'atelier.resultat',
  'aisance.resultat',
  'restitution.demande',
  'bilan.erreurs',
  'etat.sauver',
  'correction.accord',
] as const
const TYPES_APPLI = [
  'etat.init',
  'restitution.correction',
  'statut.maj',
  'erreur',
  'etape.aller',
] as const

function sans(exemple: Record<string, unknown>, champ: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(exemple).filter(([cle]) => cle !== champ))
}

describe('les messages de la page vers l’appli', () => {
  it('a un exemple valide pour chaque message', () => {
    expect(Object.keys(EXEMPLES_PAGE).sort()).toEqual([...TYPES_PAGE].sort())
    for (const type of TYPES_PAGE) {
      const resultat = MessagePage.safeParse(EXEMPLES_PAGE[type])
      expect(resultat.success, type).toBe(true)
    }
  })

  it('refuse un message dont le type est inconnu', () => {
    expect(
      MessagePage.safeParse({ ...EXEMPLES_PAGE['etape.vue'], type: 'etape.perdue' }).success,
    ).toBe(false)
  })

  it('refuse un message auquel il manque l’un des champs communs', () => {
    for (const champ of ['id', 'bloc', 'version', 't', 'type']) {
      for (const type of TYPES_PAGE) {
        const exemple = sans(EXEMPLES_PAGE[type], champ)
        expect(MessagePage.safeParse(exemple).success, `${type} sans ${champ}`).toBe(false)
      }
    }
  })

  it('exige un identifiant UUID v7, un bloc valide, une version et une heure ISO', () => {
    const base = EXEMPLES_PAGE['etape.vue']
    expect(MessagePage.safeParse({ ...base, id: 'pas-un-uuid' }).success).toBe(false)
    expect(
      MessagePage.safeParse({ ...base, id: '550e8400-e29b-41d4-a716-446655440000' }).success,
    ).toBe(false)
    expect(MessagePage.safeParse({ ...base, bloc: 'b1' }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, version: 0 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, version: 1.5 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, t: 'hier' }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, t: '2026-06-01T12:00:00+02:00' }).success).toBe(true)
  })

  it('refuse un champ inconnu', () => {
    expect(MessagePage.safeParse({ ...EXEMPLES_PAGE['etape.vue'], en_trop: 1 }).success).toBe(false)
  })

  it('page.prete : le schéma est la version 2', () => {
    expect(MessagePage.safeParse({ ...EXEMPLES_PAGE['page.prete'], schema: 1 }).success).toBe(false)
    expect(MessagePage.safeParse(sans(EXEMPLES_PAGE['page.prete'], 'schema')).success).toBe(false)
  })

  it('etape.vue et pretest.reponse : champs vides ou trop longs refusés', () => {
    expect(MessagePage.safeParse({ ...EXEMPLES_PAGE['etape.vue'], etape: '' }).success).toBe(false)
    expect(
      MessagePage.safeParse({ ...EXEMPLES_PAGE['pretest.reponse'], question: '' }).success,
    ).toBe(false)
    expect(
      MessagePage.safeParse({
        ...EXEMPLES_PAGE['pretest.reponse'],
        reponse: 'a'.repeat(TAILLE_MAX_REPONSE + 1),
      }).success,
    ).toBe(false)
    expect(
      MessagePage.safeParse({
        ...EXEMPLES_PAGE['pretest.reponse'],
        reponse: 'a'.repeat(TAILLE_MAX_REPONSE),
      }).success,
    ).toBe(true)
  })

  it('pratique.resultat : aide de 0 à 4 et au moins un essai', () => {
    const base = EXEMPLES_PAGE['pratique.resultat']
    expect(MessagePage.safeParse({ ...base, aide: 5 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, aide: -1 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, essais: 0 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, reussi: 'oui' }).success).toBe(false)
    for (const champ of ['exercice', 'item', 'reussi', 'aide', 'essais']) {
      expect(MessagePage.safeParse(sans(base, champ)).success, champ).toBe(false)
    }
  })

  it('atelier.resultat : prédictions justes entières et aide de 0 à 4', () => {
    const base = EXEMPLES_PAGE['atelier.resultat']
    expect(MessagePage.safeParse({ ...base, predictions_justes: -1 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, predictions_justes: 1.5 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, aide: 9 }).success).toBe(false)
    expect(MessagePage.safeParse(sans(base, 'reussi')).success).toBe(false)
  })

  it('aisance.resultat : durée positive ou nulle', () => {
    const base = EXEMPLES_PAGE['aisance.resultat']
    expect(MessagePage.safeParse({ ...base, duree_s: -1 }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, duree_s: 0 }).success).toBe(true)
    expect(MessagePage.safeParse(sans(base, 'duree_s')).success).toBe(false)
  })

  it('restitution.demande : série, confiance, taille de la réponse et support', () => {
    const base = EXEMPLES_PAGE['restitution.demande']
    expect(MessagePage.safeParse({ ...base, serie: 'rappel' }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, serie: 'consolidation' }).success).toBe(true)
    expect(MessagePage.safeParse({ ...base, confiance: 'certain' }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, reponse: '' }).success).toBe(false)
    expect(
      MessagePage.safeParse({ ...base, reponse: 'a'.repeat(TAILLE_MAX_REPONSE + 1) }).success,
    ).toBe(false)
    expect(MessagePage.safeParse({ ...base, relance: '' }).success).toBe(true)
    expect(
      MessagePage.safeParse({ ...base, relance: 'a'.repeat(TAILLE_MAX_REPONSE + 1) }).success,
    ).toBe(false)
    expect(MessagePage.safeParse({ ...base, support: { colle: true } }).success).toBe(false)
    expect(
      MessagePage.safeParse({ ...base, support: { colle: true, retour_cours: false, x: 1 } })
        .success,
    ).toBe(false)
    for (const champ of ['serie', 'question', 'reponse', 'confiance', 'relance', 'support']) {
      expect(MessagePage.safeParse(sans(base, champ)).success, champ).toBe(false)
    }
  })

  it('bilan.erreurs : une liste d’identifiants, éventuellement vide', () => {
    const base = EXEMPLES_PAGE['bilan.erreurs']
    expect(MessagePage.safeParse({ ...base, ids: [] }).success).toBe(true)
    expect(MessagePage.safeParse({ ...base, ids: [''] }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, ids: 'E1' }).success).toBe(false)
  })

  it('etat.sauver : un objet JSON de 200 000 octets au plus', () => {
    const base = EXEMPLES_PAGE['etat.sauver']
    expect(MessagePage.safeParse({ ...base, etat: {} }).success).toBe(true)
    expect(MessagePage.safeParse({ ...base, etat: { a: [1, { b: null }, 'x'] } }).success).toBe(
      true,
    )
    expect(MessagePage.safeParse({ ...base, etat: 'texte' }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, etat: [1] }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, etat: { a: () => 1 } }).success).toBe(false)
    const rempli = (octets: number) => ({ texte: 'a'.repeat(octets - '{"texte":""}'.length) })
    expect(JSON.stringify(rempli(TAILLE_MAX_ETAT_OCTETS)).length).toBe(TAILLE_MAX_ETAT_OCTETS)
    expect(MessagePage.safeParse({ ...base, etat: rempli(TAILLE_MAX_ETAT_OCTETS) }).success).toBe(
      true,
    )
    expect(
      MessagePage.safeParse({ ...base, etat: rempli(TAILLE_MAX_ETAT_OCTETS + 1) }).success,
    ).toBe(false)
  })

  it('etat.sauver : compte les octets, pas les caractères', () => {
    const base = EXEMPLES_PAGE['etat.sauver']
    const accentues = 'é'.repeat(TAILLE_MAX_ETAT_OCTETS / 2)
    expect(MessagePage.safeParse({ ...base, etat: { texte: accentues } }).success).toBe(false)
  })

  it('correction.accord : l’identifiant de la correction et un booléen', () => {
    const base = EXEMPLES_PAGE['correction.accord']
    expect(MessagePage.safeParse({ ...base, correction: 'x' }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, accord: 'oui' }).success).toBe(false)
    expect(MessagePage.safeParse({ ...base, accord: false }).success).toBe(true)
    expect(MessagePage.safeParse(sans(base, 'accord')).success).toBe(false)
  })
})

describe('les messages de l’appli vers la page', () => {
  it('a un exemple valide pour chaque message', () => {
    expect(Object.keys(EXEMPLES_APPLI).sort()).toEqual([...TYPES_APPLI].sort())
    for (const type of TYPES_APPLI) {
      expect(MessageAppli.safeParse(EXEMPLES_APPLI[type]).success, type).toBe(true)
    }
  })

  it('refuse un type inconnu ou un champ en trop', () => {
    expect(
      MessageAppli.safeParse({ ...EXEMPLES_APPLI['etape.aller'], type: 'autre' }).success,
    ).toBe(false)
    expect(MessageAppli.safeParse({ ...EXEMPLES_APPLI['etape.aller'], en_trop: 1 }).success).toBe(
      false,
    )
  })

  it('etat.init : bloc, version, statut et séries ouvertes', () => {
    const base = EXEMPLES_APPLI['etat.init']
    expect(MessageAppli.safeParse({ ...base, etat: null }).success).toBe(true)
    expect(MessageAppli.safeParse({ ...base, etat: 'x' }).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, statut: 'inconnu' }).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, serie_ouverte: { restitution: true } }).success).toBe(
      false,
    )
    expect(MessageAppli.safeParse({ ...base, bloc: 'b' }).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, version: 0 }).success).toBe(false)
    for (const champ of ['bloc', 'version', 'etat', 'statut', 'serie_ouverte']) {
      expect(MessageAppli.safeParse(sans(base, champ)).success, champ).toBe(false)
    }
  })

  it('restitution.correction : niveau, source, certitude et raison de non-compte', () => {
    const base = EXEMPLES_APPLI['restitution.correction']
    expect(MessageAppli.safeParse({ ...base, niveau: 'moyen' }).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, source: 'inventee' }).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, certitude: 'peut-etre' }).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, tour: 0 }).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, id: 'x' }).success).toBe(false)
    expect(
      MessageAppli.safeParse({ ...base, compte: false, raison_non_compte: 'recopiee' }).success,
    ).toBe(true)
    expect(
      MessageAppli.safeParse({ ...base, compte: false, raison_non_compte: 'autre' }).success,
    ).toBe(false)
    expect(MessageAppli.safeParse({ ...base, erreurs_critiques: ['E1', 'E2'] }).success).toBe(true)
    expect(MessageAppli.safeParse({ ...base, erreurs_critiques: [''] }).success).toBe(false)
    for (const champ of [
      'id',
      'echantillon',
      'question',
      'tour',
      'message',
      'niveau',
      'erreurs_critiques',
      'source',
      'ref',
      'certitude',
      'compte',
    ]) {
      expect(MessageAppli.safeParse(sans(base, champ)).success, champ).toBe(false)
    }
  })

  it('statut.maj : le statut et ce qui manque, avec ses paramètres', () => {
    const base = EXEMPLES_APPLI['statut.maj']
    expect(MessageAppli.safeParse({ ...base, manque: [] }).success).toBe(true)
    expect(MessageAppli.safeParse({ ...base, manque: [{ code: 'inconnu' }] }).success).toBe(false)
    expect(
      MessageAppli.safeParse({ ...base, manque: [{ code: 'erreur_ouverte', x: 1 }] }).success,
    ).toBe(false)
    expect(MessageAppli.safeParse({ ...base, statut: 'bientot' }).success).toBe(false)
    expect(MessageAppli.safeParse(sans(base, 'manque')).success).toBe(false)
  })

  it('erreur : un code connu et un détail', () => {
    const base = EXEMPLES_APPLI['erreur']
    for (const code of ['correction_indisponible', 'plafond_atteint', 'message_refuse']) {
      expect(MessageAppli.safeParse({ ...base, code }).success, code).toBe(true)
    }
    expect(MessageAppli.safeParse({ ...base, code: 'panne' }).success).toBe(false)
    expect(MessageAppli.safeParse(sans(base, 'code')).success).toBe(false)
    expect(MessageAppli.safeParse({ ...base, message_id: 'x' }).success).toBe(false)
    expect(MessageAppli.safeParse(sans(base, 'message_id')).success).toBe(true)
  })

  it('etape.aller : une étape non vide', () => {
    expect(MessageAppli.safeParse({ type: 'etape.aller', etape: '' }).success).toBe(false)
    expect(MessageAppli.safeParse({ type: 'etape.aller' }).success).toBe(false)
  })
})

describe('CodeManque', () => {
  it('liste les codes que le moteur sait rendre', () => {
    expect(CodeManque.options).toContain('restitution_incomplete')
    expect(CodeManque.options).toContain('aisance_non_atteinte')
    expect(CodeManque.options).toHaveLength(13)
  })
})
