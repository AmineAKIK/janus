import type { Manifeste, Reglages, Statut } from '@janus/contrats'
import type { Fait } from './faits.ts'
import { comparerFaits } from './statut.ts'
import {
  assembler,
  construireEtat,
  etapesDe,
  lectureTranchee,
  lirePreuves,
  lireVerifications,
  provisoireDeLEtat,
  relireVerifications,
  statutCalculeDeLEtat,
} from './statutEtapes.ts'
import type { Correction, EtatBloc, ResultatBloc } from './statutEtapes.ts'
import { instantEnMs } from './temps.ts'

/**
 * Le statut d'un bloc qui avance fait après fait. Après `ajouter(f1)` … `ajouter(fk)`, il dit exactement ce que
 * dirait `calculerBloc([f1, …, fk], …)`, dans quelque ordre que les faits arrivent, sans relire les k faits à
 * chaque fois : un fait qui arrive après tous les autres (date, puis identifiant) ne coûte que sa propre lecture.
 *
 * Trois cas ne s'ajoutent pas simplement, et le suivi repart alors d'une relecture complète des faits qu'il a
 * (comme `calculerBloc`, sans tri quand l'ordre ne change pas) :
 * - un fait qui se range avant le dernier, ou qui reprend l'identifiant d'un fait déjà là avec une date plus
 *   tôt (le premier dans l'ordre l'emporte) : les faits sont retriés ;
 * - un tranchage qui change ce que la consolidation lit d'une correction déjà là : les séries sont à refaire ;
 * - un tranchage qui change si une correction déjà là ferme des erreurs : les erreurs sont à refaire, ainsi
 *   que les vérifications qui les accompagnent.
 * Ailleurs, la date d'« acquis provisoirement » est la seule autre chose qui fasse relire les faits : les
 * vérifications et les erreurs en dépendent, et elle est connue une fois pour toutes dès qu'elle l'est.
 * Une mise à reprendre (`echecsAvantDescente` relances ratées) relit aussi tout : les preuves repartent
 * des faits qui la suivent.
 */
export class SuiviBloc {
  readonly #manifeste: Manifeste
  readonly #reglages: Reglages
  /** Les faits du bloc dans l'ordre de `calculerBloc` : par date puis identifiant, sans doublon d'identifiant. */
  #faits: Fait[] = []
  #parId = new Map<string, Fait>()
  #etat: EtatBloc

  constructor(manifeste: Manifeste, reglages: Reglages) {
    this.#manifeste = manifeste
    this.#reglages = reglages
    this.#etat = construireEtat([], manifeste, reglages)
  }

  /** Un fait de plus. Un fait d'un autre bloc ne compte pas, comme dans `calculerBloc`. */
  ajouter(fait: Fait): void {
    if (fait.bloc !== this.#manifeste.bloc) return
    const homonyme = this.#parId.get(fait.id)
    if (homonyme !== undefined) {
      // Deux faits de même identifiant : le premier dans l'ordre compte, à date égale celui qui est arrivé d'abord.
      if (instantEnMs(fait.date) >= instantEnMs(homonyme.date)) return
      this.#retrier(fait, homonyme)
      return
    }
    const dernier = this.#faits.at(-1)
    if (dernier === undefined || comparerFaits(fait, dernier) > 0) this.#lire(fait)
    else this.#retrier(fait, undefined)
  }

  /** Le statut calculé après les faits ajoutés jusque-là : `calculerBloc(…).statutCalcule`. */
  statutCalcule(): Statut {
    return statutCalculeDeLEtat(this.#etat)
  }

  /** Ce que rendrait `calculerBloc` pour les faits ajoutés jusque-là. */
  resultat(maintenant: string): ResultatBloc {
    return assembler(etapesDe(this.#etat, maintenant), this.#manifeste, this.#reglages, maintenant)
  }

  /** Un fait qui vient après tous les autres. */
  #lire(fait: Fait): void {
    const etat = this.#etat
    this.#faits.push(fait)
    this.#parId.set(fait.id, fait)
    let reponseARevoir: Correction | undefined
    if (fait.type === 'correction_tranchee') {
      const cible = etat.corrections.get(fait.correction)
      const avant = lectureTranchee(etat.tranchages, cible)
      etat.tranchages.set(fait.correction, fait)
      const apres = lectureTranchee(etat.tranchages, cible)
      if (avant.consolidation !== apres.consolidation) {
        this.#recommencer()
        return
      }
      reponseARevoir = avant.ferme === apres.ferme ? undefined : cible
    }
    lirePreuves(etat, fait)
    const provisoire = provisoireDeLEtat(etat)
    if (provisoire !== etat.provisoire) {
      relireVerifications(etat, this.#faits, provisoire)
    } else {
      lireVerifications(etat, fait)
      if (reponseARevoir !== undefined) etat.erreurs.revoir(reponseARevoir)
    }
    // Une relance ratée de trop : le bloc est à reprendre, les preuves repartent d'après elle.
    if (etat.verifications?.reprise !== null && etat.verifications?.reprise !== undefined) {
      this.#recommencer()
    }
  }

  /** Un fait qui se range avant le dernier, ou qui prend la place d'un homonyme plus tardif. */
  #retrier(fait: Fait, remplace: Fait | undefined): void {
    const faits = this.#faits.filter((autre) => autre !== remplace)
    faits.push(fait)
    faits.sort(comparerFaits)
    this.#faits = faits
    this.#parId = new Map(faits.map((autre) => [autre.id, autre]))
    this.#recommencer()
  }

  /** Relit tous les faits depuis le début. */
  #recommencer(): void {
    this.#etat = construireEtat(this.#faits, this.#manifeste, this.#reglages)
  }
}
