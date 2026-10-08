import { Manifeste, TypeEtape } from '@janus/contrats'
import type { Fait, NoteCarte, Reglages, TacheDuJour, TypeJournal } from '@janus/contrats'
import {
  aisanceDesBlocs,
  autonomie,
  blocsOuvertsSansPrerequis,
  calculerBloc,
  calibration,
  carteDuModule,
  depenseDuMois,
  ecartEnJours,
  echeances,
  erreursRecurrentes,
  exportTexte,
  fiabilite,
  lignesDuJournal,
  ouverturesSansPrerequis,
  pageDuJournal,
  retention,
  revueMethode,
  statutsForces,
  tempsActif,
} from '@janus/moteur'
import type { ControleCorrection, MesureTemps, Periode } from '@janus/moteur'
import { z } from 'zod'

export const PERIODE_PAR_DEFAUT: Periode = '30j'
const JOURS_A_VENIR = 7

/** Un bloc d'un module importé, avec le manifeste en service. */
export interface BlocImporte {
  readonly code: string
  readonly moduleCode: string
  /** `<code> <titre>` de la partie, vide pour un bloc hors partie. */
  readonly partie: string
  readonly manifeste: unknown
}

export interface EntreeTableau {
  readonly modules: readonly { readonly id: string; readonly titre: string }[]
  readonly module: string | undefined
  readonly periode: Periode | undefined
  readonly blocs: readonly BlocImporte[]
  readonly faits: readonly Fait[]
  readonly reglages: Reglages
  readonly maintenant: string
  readonly controles: readonly ControleCorrection[]
  readonly revuesCartes: readonly { readonly date: string; readonly note: NoteCarte }[]
  readonly mesuresTemps: readonly MesureTemps[]
  readonly derniereRevue: string | null
  readonly couts: readonly { readonly date: string; readonly millioniemes: number }[]
  readonly aujourdhui: { readonly jour: string; readonly taches: readonly TacheDuJour[] }
}

const Avis = z.looseObject({ correction: z.string(), accord: z.boolean() })
const DonneesTemps = z.looseObject({
  secondes: z.number().int().min(1),
  etape: TypeEtape.optional(),
})

/** Le contrôle de chaque correction rendue : l'avis d'Amine est le dernier donné. */
export function controlesDe(
  corrections: readonly {
    readonly id: string
    readonly date: string
    readonly echantillon: boolean
    readonly certitude: string
  }[],
  avis: readonly { readonly donnees: unknown }[],
): ControleCorrection[] {
  const accords = new Map<string, boolean>()
  for (const { donnees } of avis) {
    const lu = Avis.safeParse(donnees)
    if (lu.success) accords.set(lu.data.correction, lu.data.accord)
  }
  return corrections.map(({ id, date, echantillon, certitude }) => ({
    date,
    echantillon,
    nonVerifiee: certitude === 'non_verifie',
    accord: accords.get(id) ?? null,
  }))
}

/** Les mesures de temps actif, avec le code du bloc ; une ligne illisible est ignorée. */
export function mesuresDeTemps(
  lignes: readonly { readonly blocId: string; readonly date: string; readonly donnees: unknown }[],
  codes: ReadonlyMap<string, string>,
): MesureTemps[] {
  return lignes.flatMap(({ blocId, date, donnees }) => {
    const lu = DonneesTemps.safeParse(donnees)
    const bloc = codes.get(blocId)
    return lu.success && bloc !== undefined
      ? [{ date, bloc, secondes: lu.data.secondes, etape: lu.data.etape }]
      : []
  })
}

