import { CodeManque } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { formaterDelai, formaterInstant } from './instant.ts'
import { STATUT_SUIVANT, texteManque } from './textesManquants.ts'

const MAINTENANT = '2026-10-06T10:00:00.000Z'

describe('texteManque', () => {
  it.each(CodeManque.options)('%s a sa phrase', (code) => {
    const texte = texteManque(
      {
        code,
        questions: ['R2'],
        exercices: ['EX1'],
        erreurs: ['E1'],
        apres: '2026-10-06T13:20:00.000Z',
        points: 3,
        requis: 4,
      },
      MAINTENANT,
    )

    expect(texte.length).toBeGreaterThan(10)
    expect(texte.endsWith('.')).toBe(true)
  })

  it('cite les questions, exercices et erreurs concernés', () => {
    expect(
      texteManque({ code: 'restitution_incomplete', questions: ['R2', 'R3'] }, MAINTENANT),
    ).toBe('Envoie ta réponse aux questions de restitution : R2, R3.')
    expect(texteManque({ code: 'erreur_ouverte', erreurs: ['E1'] }, MAINTENANT)).toContain('E1')
    expect(texteManque({ code: 'pratique_aide', exercices: ['EX1'] }, MAINTENANT)).toContain('EX1')
    expect(
      texteManque({ code: 'consolidation_insuffisante', points: 3, requis: 4 }, MAINTENANT),
    ).toBe('Atteins le seuil à la consolidation : 3 points sur 4 requis.')
  })

  it('sait dire un manque sans détail', () => {
    expect(texteManque({ code: 'restitution_incomplete' }, MAINTENANT)).toBe(
      'Envoie ta réponse à toutes les questions de restitution.',
    )
  })
})

describe('STATUT_SUIVANT', () => {
  it('suit l’échelle des statuts, maîtrisé n’a pas de suivant', () => {
    expect(STATUT_SUIVANT.vu).toBe('acquis_provisoirement')
    expect(STATUT_SUIVANT.maitrise).toBeNull()
  })
})

describe('formaterInstant', () => {
  it('écrit « 15 h 20 » le jour même et ajoute la date sinon', () => {
    const quinzeVingt = new Date(2026, 9, 6, 15, 20).toISOString()
    const midi = new Date(2026, 9, 6, 12, 0).toISOString()
    const lendemain = new Date(2026, 9, 7, 9, 5).toISOString()

    expect(formaterInstant(quinzeVingt, midi)).toBe('15 h 20')
    expect(formaterInstant(lendemain, midi)).toBe('7 octobre à 9 h 05')
  })

  it('passe à la date quand la consolidation tombe après minuit', () => {
    const tard = new Date(2026, 9, 6, 23, 30).toISOString()
    const apresMinuit = new Date(2026, 9, 7, 0, 30).toISOString()

    expect(formaterInstant(apresMinuit, tard)).toBe('7 octobre à 0 h 30')
  })
})

describe('formaterDelai', () => {
  it.each([
    [60, '1 h'],
    [45, '45 min'],
    [90, '1 h 30'],
    [1440, '24 h'],
  ])('%i minutes : %s', (minutes, attendu) => {
    expect(formaterDelai(minutes)).toBe(attendu)
  })

  it('erreur_ouverte : écrit le nom de l’erreur, pas son identifiant', () => {
    const phrase = texteManque(
      { code: 'erreur_ouverte', erreurs: ['confond_compilateur_interpreteur'] },
      '2026-10-10T12:00:00Z',
      () => 'Confond compilateur et interpréteur',
    )
    expect(phrase).toBe(
      'Réussis une question sur chaque erreur ouverte : Confond compilateur et interpréteur.',
    )
  })
})
