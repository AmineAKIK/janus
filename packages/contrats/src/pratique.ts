/**
 * La pratique d'un bloc rejouée depuis ses résultats : une seule règle, que le moteur applique pour
 * le statut et que la page applique pour dessiner les items (le pont l'embarque dans chaque fiche).
 * Les résultats sont la seule mémoire : la couleur d'un item, l'aide qu'il garde, le cas à refaire,
 * tout se relit d'eux. Ce fichier n'importe rien, pour rester léger dans le pont.
 *
 * Refaire après une aide (règle F03, décisions d'Amine du 1er novembre 2026) : ce qui fausse la
 * preuve, c'est la réponse encore sous les yeux. Une aide reçue reste donc à l'item (l'aide gardée),
 * et chaque résultat de l'item part avec elle, jusqu'à ce qu'un autre item soit réussi (même avec de
 * l'aide ; un « Pas réussi » ne suffit pas) ou que le jour change. L'item se refait alors sur l'autre
 * cas, et compte sans aide.
 */

export type CasItem = 'origine' | 'variante'

/** Un résultat de pratique, dans l'ordre où il a été noté. */
export interface EssaiPratique {
  readonly id: string
  readonly item: string
  readonly reussi: boolean
  /**
   * L'aide notée. `brute` : l'aide de cet essai seul, à laquelle le rejeu ajoute l'aide gardée ;
   * sans `brute` (les résultats d'avant cette règle), l'aide gardée y est déjà comptée.
   */
  readonly aide: number
  readonly brute: boolean
  /** Le jour du résultat, AAAA-MM-JJ, au sens de l'appli (fuseau et heure de bascule). */
  readonly jour: string
  /** Le cas sur lequel l'item a été fait ; `null` : l'outil ne le dit pas (le cas d'origine). */
  readonly cas: CasItem | null
}

interface Garde {
  readonly aide: number
  readonly jour: string
}

/** L'autre cas d'un item. */
export function autreCas(cas: CasItem): CasItem {
  return cas === 'variante' ? 'origine' : 'variante'
}

/** Un résultat où la solution a été montrée : l'aide 4 reçue, sans réussite. */
function solutionMontree(resultat: EssaiPratique): boolean {
  return resultat.aide >= 4 && !resultat.reussi
}

/**
 * Le rejeu de l'aide gardée, résultat après résultat : le moteur le fait avancer fait après fait,
 * `suivreLaPratique` sur toute la liste.
 */
export class RejeuPratique {
  readonly #gardes = new Map<string, Garde>()

