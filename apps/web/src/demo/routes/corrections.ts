import { corrigerSimule, DELAI_CORRECTION_SIMULEE_MS, ErreurApi, ROUTES } from '@janus/contrats'
import type { CorrectionRecue } from '@janus/contrats'
import { compte, estRecopiee } from '@janus/moteur'
import { MANIFESTES_GRAINE } from '../graine.ts'
import { dejaRecu, enregistrer, faitsDuBloc } from './calculs.ts'
import { definir } from './definir.ts'

export interface OptionsCorrections {
  /** Délai simulé de la correction, en millisecondes (800 par défaut). */
  readonly delaiCorrectionMs?: number
}

function probleme(
  status: number,
  code: ConstructorParameters<typeof ErreurApi>[0]['code'],
  titre: string,
  detail: string,
) {
  return new ErreurApi({ status, code, titre, detail })
}

export function routesCorrectionsDemo({
  delaiCorrectionMs = DELAI_CORRECTION_SIMULEE_MS,
}: OptionsCorrections = {}) {
  return [
    definir(ROUTES['POST /corrections'], async ({ magasin, horloge, attendre, corps }) => {
      const { interrupteurs, reglages } = magasin.lire()
      if (interrupteurs.correctionIndisponible) {
        throw probleme(
          503,
          'erreur_interne',
          'Correction indisponible',
          'La correction ne répond pas.',
        )
      }
      if (interrupteurs.plafondAtteint) {
        throw probleme(
          429,
          'budget_atteint',
          'Plafond atteint',
          'Le plafond mensuel de l’IA est atteint.',
        )
      }
      const { serie } = corps
      if (serie !== 'restitution' && serie !== 'consolidation') {
        throw probleme(
          501,
          'erreur_interne',
          'Pas encore codé',
          `La démo ne corrige pas encore la série « ${serie} ».`,
        )
      }
      const manifeste = corps.bloc === undefined ? undefined : MANIFESTES_GRAINE[corps.bloc]
      const question = manifeste?.[serie].find(({ id }) => id === corps.question)
      if (manifeste === undefined || question === undefined) {
        throw probleme(
          404,
          'introuvable',
          'Introuvable',
          `La question « ${corps.question} » n’existe pas.`,
        )
      }

      await attendre(delaiCorrectionMs)
      const correction = corrigerSimule(corps.reponse, question.attendu)
      if (correction.refusee) {
        throw probleme(400, 'donnees_invalides', 'Réponse refusée', correction.message)
      }

      const precedentes = faitsDuBloc(magasin.lire(), manifeste.bloc).filter(
        (fait) =>
          fait.type === 'correction' && fait.serie === serie && fait.question === question.id,
      )
      const dernierPremierTour = precedentes.findLastIndex(
        (fait) => fait.type === 'correction' && fait.tour === 1,
      )
      const tour =
        corps.relance.trim() === '' ? 1 : Math.max(2, precedentes.length - dernierPremierTour + 1)
      const certitude: CorrectionRecue['certitude'] = interrupteurs.correctionNonVerifiee
        ? 'non_verifie'
        : 'sur'
      const resultat = compte({
        tour,
        colle: corps.support.colle,
        retourCours: corps.support.retour_cours,
        recopiee: estRecopiee(corps.reponse, [question.attendu], reglages.seuilRecopie),
        certitude,
      })
      const erreurs = correction.niveau === 'solide' ? [] : question.erreurs

      if (!dejaRecu(magasin.lire(), corps.id)) {
        enregistrer(magasin, corps.id, [
          {
            id: corps.id,
            bloc: manifeste.bloc,
            date: horloge.maintenant(),
            type: 'correction',
            serie,
            question: question.id,
            tour,
            niveau: correction.niveau,
            compte: resultat.compte,
            ...(resultat.compte ? {} : { raisonNonCompte: resultat.raison }),
            confiance: corps.confiance,
            erreursIa: erreurs,
          },
        ])
      }
      const recue: CorrectionRecue = {
        id: corps.id,
        echantillon: false,
        question: question.id,
        tour,
        message: [correction.message, correction.indice].filter((t) => t !== undefined).join(' '),
        niveau: correction.niveau,
        erreurs_critiques: erreurs,
        source: 'support',
        ref: question.id,
        certitude,
        compte: resultat.compte,
        ...(resultat.compte ? {} : { raison_non_compte: resultat.raison }),
      }
      return recue
    }),
  ]
}
