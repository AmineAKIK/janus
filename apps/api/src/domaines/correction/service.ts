import { Manifeste, Reglages, nouvelId } from '@janus/contrats'
import { CorrectionRendue } from '@janus/contrats'
import type { CorrectionRendue as CorrectionRendueApi } from '@janus/contrats'
import { compte, estRecopiee, instantEnIso, instantEnMs, jourDe, statutDuBloc } from '@janus/moteur'
import { maintenantActif, maintenantDuBloc, sousVerrouDuBloc } from '../../base/axeTemps.ts'
import type { Base } from '../../base/base.ts'
import { empreinteJson } from '../../base/empreinte.ts'
import { SerieGardee } from '../../base/serieGardee.ts'
import { verrouBloc } from '../../base/transaction.ts'
import {
  BudgetAtteint,
  ContenuDifferent,
  ErreurMetier,
  ErreurProtocole,
  introuvable,
  TropDeTentatives,
} from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import { recalculer } from '../../recalcul.ts'
import { coutMillioniemes } from '../../adaptateurs/correcteur/cout.ts'
import { estDeSecours } from '../../adaptateurs/correcteur/choix.ts'
import type { Tarifs } from '../../adaptateurs/correcteur/cout.ts'
import { requeteDe } from '../../adaptateurs/correcteur/correcteur.ts'
import type {
  Correcteur,
  RequeteCorrection,
  ResultatBrut,
} from '../../adaptateurs/correcteur/correcteur.ts'
import { EMPREINTE_CONSIGNE, messagesDeLaRequete } from '../../adaptateurs/correcteur/message.ts'
import type { LigneCorrection, DepotCorrection } from './depot.ts'
import { moisDe, tireeAuSort, validerSortie } from './policy.ts'
import type { SortieValide } from './policy.ts'

/** Le correcteur n'a rien rendu de valide, même au second essai. */
class CorrectionIndisponible extends ErreurMetier {
  readonly status = 503
  readonly code = 'erreur_interne'
  readonly titre = 'Correction indisponible'
}

const HEURE_MS = 3_600_000
/** Un appel, plus son nouvel essai : la réservation couvre les deux. */
const ESSAIS = 2
/** En moyenne, un jeton pour trois caractères : on surestime pour réserver assez. */
const CARACTERES_PAR_JETON = 3

export interface DemandeCorrection {
  id: string
  serie: 'restitution' | 'explication' | 'rappel' | 'verification'
  tentative: number
  question: string
  reponse: string
  confiance: 'sur' | 'hesitant' | 'hasard'
  relance: string
  support: { colle: boolean; retour_cours: boolean }
  /** Une explication que le manifeste ne déclare pas : la page en dit la question et l'attendu. */
  libre?: { question: string; attendu: string; apres_solution?: boolean | undefined } | undefined
  conteste?: boolean | undefined
  /** Pour la série `verification` : la vérification tirée, qui donne le bloc (jamais envoyée par la page). */
  verification?: string | undefined
  bloc?: string | undefined
  version?: number | undefined
}

export interface Tranchage {
  id: string
  compte: boolean
  niveau?: 'solide' | 'partiel' | 'fragile' | 'pas_encore' | undefined
  raison?: string | undefined
}

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotCorrection
  readonly horloge: Horloge
  /** Toujours présent : sans correcteur (pas de clé), `monterCorrection` refuse de démarrer l'API. */
  readonly correcteur: Correcteur
  readonly tarifs: Tarifs
  /** Le plafond de jetons de sortie demandé au fournisseur. */
  readonly jetonsSortieMax: number
  /** Un nombre dans [0, 1[ pour le tirage de l'échantillon, injecté pour les tests. */
  readonly hasard: () => number
}

/** La correction telle que l'appli la reçoit, relue de ce qui est gardé. */
function correctionRecue(ligne: LigneCorrection): CorrectionRendueApi {
  return CorrectionRendue.parse({
    id: ligne.id,
    echantillon: ligne.echantillon,
    question: ligne.questionId,
    tour: ligne.tour,
    message: ligne.message,
    niveau: ligne.niveau,
    erreurs_critiques: ligne.erreursIds,
    source: ligne.source,
    ref: ligne.ref,
    certitude: ligne.certitude,
    compte: ligne.compte,
    ...(ligne.raisonNonCompte === null ? {} : { raison_non_compte: ligne.raisonNonCompte }),
    modele: ligne.modele,
    secours: estDeSecours(ligne.modele),
  })
}