  /** Note un résultat et rend l'aide qui compte pour lui : la sienne, ou l'aide gardée si elle est plus forte. */
  noter(resultat: EssaiPratique): number {
    const aide = resultat.brute
      ? Math.max(resultat.aide, this.aideGardee(resultat.item, resultat.jour))
      : resultat.aide
    if (aide > 0) this.#gardes.set(resultat.item, { aide, jour: resultat.jour })
    else this.#gardes.delete(resultat.item)
    // Un autre item réussi éloigne l'aide de tous les autres.
    if (resultat.reussi) {
      for (const item of [...this.#gardes.keys()]) {
        if (item !== resultat.item) this.#gardes.delete(item)
      }
    }
    return aide
  }

  /** L'aide que l'item garde ce jour-là, 0 s'il n'en garde pas. */
  aideGardee(item: string, jour: string): number {
    const garde = this.#gardes.get(item)
    return garde !== undefined && garde.jour === jour ? garde.aide : 0
  }

  /** Repart de zéro (la fiche recommencée) : plus aucune aide gardée. */
  couper(): void {
    this.#gardes.clear()
  }
}

/** Ce que la page dessine d'un item de pratique. */
export interface EtatItemPratique {
  /**
   * `reussi` : réussi sans aide, pour de bon (rien ne le défait). `aide` : réussi, toujours avec de
   * l'aide. `a_faire` : jamais réussi. Un item ne recule jamais.
   */
  readonly etat: 'a_faire' | 'aide' | 'reussi'
  readonly essais: number
  /** Le dernier résultat, avec l'aide qui a compté ; `null` avant le premier. */
  readonly dernier: { readonly reussi: boolean; readonly aide: number } | null
  /** L'aide que l'item garde aujourd'hui (0 : aucune) : son prochain résultat part avec elle. */
  readonly aideGardee: number
  /** La solution a été montrée, et l'item n'a pas été réussi depuis. */
  readonly solutionVue: boolean
  /** Réussi avec de l'aide, l'aide éloignée : il se refait sur l'autre cas et compte sans aide. */
  readonly refaire: boolean
  /** Réussi sans aide, il se rouvre sur l'autre cas : plus aucun autre item ne peut éloigner une aide. */
  readonly relais: boolean
  /** Une solution a déjà été montrée, ou l'item se refait : il ne se remontre pas avec sa réponse. */
  readonly marque: boolean
  /** Le cas sur lequel le montrer. */
  readonly cas: CasItem
  /** Les items à réussir pour éloigner l'aide gardée, dans l'ordre ; vide sans aide gardée. */
  readonly debloquePar: readonly string[]
}

interface Suivi {
  essais: number
  reussi: boolean
  sansAide: boolean
  dernier: { reussi: boolean; aide: number } | null
  dernierCas: CasItem
  /** Le cas du dernier résultat fait avec de l'aide. */
  casAide: CasItem | null
  /** Le cas de la dernière solution montrée, tant que l'item n'est pas réussi depuis. */
  casVu: CasItem | null
  vuUneFois: boolean
}

/**
 * Les items de pratique dans l'ordre du manifeste, d'après leurs résultats (dans l'ordre où ils ont
 * été notés, depuis la fiche recommencée) et le jour d'aujourd'hui.
 */
export function suivreLaPratique(
  ordre: readonly string[],
  resultats: readonly EssaiPratique[],
  aujourdhui: string,
): Map<string, EtatItemPratique> {
  const rejeu = new RejeuPratique()
  const suivis = new Map<string, Suivi>(
    ordre.map((item) => [
      item,
      {
        essais: 0,
        reussi: false,
        sansAide: false,
        dernier: null,
        dernierCas: 'origine',
        casAide: null,
        casVu: null,
        vuUneFois: false,
      },
    ]),
  )
  for (const resultat of resultats) {
    const suivi = suivis.get(resultat.item)
    const aide = rejeu.noter(resultat)
    if (suivi === undefined) continue
    const cas = resultat.cas ?? 'origine'
    suivi.essais += 1
    suivi.dernier = { reussi: resultat.reussi, aide }
    suivi.dernierCas = cas
    if (aide > 0) suivi.casAide = cas
    if (resultat.reussi) {
      suivi.reussi = true
      if (aide === 0) suivi.sansAide = true
      suivi.casVu = null
    } else if (solutionMontree(resultat)) {
      suivi.casVu = cas
      suivi.vuUneFois = true
    }
  }

  const gardee = (item: string) => rejeu.aideGardee(item, aujourdhui)
  const refaire = (item: string, suivi: Suivi) =>
    suivi.reussi && !suivi.sansAide && gardee(item) === 0
  // Un item qui éloigne une aide en étant réussi : pas encore réussi, ou à refaire.
  const faisable = (item: string, suivi: Suivi) => !suivi.reussi || refaire(item, suivi)
  const bloque = (item: string) =>
    gardee(item) > 0 &&
    [...suivis].every(([autre, suivi]) => autre === item || !faisable(autre, suivi))

  const etats = new Map<string, EtatItemPratique>()
  for (const [item, suivi] of suivis) {
    const aRefaire = refaire(item, suivi)
    const relais = suivi.sansAide && ordre.some((autre) => autre !== item && bloque(autre))
    const debloquePar =
      gardee(item) === 0 || suivi.sansAide
        ? []
        : ordre.filter((autre) => {
            if (autre === item) return false
            const sienne = suivis.get(autre) as Suivi
            return bloque(item) ? sienne.sansAide : faisable(autre, sienne)
          })
    etats.set(item, {
      etat: suivi.sansAide ? 'reussi' : suivi.reussi ? 'aide' : 'a_faire',
      essais: suivi.essais,
      dernier: suivi.dernier,
      aideGardee: gardee(item),
      solutionVue: suivi.casVu !== null,
      refaire: aRefaire,
      relais,
      marque: suivi.vuUneFois || aRefaire || relais,
      cas: relais
        ? autreCas(suivi.dernierCas)
        : aRefaire && suivi.casAide !== null
          ? autreCas(suivi.casAide)
          : suivi.casVu !== null
            ? autreCas(suivi.casVu)
            : suivi.dernierCas,
      debloquePar,
    })
  }
  return etats
}

/**
 * Un constat d'atelier, dans l'ordre où il a été envoyé : ce que l'apprenant a fait sur sa machine,
 * hors de la page, et l'aide qu'il dit avoir prise.
 */
export interface ConstatAtelier {
  readonly id: string
  readonly reussi: boolean
  readonly aide: number
  /** Le jour du constat, AAAA-MM-JJ, au sens de l'appli. */
  readonly jour: string
}

/**
 * L'aide de l'atelier se garde le jour où elle a été prise : un constat envoyé le même jour part avec
 * la plus forte aide déjà déclarée ce jour-là. Un autre jour, l'atelier refait sans aide compte.
 */
export class RejeuAtelier {
  #jour: string | null = null
  #aide = 0

  /** Note un constat et rend l'aide qui compte pour lui. */
  noter(constat: ConstatAtelier): number {
    const aide = Math.max(constat.aide, this.aideGardee(constat.jour))
    this.#jour = constat.jour
    this.#aide = aide
    return aide
  }

  /** L'aide que l'atelier garde ce jour-là, 0 s'il n'en garde pas. */
  aideGardee(jour: string): number {
    return jour === this.#jour ? this.#aide : 0
  }
}

/** Ce que la page dessine de l'atelier. */
export interface EtatAtelier {
  /** Réussi sans aide au moins une fois : il compte, pour de bon. */
  readonly reussi: boolean
  /** Le dernier constat, avec l'aide qui a compté ; `null` avant le premier. */
  readonly dernier: { readonly reussi: boolean; readonly aide: number } | null
  /** L'aide que l'atelier garde aujourd'hui (0 : aucune) : le prochain constat part avec elle. */
  readonly aideGardee: number
}

/** L'atelier d'un bloc, d'après ses constats (dans l'ordre où ils ont été envoyés) et le jour d'aujourd'hui. */
export function suivreLAtelier(
  constats: readonly ConstatAtelier[],
  aujourdhui: string,
): EtatAtelier {
  const rejeu = new RejeuAtelier()
  let reussi = false
  let dernier: EtatAtelier['dernier'] = null
  for (const constat of constats) {
    const aide = rejeu.noter(constat)
    dernier = { reussi: constat.reussi, aide }
    if (constat.reussi && aide === 0) reussi = true
  }
  return { reussi, dernier, aideGardee: rejeu.aideGardee(aujourdhui) }
}
