import { CorrectionRendue, Manifeste, Reglages, TypeVerification, nouvelId } from '@janus/contrats'
import { estDeSecours } from '../../adaptateurs/correcteur/choix.ts'
import type { Fait, NoteCarte } from '@janus/contrats'
import {
  ajouterJours,
  calculerBloc,
  debutDuJour,
  ecartEnJours,
  fileDuJour,
  tachesDuJour,
  instantEnMs,
  JOURS_AVANT_RETARD,
  jourDe,
  validiteVerification,
} from '@janus/moteur'
import type { Base } from '../../base/base.ts'
import { empreinteJson } from '../../base/empreinte.ts'
import { SerieGardee } from '../../base/serieGardee.ts'
import { maintenantDeLaFormation, sousVerrouDuBloc } from '../../base/axeTemps.ts'
import { formationActiveDe } from '../../base/formationActive.ts'
import { creerCacheDesEtats } from '../../base/etatsDesBlocs.ts'
import type { CacheDesEtats } from '../../base/etatsDesBlocs.ts'
import { lireFaits } from '../../base/faits.ts'
import { verrouBloc } from '../../base/transaction.ts'
import { Conflit, ContenuDifferent, ErreurProtocole, Introuvable } from '../../erreurs.ts'
import { recalculer } from '../../recalcul.ts'
import type { CorrigerPartie } from '../../types.ts'
import type { Horloge } from '../../horloge.ts'
import { blocsReportes, estVerification, lienDeLaTache } from './aujourdhui.ts'
import type { DepotRevisions } from './depot.ts'
import {
  apresNote,
  cartesAFaire,
  contexteDepuisEtats,
  EtatGarde,
  moduleEnCours,
  tirerQuestionsDuJour,
} from './policy.ts'
import {
  construireResultat,
  corrigerTache,
  dateDue,
  EvenementPartie,
  EvenementReport,
  EvenementResultat,
  partieVisible,
  reponseDeFait,
  revuRecemment,
  Tirage,
  tirerParties,
} from './verification.ts'

export interface DependancesService {
  readonly corrigerPartie: CorrigerPartie
  readonly base: Base
  readonly depot: DepotRevisions
  readonly horloge: Horloge
  /** Les états des blocs gardés en mémoire ; un cache neuf par défaut. */
  readonly etats?: CacheDesEtats
}