/** Le tableau de bord, calculé à la lecture avec les fonctions du moteur. */
export function composerTableau(entree: EntreeTableau) {
  const { faits, reglages, maintenant, aujourdhui } = entree
  const periode = entree.periode ?? PERIODE_PAR_DEFAUT
  const module =
    entree.modules.find(({ id }) => id === entree.module) ??
    (entree.module === undefined ? entree.modules[0] : undefined)

  const blocs = entree.blocs
    .filter(({ moduleCode }) => moduleCode === module?.id)
    .map(({ code, partie, manifeste }) => ({
      manifeste: Manifeste.parse(manifeste),
      partie,
      resultat: calculerBloc(
        faits.filter((fait) => fait.bloc === code),
        Manifeste.parse(manifeste),
        reglages,
        maintenant,
      ),
    }))
  const carte = carteDuModule(
    blocs.map(({ manifeste, partie, resultat }) => ({
      bloc: manifeste.bloc,
      partie,
      prerequis: manifeste.prerequis,
      statut: resultat.statut,
      force: resultat.force !== null,
      descendu: resultat.descendu,
    })),
    blocsOuvertsSansPrerequis(faits),
  )

  const restantes = aujourdhui.taches.filter(({ faite }) => !faite)
  const aVenir = blocs.filter(({ resultat }) => {
    const echeance = echeances(resultat, reglages)
    if (echeance?.genre !== 'jour') return false
    const ecart = ecartEnJours(aujourdhui.jour, echeance.apres)
    return ecart >= 1 && ecart <= JOURS_A_VENIR
  }).length

  const libelles = new Map(
    blocs.flatMap(({ manifeste }) =>
      manifeste.erreurs_critiques.map(({ id, libelle }): [string, string] => [id, libelle]),
    ),
  )
  const ouvertes = new Set(blocs.flatMap(({ resultat }) => resultat.erreursOuvertes))

  const plafond = reglages.plafondIaMillioniemes
  const depense = Math.min(plafond, depenseDuMois(entree.couts, maintenant, reglages))
  const mesureAutonomie = autonomie(faits, maintenant, reglages)
  const semainesRetention = retention(faits, entree.revuesCartes, maintenant, reglages)
  const controle = fiabilite(entree.controles, faits, periode, maintenant, reglages)
  const revue = revueMethode(
    faits,
    entree.mesuresTemps,
    entree.blocs.map(({ manifeste }) => Manifeste.parse(manifeste)),
    entree.derniereRevue,
    reglages,
  )
  const temps = tempsActif(entree.mesuresTemps, maintenant, reglages)
  const calibre = calibration(faits, periode, maintenant, reglages)
  const aisance = aisanceDesBlocs(
    blocs.map(({ manifeste }) => manifeste),
    faits,
    reglages,
  )
  const titreCourt = (bloc: string) =>
    blocs.find(({ manifeste }) => manifeste.bloc === bloc)?.manifeste.titre_court ?? bloc

  return {
    modules: entree.modules.map(({ id, titre }) => ({ id, titre })),
    module: module === undefined ? null : { id: module.id, titre: module.titre },
    periode,
    blocs: carte.map(
      ({ bloc, partie, statut, prerequis, force, redescendu, prerequisNonValides }) => ({
        bloc,
        titre_court: titreCourt(bloc),
        partie,
        statut,
        prerequis: [...prerequis],
        force,
        redescendu,
        prerequis_non_valides: prerequisNonValides,
      }),
    ),
    a_faire: {
      aujourdhui: restantes.length,
      a_venir: aVenir,
      taches: restantes.slice(0, 3),
    },
    erreurs: erreursRecurrentes(faits, libelles, ouvertes, periode, maintenant, reglages).map(
      ({ blocs: codes, ...erreur }) => ({ ...erreur, blocs: [...codes] }),
    ),
    decisions: {
      forces: statutsForces(faits, periode, maintenant, reglages),
      sans_prerequis: ouverturesSansPrerequis(faits, periode, maintenant, reglages),
    },
    mesures: {
      autonomie: {
        semaines: mesureAutonomie.semaines.map(({ debut, sansAide, total, part }) => ({
          debut,
          sans_aide: sansAide,
          total,
          part,
        })),
        aide_moyenne: mesureAutonomie.aideMoyenne,
      },
      retention: semainesRetention.map((semaine) => ({
        debut: semaine.debut,
        cartes: { ...semaine.cartes },
        questions: { ...semaine.questions },
        verifications: { ...semaine.verifications },
      })),
      calibration: {
        lignes: calibre.lignes.map((ligne) => ({ ...ligne })),
        erreurs_sures: calibre.erreursSuresCetteSemaine.map((erreur) => ({ ...erreur })),
      },
      aisance: aisance.map(({ bloc, titre, cible }) => ({
        bloc,
        titre_court: titre,
        cible:
          cible === null
            ? null
            : {
                libelle: cible.libelle,
                objectif_s: cible.objectifS,
                meilleur_s: cible.meilleurS,
                reussites: cible.reussites,
                reussites_requises: cible.reussitesRequises,
                jours: cible.jours,
                jours_requis: cible.joursRequis,
              },
      })),
      revue: {
        a_proposer: revue.aProposer,
        blocs_depuis: revue.blocsDepuis,
        blocs_requis: revue.blocsRequis,
        temps_s: revue.tempsS,
        pratique_s: revue.pratiqueS,
        a_reprendre: revue.aReprendre.map((notion) => ({ ...notion })),
        etapes_sautees: revue.etapesSautees.map((etape) => ({ ...etape })),
      },
      fiabilite: {
        copies_relues: controle.copiesRelues,
        desaccords: controle.desaccords,
        non_verifiees: controle.nonVerifiees,
        contestations: controle.contestations,
        alerte: controle.alerte,
      },
      temps: {
        total_s: temps.totalS,
        lecture_s: temps.groupes.lecture,
        pratique_s: temps.groupes.pratique,
        restitution_s: temps.groupes.restitution,
        blocs: temps.blocs.map(({ bloc, secondes }) => ({
          bloc,
          titre_court: titreCourt(bloc),
          secondes,
        })),
      },
    },
    cout_ia: { depense_millioniemes: depense, plafond_millioniemes: plafond },
  }
}

