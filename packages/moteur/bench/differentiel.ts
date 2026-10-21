import { deepStrictEqual } from 'node:assert/strict'
import { argv } from 'node:process'
import { pathToFileURL } from 'node:url'
import type { Fait, Manifeste, Reglages } from '@janus/contrats'
import { Reglages as SchemaReglages } from '@janus/contrats'
import * as nouveau from '../src/index.ts'
import { generateur, MANIFESTE_BASE } from './donnees.ts'

// Compare le moteur courant à un moteur de référence (une autre copie de `src`) sur des jeux de faits
// tirés au hasard, volontairement tordus : dates ex aequo, identifiants en double, arrivée dans le
// désordre, tranchages, forçages, fuseaux et réglages variés.
//
//   node bench/differentiel.ts <chemin de l'index.ts de référence> [nombre de jeux] [graine]
//
// Sort avec un code non nul au premier écart.

const [reference = '', jeuxTexte = '300', graineTexte = '1'] = argv.slice(2)
if (reference === '') {
  console.error('Usage : node bench/differentiel.ts <index.ts de référence> [jeux] [graine]')
  process.exit(2)
}
function estMoteur(valeur: unknown): valeur is typeof nouveau {
  return typeof valeur === 'object' && valeur !== null && 'calculerBloc' in valeur
}
const charge: unknown = await import(pathToFileURL(reference).href)
if (!estMoteur(charge)) throw new Error(`Pas un moteur : ${reference}`)
const ancien = charge
const nJeux = Number(jeuxTexte)
const hasard = generateur(Number(graineTexte))
const entier = (min: number, max: number) => min + Math.floor(hasard() * (max - min + 1))
const choix = <T>(liste: readonly T[]): T => liste[Math.floor(hasard() * liste.length)] as T

const FUSEAUX = ['Europe/Paris', 'America/New_York', 'Asia/Kolkata', 'Pacific/Chatham', 'UTC']
const NIVEAUX = ['solide', 'solide', 'partiel', 'fragile', 'pas_encore'] as const
const T0 = Date.UTC(2026, 2, 20, 6, 0, 0)

function reglagesAleatoires(): Reglages {
  return SchemaReglages.parse({
    fuseau: choix(FUSEAUX),
    heureBascule: entier(0, 6),
    delaiVerificationJours: entier(1, 4),
    delaiRetestJours: choix([14, 20, 30]),
    delaiNouvelEssaiJours: entier(1, 3),
    echecsAvantDescente: entier(1, 3),
    heuresSansPageAvantVerification: choix([0, 24]),
    joursAvantReutilisation: choix([1, 5, 60]),
    blocsEntreRevues: choix([3, 4]),
  })
}

function manifesteAleatoire(bloc: string): Manifeste {
  const base: Manifeste = { ...MANIFESTE_BASE, bloc }
  const sansAisance = hasard() < 0.3
  const sansAtelier = hasard() < 0.3
  const { aisance, atelier, ...reste } = base
  // Parfois des identifiants en double : étape de même id mais de type différent.
  const doubles = hasard() < 0.25
  return {
    ...reste,
    ...(doubles
      ? {
          etapes: [
            { id: 'ET3', titre: 'Double', type: 'bilan' as const },
            ...base.etapes,
            { id: 'ET1', titre: 'Double', type: 'explication' as const },
          ],
        }
      : {}),
    ...(sansAisance || aisance === undefined ? {} : { aisance }),
    ...(sansAtelier || atelier === undefined ? {} : { atelier }),
    prerequis: hasard() < 0.3 ? ['B000'] : [],
  }
}

