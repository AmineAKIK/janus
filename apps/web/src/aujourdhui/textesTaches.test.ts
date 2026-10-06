import type { Tache } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { texteBlocsAcquis, texteNombreTaches, texteProgression } from './textes.ts'
import { texteTache } from './textesTaches.ts'

const contexte = {
  titreBloc: () => 'Langages',
  etape: () => ({ rang: 3, total: 8 }),
}
const texte = (tache: Tache) => texteTache(tache, contexte)

describe('textes des tâches', () => {
  it('erreur : titre avec le libellé, texte de Figma', () => {
    expect(
      texte({
        type: 'reprendre_erreur',
        bloc: 'B04',
        erreur: 'E1',
        libelle: 'Confond A et B',
        lien: '/blocs/B04',
      }),
    ).toEqual({
      titre: 'B04 : Confond A et B',
      texte: 'Une erreur critique reste ouverte. La corriger maintenant évite qu’elle se renforce.',
      complement: 'à reprendre',
    })
  })

  it('questions : pluriel et complément', () => {
    expect(texte({ type: 'questions_debut', nombre: 6 })).toMatchObject({
      texte:
        '6 questions mélangées sur ce que tu as déjà vu. Te tester de mémoire, c’est ce qui fixe le mieux.',
      complement: '6 questions',
    })
    expect(texte({ type: 'questions_debut', nombre: 1 }).complement).toBe('1 question')
  })

  it('plusieurs vérifications au retour', () => {
    expect(texte({ type: 'reprise', blocs: ['B01', 'B02', 'B03'] })).toEqual({
      titre: 'Vérifications et retests',
      texte: '3 vérifications sans indice pour réactiver ce qui s’est effacé pendant la pause.',
      complement: '3 blocs, sans indice',
    })
  })

  it('cartes et bloc', () => {
    expect(texte({ type: 'cartes', dues: 18, nouvelles: 0 })).toMatchObject({
      texte: '18 cartes dues. Quelques minutes, et ce que tu sais reste en mémoire.',
      complement: '18 dues',
    })
    expect(texte({ type: 'bloc', bloc: 'B03' })).toMatchObject({
      texte: 'Reprendre B03 Langages à l’étape 3 sur 8.',
      complement: 'étape 3 sur 8',
    })
  })

  it('compteurs de l’en-tête et de la barre', () => {
    expect(texteNombreTaches(0, 1)).toBe('1 tâche')
    expect(texteNombreTaches(0, 9)).toBe('9 tâches')
    expect(texteNombreTaches(9, 9)).toBe('9 sur 9 faites')
    expect(texteProgression(1, 9)).toBe('1 faite sur 9')
    expect(texteProgression(2, 9)).toBe('2 faites sur 9')
    expect(texteBlocsAcquis(1, 20)).toBe('1 bloc acquis sur 20')
  })
})
