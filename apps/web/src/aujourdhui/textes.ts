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
} as const

export const texteRetour = (jours: number) =>
  `Tu reviens après ${String(jours)} jours. On commence par ce qui est en retard, puis le bloc en cours.`

/** « 1 tâche », « 9 tâches », ou « 9 sur 9 faites » quand tout est fait. */
export function texteNombreTaches(faites: number, total: number): string {
  if (total > 0 && faites === total) return `${String(total)} sur ${String(total)} faites`
  return `${String(total)} ${total < 2 ? 'tâche' : 'tâches'}`
}

export const texteEtape = (rang: number, total: number) =>
  `${TEXTES_AUJOURDHUI.prochaineEtape} · ${String(rang)} sur ${String(total)}`

/** « 0 faite sur 9 », « 2 faites sur 9 ». */
export const texteProgression = (faites: number, total: number) =>
  `${String(faites)} ${faites < 2 ? 'faite' : 'faites'} sur ${String(total)}`

export const texteBlocsAcquis = (acquis: number, total: number) =>
  `${String(acquis)} ${acquis < 2 ? 'bloc acquis' : 'blocs acquis'} sur ${String(total)}`
