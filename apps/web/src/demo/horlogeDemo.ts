// L'horloge de la démo : l'heure réelle plus un décalage réglable, pour tester la consolidation, la
// vérification et le retest sans attendre. C'est le seul endroit de l'appli qui lit l'heure.

export interface HorlogeDemo {
  /** L'heure de la démo, en millisecondes depuis 1970. */
  readonly maintenantMs: () => number
  /** L'heure de la démo, en instant ISO 8601 UTC. */
  readonly maintenant: () => string
  /** L'heure réelle, sans décalage, en instant ISO 8601 UTC. */
  readonly reel: () => string
  readonly decalageMs: () => number
  /** Avance l'horloge de `ms` millisecondes (le temps ne recule pas). */
  readonly avancer: (ms: number) => void
}

/** Où le décalage est gardé : le store de la démo, pour qu'un rechargement le retrouve. */
export interface StockageDecalage {
  readonly lire: () => number
  readonly ecrire: (ms: number) => void
}

export interface OptionsHorloge {
  /** L'heure réelle ; `Date.now` par défaut. */
  readonly reelle?: () => number
  readonly decalage?: StockageDecalage
}

function decalageEnMemoire(): StockageDecalage {
  let valeur = 0
  return {
    lire: () => valeur,
    ecrire: (ms) => {
      valeur = ms
    },
  }
}

/** L'heure réelle, en instant ISO 8601 UTC. */
export function instantReel(): string {
  return new Date(Date.now()).toISOString()
}

export function creerHorlogeDemo(options: OptionsHorloge = {}): HorlogeDemo {
  const reelle = options.reelle ?? Date.now
  const decalage = options.decalage ?? decalageEnMemoire()
  const maintenantMs = () => reelle() + decalage.lire()
  return {
    maintenantMs,
    maintenant: () => new Date(maintenantMs()).toISOString(),
    reel: () => new Date(reelle()).toISOString(),
    decalageMs: decalage.lire,
    avancer: (ms) => {
      if (!Number.isInteger(ms) || ms < 0) {
        throw new RangeError(
          'On ne peut avancer l’horloge de démo que d’un nombre entier de millisecondes positif.',
        )
      }
      decalage.ecrire(decalage.lire() + ms)
    },
  }
}
