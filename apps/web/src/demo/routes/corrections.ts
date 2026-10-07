import { corrigerSimule, DELAI_CORRECTION_SIMULEE_MS, ErreurApi, ROUTES } from '@janus/contrats'
import type { CorrectionRecue } from '@janus/contrats'
import { compte, estRecopiee } from '@janus/moteur'
import { MANIFESTES_GRAINE } from '../graine.ts'
import { dejaRecu, enregistrer, faitsDuBloc, resultatDuBloc, statutBloc } from './calculs.ts'
import { serieDuJour } from './aujourdhui.ts'
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
    definir(ROUTES['POST /corrections/:id/accord'], ({ magasin, params }) => {
      // Les avis d'Amine ne changent aucun statut : la démo les accepte sans les garder.
      if (!magasin.lire().faits.some((fait) => fait.id === params.id)) {
        throw probleme(404, 'introuvable', 'Introuvable', 'Cette correction n’existe pas.')
      }
      return null
    }),
    definir(ROUTES['POST /corrections/:id/trancher'], ({ magasin, horloge, params, corps }) => {
      const correction = magasin
        .lire()
        .faits.find((fait) => fait.type === 'correction' && fait.id === params.id)
      if (correction === undefined) {
        throw probleme(404, 'introuvable', 'Introuvable', 'Cette correction n’existe pas.')
      }
      if (!dejaRecu(magasin.lire(), corps.id)) {
        enregistrer(magasin, corps.id, [
          {
            id: corps.id,
            bloc: correction.bloc,
            date: horloge.maintenant(),
            type: 'correction_tranchee',
            correction: correction.id,
            compte: corps.compte,
            ...(corps.niveau === undefined ? {} : { niveau: corps.niveau }),
            ...(corps.raison === undefined ? {} : { raison: corps.raison }),
          },
        ])
      }
      return statutBloc(resultatDuBloc(magasin.lire(), correction.bloc, horloge.maintenant()))
    }),
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
      if (serie === 'verification') {
        throw probleme(
          501,
          'erreur_interne',
          'Pas encore codé',
          `La démo ne corrige pas encore la série « ${serie} ».`,
        )
      }
      // Une question de début de séance ne donne pas son bloc : la démo le retrouve par la question.
      const codeBloc =
        serie === 'rappel'
          ? serieDuJour(magasin, horloge.maintenant()).questions.find(
              ({ question: id }) => id === corps.question,
            )?.bloc
          : corps.bloc
      const manifeste = codeBloc === undefined ? undefined : MANIFESTES_GRAINE[codeBloc]
      const question = manifeste?.[serie].find(({ id }) => id === corps.question)
      if (manifeste === undefined || question === undefined) {
        throw probleme(
          404,
          'introuvable',
          'Introuvable',
          `La question « ${corps.question} » n’existe pas.`,
        )
      }

      const precedentes = faitsDuBloc(magasin.lire(), manifeste.bloc).filter(
        (fait) =>
          fait.type === 'correction' && fait.serie === serie && fait.question === question.id,
      )
      const contestee = corps.conteste === true ? precedentes.at(-1) : undefined
      if (corps.conteste === true && contestee === undefined) {
        throw probleme(
          400,
          'donnees_invalides',
          'Contestation invalide',
          'Aucune correction précédente à contester.',
        )
      }

      await attendre(delaiCorrectionMs)
      const correction = corrigerSimule(corps.reponse, question.attendu)
      if (correction.refusee) {
        throw probleme(400, 'donnees_invalides', 'Réponse refusée', correction.message)
      }

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
      const proposee = manifeste.erreurs_critiques[0]?.id
      const erreurs =
        interrupteurs.erreurIa && proposee !== undefined
          ? [proposee]
          : correction.niveau === 'solide'
            ? []
            : question.erreurs

      // Une correction de premier tour sur dix est mise à l'avis d'Amine : la 1re, la 11e, etc.
      // Seules comptent les corrections rendues par cette démo, pas celles de la graine.
      const { faits, idsRecus } = magasin.lire()
      const premiersTours = faits.filter(
        (fait) => fait.type === 'correction' && fait.tour === 1 && idsRecus.includes(fait.id),
      )
      const rang = premiersTours.findIndex((fait) => fait.id === corps.id)
      const echantillon =
        tour === 1 &&
        (rang === -1 ? premiersTours.length : rang) % reglages.echantillonControle === 0
      if (!dejaRecu(magasin.lire(), corps.id)) {
        const date = horloge.maintenant()
        enregistrer(magasin, corps.id, [
          ...(contestee === undefined
            ? []
            : [
                {
                  id: `${corps.id}:contestation`,
                  bloc: manifeste.bloc,
                  date,
                  type: 'correction_contestee' as const,
                  correction: contestee.id,
                },
              ]),
          {
            id: corps.id,
            bloc: manifeste.bloc,
            date,
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
        echantillon,
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
      if (serie === 'rappel') {
        const { jour } = serieDuJour(magasin, horloge.maintenant())
        magasin.ecrire((etat) => {
          const avant = etat.rappels[question.id]
          return {
            ...etat,
            rappels: {
              ...etat.rappels,
              [question.id]: {
                jour,
                bloc: manifeste.bloc,
                confiance: avant?.confiance ?? corps.confiance,
                reponse: avant?.reponse ?? corps.reponse,
                correction: recue,
              },
            },
          }
        })
      }
      return recue
    }),
  ]
}
