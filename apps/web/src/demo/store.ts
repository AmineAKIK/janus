import { EtatDemo, Reglages } from '@janus/contrats'
import { instantEnIso } from '@janus/moteur'

/** La clé de `localStorage` : la version est dans le nom, un changement de format repart de zéro. */
export const CLE_STOCKAGE = 'janus.demo.v1'

/** L'utilisateur de la démo : toujours le même, pour que les identifiants de la graine restent stables. */
const UTILISATEUR_DEMO = {
  id: '0190a000-0000-7000-8000-00000000d3a0',
  nom_utilisateur: 'amine',
  fuseau: 'Europe/Paris',
} as const

const MOT_DE_PASSE_INITIAL = 'demo-janus'

/** La session de l'appareil qui fait la requête : les autres sont dans l'état. */
export const SESSION_COURANTE = '0190a000-0000-7000-8000-00000000d3b0'

const HEURE_MS = 3_600_000

/** Deux autres appareils, pour montrer « Déconnecter » ; leurs dates suivent le premier lancement. */
function autresSessions(maintenant: string): EtatDemo['sessions'] {
  const ms = Date.parse(maintenant)
  const instant = (decalage: number) => instantEnIso(ms - decalage)
  return [
    {
      id: '0190a000-0000-7000-8000-00000000d3b1',
      appareil: 'Pixel 8 · Chrome',
      creee_le: instant(72 * HEURE_MS),
      derniere_activite: instant(2 * HEURE_MS),
    },
    {
      id: '0190a000-0000-7000-8000-00000000d3b2',
      appareil: 'Portable · Firefox',
      creee_le: instant(240 * HEURE_MS),
      derniere_activite: instant(30 * HEURE_MS),
    },
  ]
}

/** Le morceau de `localStorage` dont le store a besoin ; `null` quand le navigateur n'en donne pas. */
export type Stockage = Pick<Storage, 'getItem' | 'setItem'>

/** Un état sans aucun fait, connecté : le point de départ du mode « vide » et de la graine. */
export function etatVide(maintenant: string): EtatDemo {
  return {
    version: 1,
    premierLancement: maintenant,
    decalageMs: 0,
    utilisateur: { ...UTILISATEUR_DEMO },
    motDePasse: MOT_DE_PASSE_INITIAL,
    sessions: autresSessions(maintenant),
    sessionOuverte: false,
    echecsConnexion: [],
    connexionBloqueeJusqua: null,
    reglages: Reglages.parse({}),
    faits: [],
    etatsPage: {},
    rappels: {},
    serieDuJour: null,
    verifications: {},
    notesJournal: {},
    idees: [],
    cartes: {},
    idsRecus: [],
    interrupteurs: {
      correctionIndisponible: false,
      correctionNonVerifiee: false,
      plafondAtteint: false,
      horsConnexion: false,
      deuxFormations: false,
      ficheRefusee: false,
      reseauLent: false,
      toutFait: false,
      erreurIa: false,
    },
  }
}

export interface Magasin {
  readonly lire: () => EtatDemo
  /** Remplace l'état par celui que rend `modifier`, vérifié puis recopié dans le stockage. */
  readonly ecrire: (modifier: (etat: EtatDemo) => EtatDemo) => void
  /** Repart d'un état neuf. */
  readonly reinitialiser: (etat: EtatDemo) => void
}

export interface OptionsMagasin {
  /** `localStorage`, ou `null` s'il est indisponible : la démo marche alors sans persistance. */
  readonly stockage: Stockage | null
  /** L'état à créer au premier lancement (ou si le stockage est illisible). */
  readonly creerEtat: () => EtatDemo
}

function lireStocke(stockage: Stockage | null): EtatDemo | null {
  if (stockage === null) return null
  try {
    const brut = stockage.getItem(CLE_STOCKAGE)
    if (brut === null) return null
    const resultat = EtatDemo.safeParse(JSON.parse(brut))
    return resultat.success ? resultat.data : null
  } catch {
    return null
  }
}

/** Le store de la démo : en mémoire, recopié dans `localStorage` après chaque écriture. */
export function creerMagasin({ stockage, creerEtat }: OptionsMagasin): Magasin {
  let etat = lireStocke(stockage) ?? creerEtat()

  const conserver = () => {
    if (stockage === null) return
    try {
      stockage.setItem(CLE_STOCKAGE, JSON.stringify(etat))
    } catch {
      // Stockage plein ou refusé : la démo continue en mémoire.
    }
  }
  conserver()

  return {
    lire: () => etat,
    ecrire: (modifier) => {
      etat = EtatDemo.parse(modifier(etat))
      conserver()
    },
    reinitialiser: (neuf) => {
      etat = EtatDemo.parse(neuf)
      conserver()
    },
  }
}
