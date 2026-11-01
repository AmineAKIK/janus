import type { Tache } from '@janus/contrats'

export interface TexteTache {
  /** Le titre de la carte et de la ligne. */
  readonly titre: string
  /** Le texte de la carte « Prochaine étape ». */
  readonly texte: string
  /** Ce que la ligne « Au programme » ajoute à droite du titre. */
  readonly complement: string
}

export interface ContexteTexte {
  /** Le titre court d'un bloc ; vide s'il est inconnu. */
  readonly titreBloc: (bloc: string) => string
  /** L'étape où le bloc s'est arrêté, `null` si la page n'a pas d'étape enregistrée. */
  readonly etape: (bloc: string) => { readonly rang: number; readonly total: number } | null
}

const nombre = (n: number, singulier: string, pluriel: string) =>
  `${String(n)} ${n < 2 ? singulier : pluriel}`

/** Les textes de chaque type de tâche, ceux de Figma et, à défaut, ceux du ticket. */
export function texteTache(tache: Tache, contexte: ContexteTexte): TexteTache {
  const bloc = (code: string) => `${code} ${contexte.titreBloc(code)}`
  switch (tache.type) {
    case 'reprendre_erreur':
      return {
        titre: `${tache.bloc} : ${tache.libelle}`,
        texte:
          'Une erreur critique reste ouverte. La corriger maintenant évite qu’elle se renforce.',
        complement: 'à reprendre',
      }
    case 'questions_debut':
      return {
        titre: 'Questions de début de séance',
        texte: `${nombre(tache.nombre, 'question mélangée', 'questions mélangées')} sur ce que tu as déjà vu. Te tester de mémoire, c’est ce qui fixe le mieux.`,
        complement: nombre(tache.nombre, 'question', 'questions'),
      }
    case 'reprise':
      return {
        titre: 'Vérifications et retests',
        texte: `${nombre(tache.blocs.length, 'vérification sans indice', 'vérifications sans indice')} pour réactiver ce qui s’est effacé pendant la pause.`,
        complement: `${nombre(tache.blocs.length, 'bloc', 'blocs')}, sans indice`,
      }
    case 'verification':
    case 'retest':
    case 'entretien':
      return {
        titre: `Vérification de ${bloc(tache.bloc)}`,
        texte:
          'Une question, une petite tâche et un transfert, sans revoir le cours avant. C’est ce qui prouve que ça tient dans le temps.',
        complement: 'sans indice',
      }
    case 'cartes': {
      const total = tache.dues + tache.nouvelles
      if (total === 0) {
        return {
          titre: 'Révision des cartes',
          texte: 'Les cartes du jour sont révisées. Elles reviendront quand il sera temps.',
          complement: 'révisées',
        }
      }
      const detail = [
        tache.dues > 0 ? nombre(tache.dues, 'carte due', 'cartes dues') : null,
        tache.nouvelles > 0 ? nombre(tache.nouvelles, 'nouvelle carte', 'nouvelles cartes') : null,
      ]
        .filter((partie) => partie !== null)
        .join(' et ')
      return {
        titre: 'Révision des cartes',
        texte: `${detail}. Quelques minutes, et ce que tu sais reste en mémoire.`,
        complement: [
          tache.dues > 0 ? nombre(tache.dues, 'due', 'dues') : null,
          tache.nouvelles > 0 ? nombre(tache.nouvelles, 'nouvelle', 'nouvelles') : null,
        ]
          .filter((partie) => partie !== null)
          .join(', '),
      }
    }
    case 'pratique':
      return {
        titre: `Pratique de ${bloc(tache.bloc)}`,
        texte: `${nombre(tache.exercices.length, 'exercice', 'exercices')} à finir sans aide. Un item réussi avec de l’aide se refait sur un autre cas, après un autre item : c’est là qu’il compte.`,
        complement: `${nombre(tache.exercices.length, 'exercice', 'exercices')} sans aide`,
      }
    case 'bloc': {
      const etape = contexte.etape(tache.bloc)
      const suffixe =
        etape === null ? '' : ` à l’étape ${String(etape.rang)} sur ${String(etape.total)}`
      return {
        titre: bloc(tache.bloc),
        texte: `Reprendre ${bloc(tache.bloc)}${suffixe}.`,
        complement:
          etape === null ? 'en cours' : `étape ${String(etape.rang)} sur ${String(etape.total)}`,
      }
    }
  }
}
