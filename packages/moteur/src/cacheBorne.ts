/**
 * Une table qui repart de zéro quand elle atteint sa capacité : assez pour épargner un calcul que la
 * même lecture refait des dizaines de fois, sans jamais grossir sans fin dans un processus qui dure.
 */
export class CacheBorne<V> {
  readonly #valeurs = new Map<string, V>()
  readonly #capacite: number

  constructor(capacite: number) {
    this.#capacite = capacite
  }

  lire(cle: string): V | undefined {
    return this.#valeurs.get(cle)
  }

  ecrire(cle: string, valeur: V): void {
    if (this.#valeurs.size >= this.#capacite) this.#valeurs.clear()
    this.#valeurs.set(cle, valeur)
  }
}