/** Ce que les essais auprès du correcteur ont donné. */
interface Essais {
  readonly sortie: SortieValide | undefined
  /** Le dernier résultat reçu, celui dont on garde le modèle, les paramètres et les jetons. */
  readonly dernier: ResultatBrut | undefined
  readonly bruts: readonly string[]
  readonly motif: string
  readonly jetonsEntree: number
  readonly jetonsSortie: number
  readonly cout: number
}

/** La tentative et le tour d'une demande, d'après les corrections déjà gardées de la question. */
function numeroter(
  deLaQuestion: readonly { readonly tentative: number; readonly tour: number }[],
  sansRelance: boolean,
) {
  const derniere = Math.max(0, ...deLaQuestion.map(({ tentative }) => tentative))
  const tentative = sansRelance ? derniere + 1 : Math.max(1, derniere)
  const deLaTentative = deLaQuestion.filter((autre) => autre.tentative === tentative)
  const tour = sansRelance ? 1 : Math.max(2, ...deLaTentative.map(({ tour: t }) => t + 1))
  return { tentative, tour }
}

/**
 * La question d'une explication libre, dans la série `explication` seulement : une explication que le
 * manifeste déclare se juge toujours sur son attendu à lui, jamais sur celui de la page.
 */
function explicationLibre(
  serie: DemandeCorrection['serie'],
  demande: DemandeCorrection,
): { id: string; question: string; attendu: string; erreurs: string[]; libre: true } | undefined {
  if (serie !== 'explication' || demande.libre === undefined) return undefined
  // `apres_solution` ne dit que le support : il ne part pas au correcteur.
  const { question, attendu } = demande.libre
  return { id: demande.question, question, attendu, erreurs: [], libre: true }
}

function trop(relancesMax: number) {
  return new ErreurProtocole(
    422,
    'donnees_invalides',
    'Trop de relances',
    `Une question accepte ${String(relancesMax)} relances au plus.`,
  )
}

