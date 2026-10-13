import { Manifeste } from '@janus/contrats'
import type { Fait, Reglages } from '@janus/contrats'
import { comparerFaits, SuiviBloc } from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { and, count, inArray, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { lireFaits, TYPES_DES_EVENEMENTS } from './faits.ts'
import { deLUtilisateurSurLesBlocs } from './requetes.ts'
import * as t from './schema/index.ts'
import type { Db, Tx } from './transaction.ts'

// L'état de chaque bloc d'un utilisateur, gardé en mémoire entre deux requêtes.
//
// Lire l'écran « Aujourd'hui » relisait tous les faits de l'utilisateur et recalculait ses ~200 blocs à
// chaque requête. Un bloc ne change que si un fait lui est ajouté (les faits ne se modifient ni ne
// s'effacent : le rôle `janus_app` n'a ni UPDATE ni DELETE dessus), si sa fiche change de version ou si les
// réglages changent. Chaque lecture compare donc la « signature » du bloc, lue en base (combien de faits
// dans chaque table, et la date du dernier), à celle de l'état gardé : égale, l'état sert tel quel ;
// différente, le bloc est relu et recalculé. Rien n'est jamais invalidé « à l'écriture » : c'est la lecture
// qui vérifie, donc aucun chemin d'écriture ne peut oublier de le faire.
//
// L'état gardé est un `SuiviBloc` du moteur : il rend, pour n'importe quel `maintenant`, exactement ce que
// rendrait `calculerBloc` sur les mêmes faits (le temps n'entre que dans ce qui manque encore).

/** Un bloc du plan, tel qu'il faut le connaître pour en lire l'état. */
export interface BlocPourEtat {
  readonly id: string
  readonly code: string
  /** La version de fiche en service : une autre version, un autre manifeste, un autre état. */
  readonly versionId: string
  readonly manifeste: unknown
}

export interface EtatDuBloc {
  /** Le manifeste en service, déjà lu. */
  readonly manifeste: Manifeste
  /** Les faits du bloc, tels que `lireFaits` les rend (doublons d'identifiant compris). */
  readonly faits: readonly Fait[]
  /** La date du dernier fait, `null` sans fait. */
  readonly dernierFait: string | null
  /** Ce que rend `calculerBloc(faits, manifeste, reglages, maintenant)`. */
  readonly resultat: (maintenant: string) => ResultatBloc
}

export interface CacheDesEtats {
  /**
   * L'état de chaque bloc donné, par code de bloc. Les blocs inchangés viennent de la mémoire, les autres
   * sont relus (par petits groupes, en laissant la boucle d'événements respirer entre deux) et recalculés.
   * Si `signal` est interrompu (le délai de la requête est écoulé, le client est parti), la relecture
   * s'arrête au lot suivant au lieu de continuer pour rien.
   */
  readonly etats: (
    lecteur: Db | Tx,
    userId: string,
    blocs: readonly BlocPourEtat[],
    reglages: Reglages,
    signal?: AbortSignal,
  ) => Promise<ReadonlyMap<string, EtatDuBloc>>
  /** Oublie tout : pour les tests et pour une base remise à zéro. */
  readonly vider: () => void
}

export interface OptionsCache {
  /** Le nombre de faits gardés au plus (tous utilisateurs et tous blocs) ; les moins récemment lus partent d'abord. */
  readonly faitsMax?: number
  /** Le nombre de faits lus puis calculés d'un seul tenant avant de rendre la main. */
  readonly faitsParLot?: number
}

/** Environ 150 Mo pour un utilisateur à 500 000 faits (190 000 faits du moteur). */
const FAITS_MAX_PAR_DEFAUT = 400_000
/** Un lot de cette taille se lit et se calcule en quelques dizaines de millisecondes. */
const FAITS_PAR_LOT_PAR_DEFAUT = 6_000
const MANIFESTES_MAX = 2_000

interface ARelire {
  readonly bloc: BlocPourEtat
  readonly cle: string
  readonly signature: string
  readonly faits: number
  /** Tout ce dont dépend l'état : le bloc, ses faits, sa fiche, les réglages. */
  readonly validation: string
}

interface Garde {
  readonly signature: string
  readonly versionId: string
  readonly reglages: string
  readonly etat: EtatDuBloc
}

/** Combien de faits et quel dernier fait dans chaque table, pour chaque bloc : de quoi savoir si un bloc a changé. */
async function signatures(
  lecteur: Db | Tx,
  userId: string,
  ids: readonly string[],
): Promise<Map<string, { signature: string; faits: number }>> {
  const dernier = (colonne: AnyPgColumn) => sql<string>`max(${colonne})::text`
  const [evenements, corrections, forcages, decisions] = await Promise.all([
    lecteur
      .select({
        blocId: t.evenements.blocId,
        n: count(),
        dernier: dernier(t.evenements.dateServeur),
      })
      .from(t.evenements)
      .where(
        and(
          deLUtilisateurSurLesBlocs(t.evenements, userId, ids),
          inArray(t.evenements.type, TYPES_DES_EVENEMENTS),
        ),
      )
      .groupBy(t.evenements.blocId),
    lecteur
      .select({
        blocId: t.corrections.blocId,
        n: count(),
        dernier: dernier(t.corrections.dateServeur),
      })
      .from(t.corrections)
      .where(deLUtilisateurSurLesBlocs(t.corrections, userId, ids))
      .groupBy(t.corrections.blocId),
    lecteur
      .select({
        blocId: t.statutsForces.blocId,
        n: count(),
        dernier: dernier(t.statutsForces.dateServeur),
      })
      .from(t.statutsForces)
      .where(deLUtilisateurSurLesBlocs(t.statutsForces, userId, ids))
      .groupBy(t.statutsForces.blocId),
    lecteur
      .select({
        blocId: t.decisionsErreurs.blocId,
        n: count(),
        dernier: dernier(t.decisionsErreurs.dateServeur),
      })
      .from(t.decisionsErreurs)
      .where(deLUtilisateurSurLesBlocs(t.decisionsErreurs, userId, ids))
      .groupBy(t.decisionsErreurs.blocId),
  ])
  const parBloc = new Map<string, { signature: string[]; faits: number }>()
  for (const [rang, lignes] of [evenements, corrections, forcages, decisions].entries()) {
    for (const { blocId, n, dernier: date } of lignes) {
      const vue = parBloc.get(blocId) ?? { signature: ['', '', '', '', '', '', '', ''], faits: 0 }
      vue.signature[2 * rang] = String(n)
      vue.signature[2 * rang + 1] = date
      vue.faits += n
      parBloc.set(blocId, vue)
    }
  }
  return new Map(
    ids.map((id) => {
      const vue = parBloc.get(id)
      return [id, { signature: vue?.signature.join('|') ?? '', faits: vue?.faits ?? 0 }]
    }),
  )
}

function rendreLaMain(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

/** Construit l'état d'un bloc depuis ses faits : ils sont rangés comme `calculerBloc` les range, puis lus un à un. */
function construire(faits: readonly Fait[], manifeste: Manifeste, reglages: Reglages): EtatDuBloc {
  const suivi = new SuiviBloc(manifeste, reglages)
  for (const fait of [...faits].sort(comparerFaits)) suivi.ajouter(fait)
  let dernierFait: string | null = null
  for (const fait of faits) {
    if (dernierFait === null || fait.date > dernierFait) dernierFait = fait.date
  }
  return { manifeste, faits, dernierFait, resultat: (maintenant) => suivi.resultat(maintenant) }
}

export function creerCacheDesEtats({
  faitsMax = FAITS_MAX_PAR_DEFAUT,
  faitsParLot = FAITS_PAR_LOT_PAR_DEFAUT,
}: OptionsCache = {}): CacheDesEtats {
  /** Du moins récemment lu au plus récemment lu : l'ordre d'insertion d'une `Map`. */
  const gardes = new Map<string, Garde>()
  let faitsGardes = 0
  const manifestes = new Map<string, Manifeste>()
  /** Un bloc en cours de lecture pour une requête n'est pas relu pour une autre qui le demande au même état. */
  const enCours = new Map<string, Promise<Garde>>()

  function manifesteDe({ versionId, manifeste }: BlocPourEtat): Manifeste {
    const lu = manifestes.get(versionId)
    if (lu !== undefined) return lu
    const neuf = Manifeste.parse(manifeste)
    if (manifestes.size >= MANIFESTES_MAX) manifestes.clear()
    manifestes.set(versionId, neuf)
    return neuf
  }

  function garder(cle: string, garde: Garde): void {
    const ancien = gardes.get(cle)
    if (ancien !== undefined) {
      faitsGardes -= ancien.etat.faits.length
      gardes.delete(cle)
    }
    gardes.set(cle, garde)
    faitsGardes += garde.etat.faits.length
    for (const [autre, vieux] of gardes) {
      if (faitsGardes <= faitsMax || autre === cle) break
      gardes.delete(autre)
      faitsGardes -= vieux.etat.faits.length
    }
  }

  /** Lit d'un coup les faits de ces blocs et en tire l'état de chacun ; chaque bloc a sa promesse, partagée avec qui le demande. */
  function lire(
    lecteur: Db | Tx,
    userId: string,
    lot: readonly ARelire[],
    reglages: Reglages,
    empreinteReglages: string,
  ): void {
    const lecture = lireFaits(
      lecteur,
      userId,
      lot.map(({ bloc }) => bloc),
    ).then((tous) => {
      const parBloc = new Map<string, Fait[]>()
      for (const fait of tous) {
        const duBloc = parBloc.get(fait.bloc)
        if (duBloc === undefined) parBloc.set(fait.bloc, [fait])
        else duBloc.push(fait)
      }
      return parBloc
    })
    for (const { bloc, signature, validation } of lot) {
      const garde = lecture.then((parBloc): Garde => ({
        signature,
        versionId: bloc.versionId,
        reglages: empreinteReglages,
        etat: construire(parBloc.get(bloc.code) ?? [], manifesteDe(bloc), reglages),
      }))
      enCours.set(validation, garde)
      // Réussie ou non, la lecture n'est plus « en cours » ; l'erreur, elle, est rendue à ceux qui attendent.
      const fini = () => {
        enCours.delete(validation)
      }
      garde.then(fini, fini)
    }
  }

  return {
    vider() {
      gardes.clear()
      manifestes.clear()
      faitsGardes = 0
    },

    async etats(lecteur, userId, blocs, reglages, signal) {
      const resultat = new Map<string, EtatDuBloc>()
      if (blocs.length === 0) return resultat
      signal?.throwIfAborted()
      const empreinteReglages = JSON.stringify(reglages)
      const vues = await signatures(
        lecteur,
        userId,
        blocs.map(({ id }) => id),
      )
      const aRelire: ARelire[] = []
      for (const bloc of blocs) {
        const cle = `${userId}|${bloc.id}`
        const vue = vues.get(bloc.id)
        const signature = vue?.signature ?? ''
        const garde = gardes.get(cle)
        if (
          garde?.signature === signature &&
          garde.versionId === bloc.versionId &&
          garde.reglages === empreinteReglages
        ) {
          // Lu à l'instant : il passe en queue, parmi les derniers à partir.
          gardes.delete(cle)
          gardes.set(cle, garde)
          resultat.set(bloc.code, garde.etat)
        } else {
          aRelire.push({
            bloc,
            cle,
            signature,
            faits: vue?.faits ?? 0,
            validation: `${cle}|${signature}|${bloc.versionId}|${empreinteReglages}`,
          })
        }
      }

      // Les blocs à relire, par lots de quelques milliers de faits, la boucle d'événements respirant entre deux.
      let debut = 0
      while (debut < aRelire.length) {
        signal?.throwIfAborted()
        let fin = debut
        let faits = 0
        while (fin < aRelire.length && (fin === debut || faits < faitsParLot)) {
          faits += aRelire[fin]?.faits ?? 0
          fin += 1
        }
        const lot = aRelire.slice(debut, fin)
        debut = fin
        const neufs = lot.filter(({ validation }) => !enCours.has(validation))
        if (neufs.length > 0) lire(lecteur, userId, neufs, reglages, empreinteReglages)
        // Les promesses sont prises avant d'attendre : une lecture finie sort de `enCours` aussitôt.
        const attendus = lot.map(({ bloc, cle, validation }) => ({
          bloc,
          cle,
          attendu: enCours.get(validation),
        }))
        for (const { bloc, cle, attendu } of attendus) {
          if (attendu === undefined) throw new Error(`Lecture perdue pour le bloc ${bloc.code}`)
          const garde = await attendu
          garder(cle, garde)
          resultat.set(bloc.code, garde.etat)
        }
        await rendreLaMain()
      }
      return resultat
    },
  }
}
