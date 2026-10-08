import { createHash } from 'node:crypto'
import { CorrectionRecue, Manifeste, Reglages, TypeVerification, nouvelId } from '@janus/contrats'
import type { NoteCarte } from '@janus/contrats'
import { ajouterJours, instantEnMs, jourDe } from '@janus/moteur'
import { z } from 'zod'
import type { Base } from '../../base/base.ts'
import { lireFaits } from '../../base/faits.ts'
import { verrouBloc } from '../../base/transaction.ts'
import { Conflit, ContenuDifferent, Introuvable } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import type { DepotRevisions } from './depot.ts'
import {
  apresNote,
  cartesAFaire,
  contexteDuJour,
  EtatGarde,
  tirerQuestionsDuJour,
} from './policy.ts'
import {
  dateDue,
  EvenementPartie,
  EvenementReport,
  EvenementResultat,
  partieVisible,
  revuRecemment,
  Tirage,
  tirerParties,
} from './verification.ts'

const SerieGardee = z.array(z.strictObject({ bloc: z.string(), question: z.string() }))

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotRevisions
  readonly horloge: Horloge
}

function empreinte(contenu: unknown): string {
  return createHash('sha256').update(JSON.stringify(contenu)).digest('hex')
}

export function creerServiceRevisions({ base, depot, horloge }: DependancesService) {
  /** Les réglages, le plan, les faits et le contexte du jour : le point de départ de chaque route. */
  async function charger(userId: string) {
    const maintenant = horloge.maintenant()
    const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
    const plan = await depot.blocsDuPlan(base.db)
    const faits = await lireFaits(
      base.db,
      userId,
      plan.map(({ id, code }) => ({ id, code })),
    )
    return {
      maintenant,
      reglages,
      plan,
      faits,
      contexte: contexteDuJour(plan, faits, reglages, maintenant),
    }
  }

  /** Une vérification de l'utilisateur, son bloc et tout ce qui lui est arrivé. */
  async function chargerVerification(userId: string, id: string) {
    const charge = await charger(userId)
    const ligne = await depot.verificationParId(base.db, userId, id)
    const bloc =
      ligne === undefined ? undefined : charge.plan.find(({ id: b }) => b === ligne.blocId)
    if (ligne === undefined || bloc === undefined) {
      throw new Introuvable("Cette vérification n'existe pas.")
    }
    const evenements = await depot.evenementsDeVerification(base.db, userId, id)
    return { ...charge, ligne, bloc, manifeste: Manifeste.parse(bloc.manifeste), evenements }
  }

  return {
    /**
     * L'identifiant de la vérification ouverte d'un bloc, tirée à la première demande : l'écran
     * Aujourd'hui en a besoin pour son lien. Une vérification terminée n'est jamais rouverte.
     */
    async verificationPour(userId: string, codeBloc: string, type: TypeVerification) {
      const { maintenant, reglages, plan, faits } = await charger(userId)
      const bloc = plan.find(({ code }) => code === codeBloc)
      if (bloc === undefined) throw new Introuvable(`Le bloc « ${codeBloc} » n'existe pas.`)
      return base.enTransaction(async (tx) => {
        await verrouBloc(tx, userId, bloc.id)
        const ouverte = await depot.verificationOuverte(tx, userId, bloc.id, type)
        if (ouverte !== undefined) return ouverte.id
        const id = nouvelId(instantEnMs(maintenant))
        await depot.ajouterTirage(tx, {
          id,
          userId,
          blocId: bloc.id,
          type,
          tirage: tirerParties(Manifeste.parse(bloc.manifeste), faits, reglages, maintenant),
          dateServeur: maintenant,
        })
        return id
      })
    },

    /** La vérification telle que la page la lit : sans code ni titre du bloc avant le résultat. */
    async verification(userId: string, id: string) {
      const { maintenant, reglages, faits, contexte, ligne, bloc, manifeste, evenements } =
        await chargerVerification(userId, id)
      const envoyees = new Set(
        evenements.flatMap(({ type, donnees }) =>
          type === 'verification_partie' ? [EvenementPartie.parse(donnees).partie] : [],
        ),
      )
      const resultat = evenements
        .filter(({ type }) => type === 'verification_resultat')
        .map(({ donnees }) => EvenementResultat.parse(donnees).resultat)
        .at(-1)
      const report = evenements
        .filter(({ type }) => type === 'verification_reportee')
        .map(({ donnees }) => EvenementReport.parse(donnees).jusqua)
        .at(-1)
      const etat = contexte.blocs.find(({ manifeste: m }) => m.bloc === bloc.code)?.etat
      if (etat === undefined) throw new Introuvable("Ce bloc n'existe pas.")
      const commencee = evenements.some(({ type }) => type === 'verification_partie')
      return {
        id: ligne.id,
        type: TypeVerification.parse(ligne.type),
        due_le: dateDue(etat, reglages, maintenant, report ?? null),
        terminee: resultat !== undefined,
        revu_recemment:
          resultat !== undefined || commencee
            ? null
            : revuRecemment(
                faits.filter((fait) => fait.bloc === bloc.code),
                reglages,
                maintenant,
              ),
        parties: Tirage.parse(ligne.tirage).flatMap(({ id: partie }) => {
          const differee = manifeste.differees.find((autre) => autre.id === partie)
          return differee === undefined ? [] : [partieVisible(differee, envoyees.has(partie))]
        }),
        resultat: resultat ?? null,
      }
    },

    /** Reporte la vérification à demain ; rejouer le même message rend le même jour. */
    async reporterVerification(userId: string, id: string, evenementId: string) {
      const { maintenant, reglages, ligne, bloc } = await chargerVerification(userId, id)
      return base.enTransaction(async (tx) => {
        await verrouBloc(tx, userId, bloc.id)
        const evenements = await depot.evenementsDeVerification(tx, userId, ligne.id)
        if (evenements.some(({ type }) => type === 'verification_resultat')) {
          throw new Conflit('Cette vérification est terminée.')
        }
        const demain = ajouterJours(jourDe(maintenant, reglages.fuseau, reglages.heureBascule), 1)
        const donnees = { verification: ligne.id, jusqua: demain }
        const ajoute = await depot.ajouterEvenement(tx, {
          id: evenementId,
          userId,
          blocId: bloc.id,
          ficheVersionId: bloc.versionId,
          type: 'verification_reportee',
          donnees,
          empreinte: empreinte(donnees),
          dateServeur: maintenant,
        })
        if (ajoute) return { due_le: demain }
        const gardee = await depot.evenementParId(tx, userId, evenementId)
        const jusqua = EvenementReport.safeParse(gardee?.donnees)
        if (!jusqua.success) {
          throw new ContenuDifferent('Cet identifiant a déjà servi pour un autre contenu.')
        }
        return { due_le: jusqua.data.jusqua }
      })
    },

    /** Les cartes dues et les nouvelles des blocs vus. */
    async cartesDues(userId: string) {
      const { maintenant, reglages, contexte } = await charger(userId)
      const catalogue = await depot.cartesActives(base.db)
      const revues = await depot.revuesDe(base.db, userId)
      const etats = new Map(
        revues.flatMap(({ carteId, etat }) => {
          const carte = catalogue.find(({ id }) => id === carteId)
          return carte === undefined
            ? []
            : [[`${carte.bloc}:${carte.carte}`, EtatGarde.parse(etat)] as const]
        }),
      )
      return cartesAFaire(catalogue, etats, contexte, reglages, maintenant)
    },

    /** Note une carte : FSRS calcule la suite, la note déjà reçue (même identifiant) ne change rien. */
    async noterCarte(userId: string, idCarte: string, noteId: string, note: NoteCarte) {
      const separateur = idCarte.indexOf(':')
      const trouvee =
        separateur < 0
          ? undefined
          : await depot.carteParCode(
              base.db,
              idCarte.slice(0, separateur),
              idCarte.slice(separateur + 1),
            )
      if (trouvee === undefined) throw new Introuvable(`La carte « ${idCarte} » n'existe pas.`)
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      return base.enTransaction(async (tx) => {
        await verrouBloc(tx, userId, trouvee.blocId)
        const maintenant = horloge.maintenant()
        const brut = await depot.revueDe(tx, userId, trouvee.id)
        const avant = brut === undefined ? null : EtatGarde.parse(brut)
        if (avant?.noteId === noteId) return { echeance: avant.echeance }
        const apres = apresNote(avant, note, noteId, maintenant, reglages)
        await depot.ecrireRevue(tx, {
          id: noteId,
          userId,
          carteId: trouvee.id,
          dueLe: apres.echeance,
          etat: apres,
        })
        return { echeance: apres.echeance }
      })
    },

    /**
     * La série de début de séance du jour, tirée une seule fois puis gardée : deux appels simultanés
     * rendent la même. Le bloc n'est donné qu'une fois la question corrigée.
     */
    async questionsDebut(userId: string) {
      const { maintenant, reglages, plan, faits, contexte } = await charger(userId)

      let gardee: unknown = await depot.serieDuJour(base.db, userId, contexte.jour)
      if (gardee === undefined) {
        const tirees = tirerQuestionsDuJour(contexte, faits, reglages).map(
          ({ bloc, question }) => ({ bloc, question }),
        )
        await base.enTransaction((tx) =>
          depot.garderSerie(tx, {
            id: nouvelId(instantEnMs(maintenant)),
            userId,
            jour: contexte.jour,
            questions: tirees,
            dateServeur: maintenant,
          }),
        )
        // Si une autre requête a gardé sa série avant, c'est la sienne qui fait foi pour tous.
        gardee = await depot.serieDuJour(base.db, userId, contexte.jour)
      }
      const serie = SerieGardee.parse(gardee)

      const blocsDeLaSerie = plan.filter(({ code }) => serie.some(({ bloc }) => bloc === code))
      const rappels = await depot.rappelsDe(
        base.db,
        userId,
        blocsDeLaSerie.map(({ id }) => id),
      )
      const duJour = rappels.filter(
        ({ date }) => jourDe(date, reglages.fuseau, reglages.heureBascule) === contexte.jour,
      )
      return {
        questions: serie.flatMap(({ bloc, question }) => {
          const leBloc = contexte.blocs.find(({ manifeste }) => manifeste.bloc === bloc)
          const texte = leBloc?.manifeste.rappel.find(({ id }) => id === question)
          const idDuBloc = plan.find(({ code }) => code === bloc)?.id
          if (texte === undefined) return []
          const reponses = duJour.filter(
            (ligne) => ligne.blocId === idDuBloc && ligne.questionId === question,
          )
          const premiere = reponses[0]
          const derniere = reponses.at(-1)
          return [
            {
              id: question,
              question: texte.question,
              deja:
                premiere === undefined || derniere === undefined
                  ? null
                  : {
                      bloc,
                      confiance: premiere.confiance,
                      reponse: premiere.reponse,
                      correction: CorrectionRecue.parse({
                        id: derniere.id,
                        echantillon: derniere.echantillon,
                        question,
                        tour: derniere.tour,
                        message: derniere.message,
                        niveau: derniere.niveau,
                        erreurs_critiques: derniere.erreursIds,
                        source: derniere.source,
                        ref: derniere.ref,
                        certitude: derniere.certitude,
                        compte: derniere.compte,
                        ...(derniere.raisonNonCompte === null
                          ? {}
                          : { raison_non_compte: derniere.raisonNonCompte }),
                      }),
                    },
            },
          ]
        }),
      }
    },
  }
}
export type ServiceRevisions = ReturnType<typeof creerServiceRevisions>