function faitsAleatoires(bloc: string, manifeste: Manifeste, n: number): Fait[] {
  const faits: Fait[] = []
  const fenetreJours = choix([2, 10, 60, 200])
  const ids = Array.from(
    { length: Math.max(3, Math.floor(n * 0.9)) },
    (_, i) => `${bloc}-f${String(i)}`,
  )
  const questions = [...manifeste.restitution, ...manifeste.rappel].map((q) => q.id)
  const reponses = (reussi: boolean) =>
    (['explication', 'tache', 'transfert'] as const).map((type) =>
      type === 'tache'
        ? { type, question: 'DT1', tour: hasard() < 0.9 ? 1 : 2, reussi, compte: hasard() < 0.9 }
        : {
            type,
            question: type === 'explication' ? 'DE1' : 'DR1',
            tour: hasard() < 0.9 ? 1 : 2,
            niveau: reussi ? ('solide' as const) : choix(NIVEAUX),
            compte: hasard() < 0.9,
          },
    )
  for (let i = 0; i < n; i += 1) {
    // Des minutes arrondies à 10 pour fabriquer des ex aequo ; parfois des millisecondes.
    const minutes = entier(0, fenetreJours * 24 * 6) * 10
    const ms = T0 + minutes * 60_000 + (hasard() < 0.1 ? entier(1, 999) : 0)
    const commun = {
      id: choix(ids),
      bloc,
      date: new Date(ms).toISOString().replace('.000Z', hasard() < 0.5 ? 'Z' : '.000Z'),
    }
    const r = hasard()
    if (r < 0.1) faits.push({ ...commun, type: 'bloc_ouvert', horsPrerequis: hasard() < 0.3 })
    else if (r < 0.2) {
      faits.push({ ...commun, type: 'etape_vue', etape: choix(manifeste.etapes.map((e) => e.id)) })
    } else if (r < 0.3) {
      faits.push({
        ...commun,
        type: 'pratique_resultat',
        exercice: 'PR1',
        item: choix(['PR1-1', 'PR1-2', 'PR1-3', 'PR1-9']),
        reussi: hasard() < 0.8,
        aide: choix([0, 0, 0, 1, 4] as const),
      })
    } else if (r < 0.34) {
      faits.push({
        ...commun,
        type: 'atelier_resultat',
        reussi: hasard() < 0.7,
        aide: choix([0, 0, 2] as const),
      })
    } else if (r < 0.4) {
      faits.push({
        ...commun,
        type: 'aisance_resultat',
        reussi: hasard() < 0.7,
        dureeS: entier(10, 50),
      })
    } else if (r < 0.65) {
      faits.push({
        ...commun,
        type: 'correction',
        serie: choix([
          'restitution',
          'restitution',
          'consolidation',
          'rappel',
          'verification',
        ] as const),
        question: hasard() < 0.95 ? choix(questions) : 'Q-inconnue',
        tour: hasard() < 0.9 ? 1 : 2,
        niveau: choix(NIVEAUX),
        compte: hasard() < 0.9,
        confiance: choix(['sur', 'hesitant', 'hasard'] as const),
        erreursIa: hasard() < 0.1 ? ['E1'] : [],
      })
    } else if (r < 0.7) {
      faits.push({ ...commun, type: 'correction_contestee', correction: choix(ids) })
    } else if (r < 0.76) {
      faits.push({
        ...commun,
        type: 'correction_tranchee',
        correction: choix(ids),
        compte: hasard() < 0.5,
        ...(hasard() < 0.6 ? { niveau: choix(NIVEAUX) } : {}),
      })
    } else if (r < 0.79) {
      faits.push({
        ...commun,
        type: 'erreur_ia_tranchee',
        correction: choix(ids),
        erreur: choix(['E1', 'E2']),
        decision: choix(['confirmee', 'rejetee'] as const),
      })
    } else if (r < 0.87) {
      faits.push({
        ...commun,
        type: 'verification_terminee',
        verification: choix(['verification', 'retest', 'entretien'] as const),
        valable: hasard() < 0.9,
        reponses: reponses(hasard() < 0.7),
      })
    } else if (r < 0.92) {
      faits.push({
        ...commun,
        type: choix(['erreur_cochee', 'erreur_decochee'] as const),
        erreur: choix(['E1', 'E2', 'E3']),
        source: choix(['amine', 'ia_confirmee'] as const),
      })
    } else if (r < 0.96) {
      faits.push({
        ...commun,
        type: 'statut_force',
        statut: choix(['acquis', 'maitrise', 'vu'] as const),
        raison: 'Forcé',
      })
    } else faits.push({ ...commun, type: 'force_levee' })
  }
  // Désordre d'arrivée.
  for (let i = faits.length - 1; i > 0 && hasard() < 0.9; i -= 1) {
    const j = entier(0, i)
    const tmp = faits[i] as Fait
    faits[i] = faits[j] as Fait
    faits[j] = tmp
  }
  return faits
}