export function creerServiceRevisions({
  base,
  depot,
  horloge,
  corrigerPartie,
  etats = creerCacheDesEtats(),
}: DependancesService) {
  type Chargement = Awaited<ReturnType<typeof charger>>

  /** Les réglages, le plan et l'instant : ce qu'il faut avant de lire le moindre fait. */
  async function chargerLeger(userId: string) {
    const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
    const formationId = await formationActiveDe(base.db, reglages.formationActive)
    const maintenant = await maintenantDeLaFormation(base.db, horloge, userId, formationId)
    const plan = await depot.blocsDuPlan(base.db, formationId)
    return { maintenant, reglages, formationId, plan }
  }

  /**
   * Les réglages, le plan, l'état de chaque bloc et le contexte du jour : le point de départ de chaque
   * route. Les blocs inchangés depuis la dernière lecture viennent de la mémoire (voir `etatsDesBlocs`).
   */
  async function charger(
    userId: string,
    leger?: Awaited<ReturnType<typeof chargerLeger>>,
    signal?: AbortSignal,
  ) {
    const { maintenant, reglages, formationId, plan } = leger ?? (await chargerLeger(userId))
    const etatsDesBlocs = await etats.etats(
      base.db,
      userId,
      plan.map(({ id, code, versionId, manifeste }) => ({ id, code, versionId, manifeste })),
      reglages,
      signal,
    )
    return {
      maintenant,
      reglages,
      formationId,
      plan,
      etatsDesBlocs,
      contexte: contexteDepuisEtats(plan, etatsDesBlocs, reglages, maintenant),
    }
  }

  /** Les faits de tous les blocs du plan (ceux qu'ont lus les états), pour ce qui les parcourt tous. */
  function tousLesFaits({ etatsDesBlocs }: Pick<Chargement, 'etatsDesBlocs'>): Fait[] {
    return [...etatsDesBlocs.values()].flatMap(({ faits }) => faits)
  }

  /**
   * Une vérification de l'utilisateur, son bloc et tout ce qui lui est arrivé. Aucun fait n'est lu :
   * les routes qui en ont besoin lisent ceux dont elles se servent.
   */
  async function chargerVerification(userId: string, id: string) {
    const charge = await chargerLeger(userId)
    const ligne = await depot.verificationParId(base.db, userId, id)
    const bloc =
      ligne === undefined ? undefined : charge.plan.find(({ id: b }) => b === ligne.blocId)
    if (ligne === undefined || bloc === undefined) {
      throw new Introuvable("Cette vérification n'existe pas.")
    }
    const evenements = await depot.evenementsDeVerification(base.db, userId, id)
    return { ...charge, ligne, bloc, manifeste: Manifeste.parse(bloc.manifeste), evenements }
  }

  async function cartesDe(
    userId: string,
    { maintenant, reglages, contexte, formationId }: Chargement,
  ) {
    const catalogue = await depot.cartesActives(base.db, formationId)
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
  }

  /** Les corrections données aujourd'hui aux questions de la série du jour. */
  async function rappelsDuJour(
    userId: string,
    serie: readonly { bloc: string; question: string }[],
    donnees: {
      plan: Chargement['plan']
      reglages: Chargement['reglages']
      contexte: Pick<Chargement['contexte'], 'jour'>
    },
  ) {
    const { plan, reglages, contexte } = donnees
    const blocsDeLaSerie = plan.filter(({ code }) => serie.some(({ bloc }) => bloc === code))
    const rappels = await depot.rappelsDe(
      base.db,
      userId,
      blocsDeLaSerie.map(({ id }) => id),
    )
    return rappels.filter(
      ({ date }) => jourDe(date, reglages.fuseau, reglages.heureBascule) === contexte.jour,
    )
  }

  return {
    /**
     * L'identifiant de la vérification ouverte d'un bloc, tirée à la première demande
     * (`POST /verifications`). Une vérification terminée n'est jamais rouverte.
     */
    async verificationPour(userId: string, codeBloc: string, type: TypeVerification) {
      const { maintenant, reglages, plan } = await chargerLeger(userId)
      const bloc = plan.find(({ code }) => code === codeBloc)
      if (bloc === undefined) throw new Introuvable(`Le bloc « ${codeBloc} » n'existe pas.`)
      // Le tirage ne regarde que les vérifications déjà terminées, sur tous les blocs.
      const faits = await lireFaits(base.db, userId, plan, ['verification_terminee'])
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
      const { maintenant, reglages, ligne, bloc, manifeste, evenements } =
        await chargerVerification(userId, id)
      // Un seul bloc compte ici : ses faits, et rien d'autre.
      const faits = await lireFaits(base.db, userId, [bloc])
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
      const etat = calculerBloc(faits, manifeste, reglages, maintenant)
      const commencee = evenements.some(({ type }) => type === 'verification_partie')
      return {
        id: ligne.id,
        type: TypeVerification.parse(ligne.type),
        due_le: dateDue(etat, reglages, maintenant, report ?? null),
        terminee: resultat !== undefined,
        revu_recemment:
          resultat !== undefined || commencee ? null : revuRecemment(faits, reglages, maintenant),
        parties: Tirage.parse(ligne.tirage).flatMap(({ id: partie }) => {
          const differee = manifeste.differees.find((autre) => autre.id === partie)
          return differee === undefined ? [] : [partieVisible(differee, envoyees.has(partie))]
        }),
        resultat: resultat ?? null,
      }
    },

    /**
     * Reçoit la réponse à une partie. Les parties à l'IA passent par la correction (budget, brut,
     * échantillon) avant d'être rangées ; à la dernière, le fait `verification_terminee` est écrit, le
     * bloc recalculé et le résultat rendu. Aucune correction n'est montrée avant.
     */
    async repondre(
      userId: string,
      id: string,
      corps: {
        id: string
        partie: string
        reponse: string
        confiance: 'sur' | 'hesitant' | 'hasard'
        support: { colle: boolean; retour_cours: boolean }
        code?: { reussis: number; total: number } | undefined
        constat?: { coches: readonly number[]; aide: number } | undefined
      },
    ) {
      const charge = await chargerVerification(userId, id)
      const { ligne, bloc, manifeste, reglages } = charge
      const tirage = Tirage.parse(ligne.tirage)
      const tiree = tirage.find(({ id: autre }) => autre === corps.partie)
      const differee = manifeste.differees.find(({ id: autre }) => autre === corps.partie)
      if (tiree === undefined || differee === undefined) {
        throw new Introuvable(`La partie « ${corps.partie} » n'existe pas.`)
      }
      const lues = (evenements: readonly { type: string; donnees: unknown }[]) => ({
        parties: evenements.flatMap(({ type, donnees }) =>
          type === 'verification_partie' ? [EvenementPartie.parse(donnees)] : [],
        ),
        resultat: evenements
          .filter(({ type }) => type === 'verification_resultat')
          .map(({ donnees }) => EvenementResultat.parse(donnees).resultat)
          .at(-1),
      })
      const dejaVu = lues(charge.evenements)
      const rendre = (resultat: typeof dejaVu.resultat) => ({
        partie: corps.partie,
        terminee: resultat !== undefined,
        ...(resultat === undefined ? {} : { resultat }),
      })
      if (
        dejaVu.resultat !== undefined ||
        dejaVu.parties.some(({ partie }) => partie === corps.partie)
      ) {
        return rendre(dejaVu.resultat)
      }

      // La correction se fait hors transaction : elle appelle le fournisseur.
      let corrigee: Omit<EvenementPartie, 'partie' | 'type' | 'reponse'>
      if (differee.type === 'tache') {
        const tache = corrigerTache(differee, manifeste.etapes, corps)
        if (tache === undefined) {
          const constat = differee.verification?.mode === 'constat'
          throw new ErreurProtocole(
            400,
            'donnees_invalides',
            constat ? 'Constat manquant' : 'Code non testé',
            constat
              ? 'Coche les critères atteints et indique ton niveau d’aide.'
              : "Teste ton code avant de l'envoyer.",
          )
        }
        corrigee = { ...tache, erreurs: [] }
      } else {
        const recue = await corrigerPartie(userId, {
          id: corps.id,
          verification: id,
          question: corps.partie,
          reponse: corps.reponse,
          confiance: corps.confiance,
          support: corps.support,
        })
        corrigee = {
          niveau: recue.niveau,
          compte: recue.compte,
          correction: recue.message,
          correctionId: recue.id,
          erreurs: recue.erreurs_critiques,
        }
      }

      return base.enTransaction(async (tx) => {
        const maintenant = await sousVerrouDuBloc(tx, horloge, userId, bloc.id)
        const donnees = {
          verification: id,
          partie: corps.partie,
          type: differee.type,
          reponse: corps.reponse,
          confiance: corps.confiance,
          ...corrigee,
        }
        const ajoute = await depot.ajouterEvenement(tx, {
          id: corps.id,
          userId,
          blocId: bloc.id,
          ficheVersionId: bloc.versionId,
          type: 'verification_partie',
          donnees,
          empreinte: empreinteJson(donnees),
          dateServeur: maintenant,
        })
        const apresCoup = lues(await depot.evenementsDeVerification(tx, userId, id))
        // Les parties distinctes : deux réponses à la même partie ne comptent que pour une.
        const reponduesDistinctes = new Set(apresCoup.parties.map(({ partie }) => partie)).size
        if (!ajoute || reponduesDistinctes < tirage.length) {
          return rendre(apresCoup.resultat)
        }

        // Dernière partie : le fait est écrit, le moteur recalcule, le résultat est gardé.
        const parties = tirage.flatMap(({ id: partie }) =>
          apresCoup.parties.filter((autre) => autre.partie === partie),
        )
        const reponses = parties.map(reponseDeFait)
        const faitsDuBloc = await lireFaits(tx, userId, [bloc])
        const debut = (await depot.evenementsDeVerification(tx, userId, id))[0]?.date ?? maintenant
        const validite = validiteVerification(faitsDuBloc, debut, reponses, reglages)
        const statutAvant = calculerBloc(faitsDuBloc, manifeste, reglages, maintenant).statut
        const fait = {
          verification: TypeVerification.parse(ligne.type),
          valable: validite.valable,
          ...(validite.valable ? {} : { raisonInvalide: validite.raison }),
          reponses,
        }
        await depot.ajouterEvenement(tx, {
          id: nouvelId(instantEnMs(maintenant)),
          userId,
          blocId: bloc.id,
          ficheVersionId: bloc.versionId,
          type: 'verification_terminee',
          donnees: fait,
          empreinte: empreinteJson(fait),
          dateServeur: maintenant,
        })
        const apres = await recalculer(tx, {
          userId,
          bloc: { id: bloc.id, code: bloc.code },
          manifeste,
          reglages,
          maintenant,
        })
        const resultat = construireResultat({
          bloc: { code: bloc.code, titre: manifeste.titre },
          manifeste,
          type: TypeVerification.parse(ligne.type),
          parties,
          validite,
          statutAvant,
          apres,
          reglages,
          maintenant,
        })
        const gardee = { verification: id, resultat }
        await depot.ajouterEvenement(tx, {
          id: nouvelId(instantEnMs(maintenant) + 1),
          userId,
          blocId: bloc.id,
          ficheVersionId: bloc.versionId,
          type: 'verification_resultat',
          donnees: gardee,
          empreinte: empreinteJson(gardee),
          dateServeur: maintenant,
        })
        return rendre(resultat)
      })
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
          empreinte: empreinteJson(donnees),
          dateServeur: maintenant,
        })
        if (ajoute) return { due_le: demain }
        const gardee = await depot.evenementParId(tx, userId, evenementId)
        const jusqua = EvenementReport.safeParse(gardee?.donnees)
        if (!jusqua.success) {
          throw new ContenuDifferent()
        }
        return { due_le: jusqua.data.jusqua }
      })
    },

    /** Les cartes dues et les nouvelles des blocs vus. */
    async cartesDues(userId: string, signal?: AbortSignal) {
      return cartesDe(userId, await charger(userId, undefined, signal))
    },

    /**
     * L'écran Aujourd'hui en une requête : la file du moteur, où mène chaque tâche, le module en cours.
     * Une lecture : rien n'est tiré ni écrit (une vérification s'ouvre par `POST /verifications`).
     */
    async aujourdhui(userId: string, signal?: AbortSignal) {
      const charge = await charger(userId, undefined, signal)
      const { maintenant, reglages, plan, contexte } = charge
      const cartes = await cartesDe(userId, charge)
      const gardee = SerieGardee.safeParse(await depot.serieDuJour(base.db, userId, contexte.jour))
      const questions = gardee.success
        ? gardee.data.length
        : tirerQuestionsDuJour(contexte, tousLesFaits(charge), reglages).length
      const file = fileDuJour({
        blocs: contexte.blocs,
        questionsDebut: questions,
        cartes: {
          dues: cartes.dues.map(({ id }) => id),
          nouvelles: cartes.nouvelles.map(({ id }) => id),
        },
        derniereActivite: contexte.derniereActivite,
        maintenant,
        reglages,
      })
      const reports = (await depot.reportsOuverts(base.db, userId)).flatMap(
        ({ blocId, jusqua }) => {
          const bloc = plan.find(({ id }) => id === blocId)
          return bloc === undefined ? [] : [{ bloc: bloc.code, jusqua }]
        },
      )
      const reportes = blocsReportes(reports, contexte.jour)
      const aFaire = file.taches.filter(
        (tache) => !(estVerification(tache) && reportes.has(tache.bloc)),
      )
      // Ce qui s'est fait dans la journée : les réponses à la série, les cartes notées.
      const serieGardee = gardee.success ? gardee.data : []
      const rappelsDuJourFaits = await rappelsDuJour(userId, serieGardee, charge)
      const questionsRepondues = serieGardee.filter(({ bloc, question }) => {
        const idDuBloc = plan.find(({ code }) => code === bloc)?.id
        return rappelsDuJourFaits.some(
          (ligne) => ligne.blocId === idDuBloc && ligne.questionId === question,
        )
      }).length
      const cartesRevues = (
        await depot.notesDepuis(
          base.db,
          userId,
          debutDuJour(contexte.jour, reglages.fuseau, reglages.heureBascule),
        )
      ).length
      const jourDeLaDerniere =
        contexte.derniereActivite === null
          ? null
          : jourDe(contexte.derniereActivite, reglages.fuseau, reglages.heureBascule)
      const pause = jourDeLaDerniere === null ? 0 : ecartEnJours(jourDeLaDerniere, contexte.jour)
      return {
        jour: contexte.jour,
        en_retard: file.enRetard,
        ...(pause >= JOURS_AVANT_RETARD ? { retour: { jours: pause } } : {}),
        premiere_connexion: [...charge.etatsDesBlocs.values()].every(
          ({ faits }) => faits.length === 0,
        ),
        taches: tachesDuJour(aFaire, { questionsRepondues, cartesRevues }, lienDeLaTache),
        module: moduleEnCours(plan, contexte),
      }
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
        const maintenant = await sousVerrouDuBloc(tx, horloge, userId, trouvee.blocId)
        const brut = await depot.revueDe(tx, userId, trouvee.id)
        const avant = brut === undefined ? null : EtatGarde.parse(brut)
        if (avant !== null && (await depot.noteParId(tx, userId, noteId)) !== undefined) {
          return { echeance: avant.echeance }
        }
        const apres = apresNote(avant, note, noteId, maintenant, reglages)
        await depot.ecrireRevue(tx, {
          id: noteId,
          userId,
          carteId: trouvee.id,
          dueLe: apres.echeance,
          etat: apres,
        })
        await depot.ajouterNote(tx, {
          id: noteId,
          userId,
          carteId: trouvee.id,
          note,
          dateServeur: maintenant,
        })
        return { echeance: apres.echeance }
      })
    },

    /** La série de début de séance du jour si elle est déjà gardée : une lecture, rien n'est tiré. */
    async questionsDebut(userId: string) {
      return this.serieDuJour(userId, false)
    },

    /**
     * Tire la série de début de séance du jour et la garde : une seule fois par jour, deux appels
     * simultanés rendent la même.
     */
    async garderQuestionsDebut(userId: string) {
      return this.serieDuJour(userId, true)
    },

    /**
     * Le bloc n'est donné qu'une fois la question corrigée. Les faits ne sont lus (et le contexte
     * calculé) que pour tirer une série ; lire ou rendre une série déjà gardée n'en a pas besoin :
     * il suffit du plan, des réglages, du jour et des corrections du jour.
     */
    async serieDuJour(userId: string, garder: boolean) {
      const leger = await chargerLeger(userId)
      const { maintenant, reglages, plan } = leger
      const jour = jourDe(maintenant, reglages.fuseau, reglages.heureBascule)

      let gardee: unknown = await depot.serieDuJour(base.db, userId, jour)
      if (gardee === undefined) {
        if (!garder) return { questions: [], gardee: false }
        const charge = await charger(userId, leger)
        const { contexte } = charge
        const tirees = tirerQuestionsDuJour(contexte, tousLesFaits(charge), reglages).map(
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
        gardee = await depot.serieDuJour(base.db, userId, jour)
      }
      const serie = SerieGardee.parse(gardee)

      const duJour = await rappelsDuJour(userId, serie, { plan, reglages, contexte: { jour } })
      return {
        questions: serie.flatMap(({ bloc, question }) => {
          const duPlan = plan.find(({ code }) => code === bloc)
          const texte =
            duPlan === undefined
              ? undefined
              : Manifeste.parse(duPlan.manifeste).rappel.find(({ id }) => id === question)
          const idDuBloc = duPlan?.id
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
                      correction: CorrectionRendue.parse({
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
                        modele: derniere.modele,
                        secours: estDeSecours(derniere.modele),
                      }),
                    },
            },
          ]
        }),
        gardee: true,
      }
    },
  }
}
export type ServiceRevisions = ReturnType<typeof creerServiceRevisions>
