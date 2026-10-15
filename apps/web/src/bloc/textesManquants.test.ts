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
    ).toBe('Envoie ta réponse aux questions R2 et R3 de la restitution.')
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

describe('les noms que l’apprenant lit dans la fiche', () => {
  const libelles = {
    exercice: (id: string) => ({ PR1: '« Convertir »', PR2: '« Raisonner »' })[id] ?? id,
    question: (id: string) => id.slice(1),
  }

  it('nomme les exercices par leur titre, jamais par leur identifiant', () => {
    expect(
      texteManque({ code: 'pratique_aide', exercices: ['PR1', 'PR2'] }, MAINTENANT, libelles),
    ).toBe('Réussis sans aide les exercices « Convertir » et « Raisonner ».')
    expect(texteManque({ code: 'pratique_aide', exercices: ['PR1'] }, MAINTENANT, libelles)).toBe(
      'Réussis sans aide l’exercice « Convertir ».',
    )
  })

  it('donne le rang des questions qui restent', () => {
    expect(
      texteManque(
        { code: 'restitution_incomplete', questions: ['R1', 'R3', 'R5'] },
        MAINTENANT,
        libelles,
      ),
    ).toBe('Envoie ta réponse aux questions 1, 3 et 5 de la restitution.')
    expect(
      texteManque({ code: 'restitution_incomplete', questions: ['R2'] }, MAINTENANT, libelles),
    ).toBe('Envoie ta réponse à la question 2 de la restitution.')
  })
})

describe('consolidation_insuffisante : les nombres à la française', () => {
  it('écrit la virgule et accorde « point »', () => {
    expect(
      texteManque({ code: 'consolidation_insuffisante', points: 0.5, requis: 0.8 }, MAINTENANT),
    ).toBe('Atteins le seuil à la consolidation : 0,5 point sur 0,8 requis.')
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

    expect(formaterInstant(quinzeVingt, midi)).toBe('15\u00a0h\u00a020')
    expect(formaterInstant(lendemain, midi)).toBe('7\u00a0octobre à 9\u00a0h\u00a005')
  })

  it('passe à la date quand la consolidation tombe après minuit', () => {
    const tard = new Date(2026, 9, 6, 23, 30).toISOString()
    const apresMinuit = new Date(2026, 9, 7, 0, 30).toISOString()

    expect(formaterInstant(apresMinuit, tard)).toBe('7\u00a0octobre à 0\u00a0h\u00a030')
  })
})

describe('formaterDelai', () => {
  it.each([
    [60, '1\u00a0h'],
    [45, '45\u00a0min'],
    [90, '1\u00a0h\u00a030'],
    [1440, '24\u00a0h'],
  ])('%i minutes : %s', (minutes, attendu) => {
    expect(formaterDelai(minutes)).toBe(attendu)
  })

  it('erreur_ouverte : écrit le nom de l’erreur, pas son identifiant', () => {
    const phrase = texteManque(
      { code: 'erreur_ouverte', erreurs: ['confond_compilateur_interpreteur'] },
      '2026-10-10T12:00:00Z',
      { erreur: () => 'Confond compilateur et interpréteur' },
    )
    expect(phrase).toBe(
      'Réussis une question sur chaque erreur ouverte : Confond compilateur et interpréteur.',
    )
  })
})

describe('formaterInstant dans le fuseau des réglages', () => {
  it("écrit l'heure du fuseau demandé, quel que soit celui de l'appareil", () => {
    const instant = '2026-10-06T13:20:00Z'
    const midi = '2026-10-06T10:00:00Z'
    expect(formaterInstant(instant, midi, 'Europe/Paris')).toBe('15\u00a0h\u00a020')
    expect(formaterInstant(instant, midi, 'America/New_York')).toBe('9\u00a0h\u00a020')
  })

  it('compare les jours dans ce fuseau : 23 h 30 à Paris est encore le même jour', () => {
    const tard = '2026-10-06T21:30:00Z'
    const minuit = '2026-10-06T22:30:00Z'
    expect(formaterInstant(minuit, tard, 'Europe/Paris')).toBe('7\u00a0octobre à 0\u00a0h\u00a030')
    expect(formaterInstant(minuit, tard, 'UTC')).toBe('22\u00a0h\u00a030')
  })
})