/** Une chronologie en bon ordre qui va jusqu'au bout, pour atteindre les branches « acquis » et « maîtrisé ». */
function faitsDeParcours(bloc: string, manifeste: Manifeste): Fait[] {
  const faits: Fait[] = []
  let numero = 0
  const ajoute = (ms: number, donnees: Omit<Fait, 'id' | 'bloc' | 'date'> | object) => {
    numero += 1
    faits.push({
      id: `${bloc}-p${String(numero)}`,
      bloc,
      date: new Date(ms).toISOString(),
      ...donnees,
    } as Fait)
  }
  const jour = 86_400_000
  const t = T0 + entier(0, 3) * jour
  for (const [i, q] of manifeste.restitution.entries()) {
    ajoute(t + i * 60_000, {
      type: 'correction',
      serie: 'restitution',
      question: q.id,
      tour: 1,
      niveau: 'solide',
      compte: true,
      confiance: 'sur',
      erreursIa: [],
    })
  }
  for (let i = 1; i <= 2; i += 1) {
    ajoute(t + 3_600_000 + i * 60_000, {
      type: 'pratique_resultat',
      exercice: 'PR1',
      item: `PR1-${String(i)}`,
      reussi: true,
      aide: 0,
    })
  }
  ajoute(t + 3_700_000, { type: 'atelier_resultat', reussi: true, aide: 0 })
  const reussie = [
    { type: 'explication', question: 'DE1', tour: 1, niveau: 'solide', compte: true },
    { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: true },
    { type: 'transfert', question: 'DR1', tour: 1, niveau: 'solide', compte: true },
  ]
  ajoute(t + 6 * jour, {
    type: 'verification_terminee',
    verification: 'verification',
    valable: true,
    reponses: reussie,
  })
  ajoute(t + 40 * jour, {
    type: 'verification_terminee',
    verification: 'retest',
    valable: true,
    reponses: reussie,
  })
  ajoute(t + 41 * jour, { type: 'aisance_resultat', reussi: true, dureeS: 20 })
  ajoute(t + 42 * jour, { type: 'aisance_resultat', reussi: true, dureeS: 22 })
  return faits
}

let comparaisons = 0
/** Ce que les jeux ont fait voir : statuts et manques rencontrés, pour savoir si la comparaison couvre les branches. */
const couverture = new Map<string, number>()
function memes(nom: string, graine: number, produire: (moteur: typeof nouveau) => unknown): void {
  let a: unknown
  let b: unknown
  try {
    a = produire(ancien)
  } catch (erreur) {
    a = { erreur: erreur instanceof Error ? erreur.message : String(erreur) }
  }
  try {
    b = produire(nouveau)
  } catch (erreur) {
    b = { erreur: erreur instanceof Error ? erreur.message : String(erreur) }
  }
  comparaisons += 1
  try {
    deepStrictEqual(b, a)
  } catch (erreur) {
    console.error(`ÉCART sur ${nom} (jeu ${String(graine)})`)
    console.error(erreur instanceof Error ? erreur.message.slice(0, 3000) : erreur)
    process.exit(1)
  }
}

