import type { Tache } from '@janus/contrats'
import { accorder } from '../catalogue/calculs.ts'
import { formaterDate } from '../format.ts'

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const
const DECALAGES_SAKAMOTO = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const

/** « mardi 6 octobre » depuis un jour `AAAA-MM-JJ`, sans passer par l'horloge. */
export function dateLongue(jour: string): string {
  const [annee = 0, mois = 1, numero = 1] = jour.split('-').map(Number)
  const an = mois < 3 ? annee - 1 : annee
  const semaine =
    (an +
      Math.floor(an / 4) -
      Math.floor(an / 100) +
      Math.floor(an / 400) +
      (DECALAGES_SAKAMOTO[mois - 1] ?? 0) +
      numero) %
    7
  return `${JOURS[semaine] ?? ''} ${String(numero)} ${MOIS[mois - 1] ?? ''}`
}

export const TEXTES_AUJOURDHUI = {
  titreEcran: 'Aujourd’hui',
  chargement: 'Chargement…',
  erreur: 'Impossible de charger cet écran.',
  reessayer: 'Réessayer',
  prochaineEtape: 'Prochaine étape',
  progression: 'Progression',
  commencer: 'Commencer la séance',
  continuer: 'Continuer la séance',
  auProgramme: 'Au programme',
  toutFait: 'Rien d’autre n’est dû aujourd’hui.',
  avancer: 'Avancer dans le bloc en cours',
  voirJournal: 'Voir le journal',
  chaqueBloc:
    'Chaque bloc alterne cours, questions, restitution et vérifications pour construire une maîtrise durable.',
  commencerPremier: 'Commencer',
  votreModule: 'Ton module',
  legende: 'Légende des statuts',
  voirTableau: 'Voir le tableau de bord',
  grille: 'Blocs du module',
  aucunModule: 'Aucun module n’est encore importé.',
} as const

export const texteRetour = (jours: number) =>
  `Tu reviens après ${String(jours)} jours. On commence par ce qui est en retard, puis le bloc en cours.`

export const texteNombreTaches = (faites: number, total: number) =>
  faites === 0
    ? accorder(total, 'tâche', 'tâches')
    : `${String(faites)} sur ${String(total)} faites`

export const texteEtape = (rang: number, total: number) =>
  `${TEXTES_AUJOURDHUI.prochaineEtape} · ${String(rang)} sur ${String(total)}`

export interface TexteTache {
  readonly type: string
  readonly titre: string
  readonly complement: string
}

/** Ce que la ligne de la tâche annonce ; `titreBloc` donne le titre court d'un code de bloc. */
export function texteTache(
  tache: Tache,
  titreBloc: (bloc: string) => string,
  aujourdhui: string,
): TexteTache {
  const du = (jour: string) => `Dû ${formaterDate(jour, aujourdhui)}`
  const bloc = (code: string) => `${code} ${titreBloc(code)}`
  switch (tache.type) {
    case 'reprendre_erreur':
      return { type: 'Erreur à reprendre', titre: tache.libelle, complement: bloc(tache.bloc) }
    case 'questions_debut':
      return {
        type: 'Questions de début de séance',
        titre: accorder(tache.nombre, 'question', 'questions'),
        complement: 'Mélangées entre les blocs vus',
      }
    case 'reprise':
      return {
        type: 'Reprise',
        titre: tache.blocs.map((code) => bloc(code)).join(', '),
        complement: 'À reprendre',
      }
    case 'verification':
      return { type: 'Vérification', titre: bloc(tache.bloc), complement: du(tache.apres) }
    case 'retest':
      return {
        type: 'Vérifications et retests',
        titre: bloc(tache.bloc),
        complement: du(tache.apres),
      }
    case 'entretien':
      return { type: 'Entretien', titre: bloc(tache.bloc), complement: du(tache.apres) }
    case 'consolidation':
      return { type: 'Consolidation', titre: bloc(tache.bloc), complement: 'Après la restitution' }
    case 'cartes':
      return {
        type: 'Cartes',
        titre: accorder(tache.dues + tache.nouvelles, 'carte', 'cartes'),
        complement: `${accorder(tache.dues, 'due', 'dues')} · ${accorder(tache.nouvelles, 'nouvelle', 'nouvelles')}`,
      }
    case 'bloc':
      return { type: 'Bloc en cours', titre: bloc(tache.bloc), complement: 'Continuer le bloc' }
  }
}