export function creerServiceCorrection({
  base,
  depot,
  horloge,
  correcteur,
  tarifs,
  jetonsSortieMax,
  hasard,
}: DependancesService) {
  const identifiant = () => nouvelId(instantEnMs(horloge.maintenant()))

  /** Au plus deux essais : le second ajoute « Réponds uniquement avec le JSON demandé ». */
  async function demander(
    requete: RequeteCorrection,
    manifeste: Manifeste,
    parler: Correcteur,
  ): Promise<Essais> {
    const bruts: string[] = []
    let dernier: ResultatBrut | undefined
    let motif = ''
    let jetonsEntree = 0
    let jetonsSortie = 0
    let cout = 0
    for (const strict of [false, true]) {
      let brut: ResultatBrut
      try {
        brut = await parler.corriger({ ...requete, strict })
      } catch (erreur) {
        motif = erreur instanceof Error ? erreur.message : 'correcteur en panne'
        continue
      }
      dernier = brut
      bruts.push(brut.texte)
      jetonsEntree += brut.jetonsEntree
      jetonsSortie += brut.jetonsSortie
      cout += coutMillioniemes(brut, tarifs)
      const validation = validerSortie(brut.texte, manifeste, requete.confiance, requete.reponse)
      if (validation.valide) {
        return {
          sortie: validation.sortie,
          dernier,
          bruts,
          motif: '',
          jetonsEntree,
          jetonsSortie,
          cout,
        }
      }
      motif = validation.motif
    }
    return { sortie: undefined, dernier, bruts, motif, jetonsEntree, jetonsSortie, cout }
  }

  /** Les envois en cours, par utilisateur et identifiant. */
  const enCours = new Map<string, Promise<CorrectionRendueApi>>()

  async function corrigerUneFois(
    userId: string,
    demande: DemandeCorrection,
  ): Promise<CorrectionRendueApi> {
    if (demande.serie === 'verification' && demande.verification === undefined) {
      throw new ErreurProtocole(
        400,
        'donnees_invalides',
        'Série non corrigée',
        `Le serveur ne corrige pas encore la série « ${demande.serie} ».`,
      )
    }
    const { serie } = demande
    if (
      serie !== 'rappel' &&
      serie !== 'verification' &&
      (demande.bloc === undefined || demande.version === undefined)
    ) {
      throw new ErreurProtocole(
        400,
        'donnees_invalides',
        'Bloc manquant',
        'Le bloc et sa version sont exigés.',
      )
    }

    const gardee = await depot.correctionParId(base.db, demande.id)
    if (gardee !== undefined) {
      if (gardee.userId !== userId) {
        throw new ContenuDifferent()
      }
      return correctionRecue(gardee)
    }

    const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
    let trouve
    if (serie === 'verification') {
      // Une partie d'une vérification : le bloc est celui de la vérification tirée.
      trouve = await depot.blocDeLaVerification(base.db, userId, demande.verification ?? '')
      if (trouve === undefined) throw introuvable('La vérification')
    } else if (serie === 'rappel') {
      // Le rappel ne dit pas son bloc : le serveur le retrouve dans la série gardée pour aujourd'hui.
      const jour = jourDe(
        await maintenantActif(base.db, horloge, userId),
        reglages.fuseau,
        reglages.heureBascule,
      )
      const gardee = SerieGardee.safeParse(await depot.serieDuJour(base.db, userId, jour))
      const code = gardee.success
        ? gardee.data.find(({ question: q }) => q === demande.question)?.bloc
        : undefined
      trouve = code === undefined ? undefined : await depot.derniereVersion(base.db, code)
      if (trouve === undefined) throw introuvable(`La question « ${demande.question} »`)
    } else {
      const code = demande.bloc ?? ''
      const version = demande.version ?? 0
      trouve = await depot.blocEtVersion(base.db, code, version)
      if (trouve === undefined) {
        throw introuvable(`Le bloc « ${code} » en version ${String(version)}`)
      }
    }
    const manifeste = Manifeste.parse(trouve.manifeste)
    const question =
      serie === 'verification'
        ? manifeste.differees
            .filter(({ id }) => id === demande.question)
            .map(({ id, consigne, attendu }) => ({ id, question: consigne, attendu }))[0]
        : (manifeste[serie].find(({ id }) => id === demande.question) ??
          explicationLibre(serie, demande))
    if (question === undefined) throw introuvable(`La question « ${demande.question} »`)
    const bloc = { id: trouve.blocId, code: trouve.code }

    // Le tour : 1 sans relance, sinon le suivant de cette tentative.
    const deLaQuestion = await depot.correctionsDeLaQuestion(base.db, {
      userId,
      blocId: bloc.id,
      question: question.id,
      serie,
    })
    // Le serveur numérote seul les tentatives : une réponse sans relance ouvre la suivante
    // (la question peut revenir), une relance prolonge la dernière. Le client n'a rien à retenir.
    const sansRelance = serie === 'verification' || demande.relance.trim() === ''
    const { tentative, tour } = numeroter(deLaQuestion, sansRelance)
    const deLaTentative = deLaQuestion.filter((autre) => autre.tentative === tentative)
    if (tour > 1 + reglages.relancesMax) throw trop(reglages.relancesMax)
    const contestee = demande.conteste === true ? deLaQuestion.at(-1) : undefined
    if (demande.conteste === true && contestee === undefined) {
      throw new ErreurProtocole(
        400,
        'donnees_invalides',
        'Contestation invalide',
        'Aucune correction précédente à contester.',
      )
    }

    const recopiee = estRecopiee(
      demande.reponse,
      [manifeste.contexte_ia, question.attendu],
      reglages.seuilRecopie,
    )
    const requete = requeteDe(manifeste, question, {
      confiance: demande.confiance,
      reponse: demande.reponse,
      historique: deLaTentative
        .filter(({ tour: t }) => t < tour)
        .map(({ reponse, message }) => ({ reponse, message })),
    })

    // 1. Réservation, dans une transaction courte.
    const debut = horloge.maintenant()
    const mois = moisDe(debut)
    const caracteres = messagesDeLaRequete(requete).reduce(
      (total, m) => total + m.content.length,
      0,
    )
    const estime =
      ESSAIS *
      coutMillioniemes(
        {
          jetonsEntree: Math.ceil(caracteres / CARACTERES_PAR_JETON),
          jetonsEntreeCache: 0,
          jetonsSortie: jetonsSortieMax,
        },
        tarifs,
      )
    await base.enTransaction(async (tx) => {
      const reserve = await depot.reserver(tx, {
        userId,
        mois,
        plafond: reglages.plafondIaMillioniemes,
        estime,
      })
      if (!reserve) throw new BudgetAtteint('Le plafond mensuel de l’IA est atteint.')
      const appels = await depot.appelsDepuis(
        tx,
        userId,
        instantEnIso(instantEnMs(debut) - HEURE_MS),
      )
      if (appels >= reglages.appelsIaParHeure) {
        throw new TropDeTentatives(60)
      }
    })

    // 2. L'appel, hors transaction.
    let essais: Essais
    try {
      essais = await demander(requete, manifeste, correcteur)
    } catch (erreur) {
      await base.enTransaction((tx) => depot.solder(tx, { userId, mois, estime, cout: 0 }))
      throw erreur
    }

    // 3. L'enregistrement et le recalcul, sous le verrou du bloc.
    const enregistrer = () =>
      base.enTransaction(async (tx) => {
        const maintenant = await sousVerrouDuBloc(tx, horloge, userId, bloc.id)
        await depot.solder(tx, { userId, mois, estime, cout: essais.cout })
        const apresCoup = await depot.correctionParId(tx, demande.id)
        if (apresCoup !== undefined) return { gardee: apresCoup }
        // Deux demandes sur la même question ont pu partir ensemble : le numéro se refait sous le verrou.
        const numero = numeroter(
          await depot.correctionsDeLaQuestion(tx, {
            userId,
            blocId: bloc.id,
            question: question.id,
            serie,
          }),
          sansRelance,
        )
        if (numero.tour > 1 + reglages.relancesMax) return { tropDeRelances: true as const }
        if (essais.sortie === undefined) {
          await depot.ajouterEchec(tx, {
            id: demande.id,
            userId,
            blocId: bloc.id,
            questionId: question.id,
            serie,
            tentative: numero.tentative,
            tour: numero.tour,
            motif: essais.motif,
            bruts: essais.bruts,
            modele: essais.dernier?.modele ?? 'inconnu',
            coutMillioniemes: essais.cout,
            dateServeur: maintenant,
          })
          return { echec: true as const }
        }
        const { sortie, dernier } = essais
        const verdict = compte({
          tour: numero.tour,
          colle: demande.support.colle,
          // Une explication libre qui suit une solution vue est faite avec support ; pas un schéma
          // refait de mémoire (`apres_solution: false`).
          retourCours:
            demande.support.retour_cours ||
            ('libre' in question && demande.libre?.apres_solution !== false),
          recopiee,
          certitude: sortie.certitude,
        })
        const ligne: LigneCorrection = {
          id: demande.id,
          userId,
          blocId: bloc.id,
          questionId: question.id,
          serie,
          tentative: numero.tentative,
          tour: numero.tour,
          confiance: demande.confiance,
          reponse: demande.reponse,
          supportColle: demande.support.colle,
          supportRetourCours: demande.support.retour_cours,
          recopiee,
          message: sortie.message,
          niveau: sortie.niveau,
          niveauRendu: sortie.niveauRendu,
          erreursIds: sortie.erreurs,
          source: sortie.source,
          ref: sortie.ref,
          certitude: sortie.certitude,
          compte: verdict.compte,
          raisonNonCompte: verdict.compte ? null : verdict.raison,
          conteste: contestee !== undefined,
          modele: dernier?.modele ?? 'inconnu',
          parametres: dernier?.parametres ?? {},
          jetonsEntree: essais.jetonsEntree,
          jetonsSortie: essais.jetonsSortie,
          coutMillioniemes: essais.cout,
          consigneEmpreinte: EMPREINTE_CONSIGNE,
          brut: essais.bruts.at(-1) ?? '',
          echantillon: tireeAuSort(numero.tour, reglages.echantillonControle, hasard()),
          dateServeur: maintenant,
        }
        if (contestee !== undefined) {
          const donnees = { correction: contestee.id }
          await depot.ajouterFait(tx, {
            id: identifiant(),
            userId,
            blocId: bloc.id,
            ficheVersionId: trouve.versionId,
            type: 'correction_contestee',
            donnees,
            empreinte: empreinteJson(donnees),
            dateServeur: maintenant,
          })
        }
        await depot.ajouterCorrection(tx, ligne)
        await recalculer(tx, { userId, bloc, manifeste, reglages, maintenant })
        return { gardee: ligne }
      })
    let resultat: Awaited<ReturnType<typeof enregistrer>>
    try {
      resultat = await enregistrer()
    } catch (erreur) {
      // La transaction annulée emporte aussi le solde : l'appel est payé, la réservation est rendue.
      await base.enTransaction((tx) =>
        depot.solder(tx, { userId, mois, estime, cout: essais.cout }),
      )
      throw erreur
    }

    if ('tropDeRelances' in resultat) throw trop(reglages.relancesMax)
    // L'échec est signalé après le commit, pour que la réponse brute reste gardée.
    if ('echec' in resultat) {
      throw new CorrectionIndisponible('La correction n’a pas donné de réponse valable : réessaie.')
    }
    return correctionRecue(resultat.gardee)
  }

  return {
    /**
     * Corrige une réponse : doublon, relances, réservation du budget, appel hors transaction,
     * validation, enregistrement, recalcul du bloc.
     */
    corriger(userId: string, demande: DemandeCorrection): Promise<CorrectionRendueApi> {
      // Le même envoi en double (double tap, file qui rejoue) attend le premier : un seul appel, un seul coût.
      const cle = `${userId}:${demande.id}`
      const enVol = enCours.get(cle)
      if (enVol !== undefined) return enVol
      const travail = corrigerUneFois(userId, demande).finally(() => {
        enCours.delete(cle)
      })
      enCours.set(cle, travail)
      return travail
    },

    /**
     * L'avis d'Amine sur une correction de l'échantillon : un fait de plus, le dernier fait foi.
     * Redonner le même avis (renvoi après une réponse perdue) n'ajoute rien.
     */
    async donnerAvis(userId: string, correctionId: string, accord: boolean): Promise<void> {
      const trouvee = await depot.correctionEtBloc(base.db, userId, correctionId)
      if (trouvee === undefined) throw introuvable(`La correction « ${correctionId} »`)
      const donnees = { correction: correctionId, accord }
      await base.enTransaction(async (tx) => {
        await verrouBloc(tx, userId, trouvee.blocId)
        if ((await depot.dernierAvis(tx, userId, correctionId)) === accord) return
        await depot.ajouterFait(tx, {
          id: identifiant(),
          userId,
          blocId: trouvee.blocId,
          ficheVersionId: trouvee.version.id,
          type: 'correction.accord',
          donnees,
          empreinte: empreinteJson(donnees),
          dateServeur: await maintenantDuBloc(tx, horloge, userId, trouvee.blocId),
        })
      })
    },

    /**
     * Amine tranche une correction : elle compte ou non, avec un autre niveau s'il le change (raison
     * exigée par le contrat). Le même identifiant avec le même contenu est un doublon.
     */
    async trancher(userId: string, correctionId: string, decision: Tranchage) {
      const trouvee = await depot.correctionEtBloc(base.db, userId, correctionId)
      if (trouvee === undefined) throw introuvable(`La correction « ${correctionId} »`)
      const bloc = { id: trouvee.blocId, code: trouvee.code }
      const manifeste = Manifeste.parse(trouvee.version.manifeste)
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const donnees = {
        correction: correctionId,
        compte: decision.compte,
        ...(decision.niveau === undefined ? {} : { niveau: decision.niveau }),
        ...(decision.raison === undefined ? {} : { raison: decision.raison }),
      }
      const signature = empreinteJson(donnees)
      return base.enTransaction(async (tx) => {
        const maintenant = await sousVerrouDuBloc(tx, horloge, userId, bloc.id)
        const existant = await depot.evenementParId(tx, decision.id)
        if (existant === undefined) {
          await depot.ajouterFait(tx, {
            id: decision.id,
            userId,
            blocId: bloc.id,
            ficheVersionId: trouvee.version.id,
            type: 'correction_tranchee',
            donnees,
            empreinte: signature,
            dateServeur: maintenant,
          })
        } else if (existant.userId !== userId || existant.empreinte !== signature) {
          throw new ContenuDifferent()
        }
        return statutDuBloc(await recalculer(tx, { userId, bloc, manifeste, reglages, maintenant }))
      })
    },
  }
}
export type ServiceCorrection = ReturnType<typeof creerServiceCorrection>