for (let jeu = 0; jeu < nJeux; jeu += 1) {
  const reglages = reglagesAleatoires()
  const nBlocs = entier(1, 4)
  const blocs = Array.from({ length: nBlocs }, (_, i) => {
    const code = `B${String(i).padStart(3, '0')}`
    const manifeste = manifesteAleatoire(code)
    return {
      code,
      moduleCode: i < 2 ? 'M0' : 'M1',
      partie: '1.1 Partie',
      manifeste,
    }
  })
  const faits = blocs.flatMap(({ code, manifeste }) => {
    // Le parcours entier, ou amputé de la fin pour passer par les statuts intermédiaires.
    const parcours = faitsDeParcours(code, manifeste)
    const base = hasard() < 0.6 ? parcours.slice(0, entier(0, parcours.length)) : []
    return [...base, ...faitsAleatoires(code, manifeste, entier(0, hasard() < 0.1 ? 150 : 40))]
  })
  const maintenants = [0, 1, 5, 45, 400].map((jours) =>
    new Date(T0 + jours * 86_400_000 + entier(0, 86_400) * 1000).toISOString(),
  )
  const modules = [
    { id: 'M0', titre: 'Zéro' },
    { id: 'M1', titre: 'Un' },
  ]
  // Le suivi fait après fait du moteur courant dit, après chaque fait reçu, ce que dit `calculerBloc` du
  // moteur de référence sur les faits reçus jusque-là : dans l'ordre d'arrivée tordu, et trié par date.
  for (const { code, manifeste } of blocs) {
    const duBloc = faits.filter((fait) => fait.bloc === code)
    const parDate = duBloc.toSorted((a, b) => Date.parse(a.date) - Date.parse(b.date))
    for (const arrivee of [duBloc, parDate]) {
      const suivi = new nouveau.SuiviBloc(manifeste, reglages)
      for (const [rang, fait] of arrivee.entries()) {
        suivi.ajouter(fait)
        const recus = arrivee.slice(0, rang + 1)
        for (const maintenant of [fait.date, maintenants[3] ?? fait.date]) {
          comparaisons += 1
          const attendu = ancien.calculerBloc(recus, manifeste, reglages, maintenant)
          try {
            deepStrictEqual(suivi.resultat(maintenant), attendu)
            deepStrictEqual(suivi.statutCalcule(), attendu.statutCalcule)
          } catch (erreur) {
            console.error(
              `ÉCART sur le suivi du bloc ${code} après ${String(rang + 1)} faits (jeu ${String(jeu)})`,
            )
            console.error(erreur instanceof Error ? erreur.message.slice(0, 3000) : erreur)
            process.exit(1)
          }
        }
      }
    }
  }
  for (const maintenant of maintenants) {
    for (const { code, manifeste } of blocs) {
      const duBloc = faits.filter((fait) => fait.bloc === code)
      memes('calculerBloc', jeu, (m) => m.calculerBloc(duBloc, manifeste, reglages, maintenant))
      const vu = nouveau.calculerBloc(duBloc, manifeste, reglages, maintenant)
      couverture.set(vu.statutCalcule, (couverture.get(vu.statutCalcule) ?? 0) + 1)
      for (const { code: manque } of vu.manque)
        couverture.set(manque, (couverture.get(manque) ?? 0) + 1)
      if (vu.descendu) couverture.set('descendu', (couverture.get('descendu') ?? 0) + 1)
      if (vu.force !== null) couverture.set('force', (couverture.get('force') ?? 0) + 1)
      memes('calculerBloc+echeances', jeu, (m) =>
        m.echeances(m.calculerBloc(duBloc, manifeste, reglages, maintenant), reglages),
      )
    }
    const manifestes = Object.fromEntries(blocs.map(({ code, manifeste }) => [code, manifeste]))
    memes('lignesDuJournal', jeu, (m) => m.lignesDuJournal(faits, { manifestes, reglages }))
    const derniereRevue = choix([null, maintenants[1] ?? null])
    const moduleChoisi = choix([undefined, 'M1'])
    const controles = faits.slice(0, 20).map((fait) => ({
      date: fait.date,
      echantillon: true,
      nonVerifiee: false,
      accord: choix([true, false, null]),
    }))
    memes('revueMethode', jeu, (m) =>
      m.revueMethode(
        faits,
        [],
        blocs.map(({ manifeste }) => manifeste),
        derniereRevue,
        reglages,
      ),
    )
    for (const requete of [
      {},
      { module: 'M1' },
      { bloc: 'B000', type: 'verification' as const },
      { avant: maintenants[2] },
    ]) {
      memes('composerJournal', jeu, (m) =>
        m.composerJournal({
          modules,
          blocs,
          faits,
          reglages,
          maintenant,
          requete,
          notes: [],
          idees: [],
        }),
      )
    }
    memes('composerExport', jeu, (m) =>
      m.composerExport({
        blocs,
        faits,
        reglages,
        tachesReservees: [],
        idees: [],
        derniereRevue: null,
      }),
    )
    for (const periode of ['7j', '30j', 'tout'] as const) {
      memes('composerTableau', jeu, (m) =>
        m.composerTableau({
          modules,
          module: moduleChoisi,
          periode,
          blocs,
          faits,
          reglages,
          maintenant,
          controles,
          revuesCartes: faits
            .slice(0, 20)
            .map((fait) => ({ date: fait.date, note: 'bien' as const })),
          mesuresTemps: faits.slice(0, 20).map((fait) => ({
            date: fait.date,
            bloc: fait.bloc,
            secondes: 30,
            etape: 'pratique' as const,
          })),
          derniereRevue: null,
          couts: faits.slice(0, 20).map((fait) => ({ date: fait.date, millioniemes: 10 })),
          aujourdhui: { jour: maintenant.slice(0, 10), taches: [] },
        }),
      )
    }
    memes('fileDuJour', jeu, (m) => {
      const etats = blocs.map(({ code, manifeste }) => {
        const duBloc = faits.filter((fait) => fait.bloc === code)
        return {
          manifeste,
          etat: m.calculerBloc(duBloc, manifeste, reglages, maintenant),
          dernierFait: duBloc.reduce<string | null>(
            (max, f) => (max === null || f.date > max ? f.date : max),
            null,
          ),
        }
      })
      return m.fileDuJour({
        blocs: etats,
        questionsDebut: 6,
        cartes: { dues: ['c1'], nouvelles: [] },
        derniereActivite: maintenant,
        maintenant,
        reglages,
      })
    })
    memes('seances', jeu, (m) => m.seances(faits, reglages))
    memes('questionsDebut', jeu, (m) =>
      m.choisirQuestionsDebut(
        blocs.map(({ manifeste }) => ({ manifeste, prerequisDuBlocEnCours: false })),
        faits,
        reglages,
        jeu,
      ),
    )
    memes('tirerDifferee', jeu, (m) =>
      m.tirerDifferee(
        blocs[0]?.manifeste as Manifeste,
        'explication',
        faits
          .slice(0, 15)
          .map((fait, i) => ({ question: `DE${String((i % 3) + 1)}`, date: fait.date })),
        maintenant,
        reglages,
      ),
    )
    memes('indicateurs', jeu, (m) => ({
      autonomie: m.autonomie(faits, maintenant, reglages),
      retention: m.retention(
        faits,
        faits.slice(0, 10).map((f) => ({ date: f.date, note: 'bien' as const })),
        maintenant,
        reglages,
      ),
      calibration: m.calibration(faits, '30j', maintenant, reglages),
      erreurs: m.erreursRecurrentes(
        faits,
        new Map(),
        new Set(['E1']),
        'tout',
        maintenant,
        reglages,
      ),
      aisance: m.aisanceDesBlocs(
        blocs.map(({ manifeste }) => manifeste),
        faits,
        reglages,
      ),
      forces: m.statutsForces(faits, '7j', maintenant, reglages),
      depense: m.depenseDuMois(
        faits.slice(0, 9).map((f) => ({ date: f.date, millioniemes: 3 })),
        maintenant,
        reglages,
      ),
    }))
  }
  const nbMois = entier(-5, 14)
  const sansAvant = (m: typeof nouveau) => ({
    debut: m.debutDuJour(
      maintenants[0]?.slice(0, 10) ?? '2026-03-20',
      reglages.fuseau,
      reglages.heureBascule,
    ),
    mois: m.ajouterMois('2026-01-31', nbMois),
  })
  memes('debutDuJour', jeu, sansAvant)
}

console.log(`Rencontré : ${[...couverture].map(([cle, n]) => `${cle}=${String(n)}`).join(' ')}`)
console.log(`OK : ${String(comparaisons)} comparaisons identiques sur ${String(nJeux)} jeux`)