/** Une note du journal telle que l'écran la lit : la dernière version du texte, la date de la première. */
export interface NoteLue {
  readonly id: string
  readonly entree: string
  readonly date: string
  readonly texte: string
}

/** Les notes courantes : une note modifiée est une version de plus, la plus récente fait foi. */
export function notesCourantes(
  versions: readonly {
    readonly noteId: string
    readonly entree: string
    readonly texte: string
    readonly date: string
  }[],
): NoteLue[] {
  const notes = new Map<string, NoteLue>()
  for (const { noteId, entree, texte, date } of versions) {
    const precedente = notes.get(noteId)
    notes.set(noteId, { id: noteId, entree, texte, date: precedente?.date ?? date })
  }
  return [...notes.values()]
}

export interface EntreeJournal {
  readonly modules: readonly { readonly id: string; readonly titre: string }[]
  readonly blocs: readonly BlocImporte[]
  readonly faits: readonly Fait[]
  readonly reglages: Reglages
  readonly maintenant: string
  readonly requete: {
    readonly module?: string | undefined
    readonly bloc?: string | undefined
    readonly type?: TypeJournal | undefined
    readonly avant?: string | undefined
  }
  readonly notes: readonly NoteLue[]
  readonly idees: readonly { readonly id: string; readonly date: string; readonly texte: string }[]
}

const manifestesParCode = (blocs: readonly BlocImporte[]) =>
  Object.fromEntries(blocs.map(({ code, manifeste }) => [code, Manifeste.parse(manifeste)]))

/** Une page du journal : les lignes du moteur, filtrées, avec les notes d'Amine. */
export function composerJournal(entree: EntreeJournal) {
  const { blocs, faits, reglages, maintenant, requete } = entree
  const manifestes = manifestesParCode(blocs)
  const module = entree.modules.find(({ id }) => id === requete.module)
  const blocsDuModule =
    module === undefined
      ? null
      : new Set(blocs.filter(({ moduleCode }) => moduleCode === module.id).map(({ code }) => code))
  const lignes = lignesDuJournal(faits, { manifestes, reglages }).filter(
    ({ bloc }) => blocsDuModule === null || blocsDuModule.has(bloc),
  )
  const page = pageDuJournal(lignes, {
    ...(requete.bloc === undefined ? {} : { bloc: requete.bloc }),
    ...(requete.type === undefined ? {} : { type: requete.type }),
    ...(requete.avant === undefined ? {} : { avant: requete.avant }),
  })
  const affiche = module ?? entree.modules[0]
  return {
    modules: entree.modules.map(({ id, titre }) => ({ id, titre })),
    entrees: page.lignes.map((ligne) => ({
      id: ligne.id,
      date: ligne.date,
      bloc: ligne.bloc,
      type: ligne.type,
      resume: ligne.resume,
      detail: [...ligne.detail],
      ...(ligne.contestationEnAttente === undefined
        ? {}
        : { contestation_en_attente: ligne.contestationEnAttente }),
      note: entree.notes.find(({ entree: cible }) => cible === ligne.id) ?? null,
    })),
    suivant: page.suivant,
    blocs: blocs
      .filter(({ moduleCode }) => moduleCode === affiche?.id)
      .map(({ code }) => {
        const manifeste = manifestes[code]
        return manifeste === undefined
          ? []
          : [
              {
                bloc: code,
                titre_court: manifeste.titre_court,
                statut: calculerBloc(
                  faits.filter((fait) => fait.bloc === code),
                  manifeste,
                  reglages,
                  maintenant,
                ).statut,
              },
            ]
      })
      .flat(),
    idees: [...entree.idees].reverse(),
  }
}

/** Le journal au format de la méthode, en texte brut. */
export function composerExport(entree: {
  readonly blocs: readonly BlocImporte[]
  readonly faits: readonly Fait[]
  readonly reglages: Reglages
  readonly tachesReservees: readonly string[]
  readonly idees: readonly { readonly texte: string }[]
  readonly derniereRevue: string | null
}): string {
  return exportTexte({
    manifestes: entree.blocs.map(({ manifeste }) => Manifeste.parse(manifeste)),
    faits: entree.faits,
    reglages: entree.reglages,
    tachesReservees: entree.tachesReservees,
    idees: entree.idees.map(({ texte }) => texte),
    derniereRevue: entree.derniereRevue,
  })
}
