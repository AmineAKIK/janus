import {
  corrigerSimule,
  DELAI_CORRECTION_SIMULEE_MS,
  ErreurApi,
  nouvelId,
  PREFIXE_CORRECTION_SIMULEE,
  ROUTES,
} from '@janus/contrats'
import type {
  Differee,
  EtatDemo,
  Fait,
  Manifeste,
  ReponseVerification,
  SortieRoute,
  Statut,
  TypeDifferee,
  TypeVerification,
  VerificationDemo,
} from '@janus/contrats'
import {
  ajouterJours,
  compositionReussie,
  compte,
  echeances,
  estRecopiee,
  jourDe,
  tirerDifferee,
  validiteVerification,
} from '@janus/moteur'
import { MANIFESTES_GRAINE } from '../graine.ts'
import type { Magasin } from '../store.ts'
import { dejaRecu, enregistrer, faitsDuBloc, resultatDuBloc } from './calculs.ts'
import { definir } from './definir.ts'

type Resultat = NonNullable<VerificationDemo['resultat']>
type PartieDuResultat = Resultat['parties'][number]

const TYPES_DE_PARTIES: readonly TypeDifferee[] = ['explication', 'tache', 'transfert']
const ORDRE_DES_STATUTS: readonly Statut[] = [
  'a_reprendre',
  'non_commence',
  'en_cours',
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
]
const LONGUEUR_EXTRAIT = 160

function probleme(
  status: number,
  code: ConstructorParameters<typeof ErreurApi>[0]['code'],
  titre: string,
  detail: string,
) {
  return new ErreurApi({ status, code, titre, detail })
}

const jourDuReglage = (etat: EtatDemo, instant: string) =>
  jourDe(instant, etat.reglages.fuseau, etat.reglages.heureBascule)

/** Tire les trois parties d'une vérification : une question de chaque type, jamais la même deux fois de suite. */
function tirerParties(etat: EtatDemo, manifeste: Manifeste, maintenant: string) {
  const dejaPosees = faitsDuBloc(etat, manifeste.bloc).flatMap((fait) =>
    fait.type === 'verification_terminee'
      ? fait.reponses.map(({ question }) => ({ question, date: fait.date }))
      : [],
  )
  return TYPES_DE_PARTIES.flatMap((type) => {
    const differee = tirerDifferee(manifeste, type, dejaPosees, maintenant, etat.reglages)
    return differee === null ? [] : [{ id: differee.id, type }]
  })
}

const TYPES_ENCODES: readonly TypeVerification[] = ['verification', 'retest', 'entretien']
const PREFIXE_IDENTIFIANT = '0190a000-0000-7000-8000-'

/**
 * L'identifiant d'une vérification de la démo : il se lit à l'envers (bloc, type, numéro), ce qui
 * permet d'ouvrir une adresse `/verifications/<identifiant>` sans passer par Aujourd'hui.
 */
export function identifiantVerification(
  bloc: string,
  type: TypeVerification,
  numero: number,
): string {
  const hex = (valeur: number, largeur: number) => valeur.toString(16).padStart(largeur, '0')
  const codes = Array.from(bloc, (lettre) => hex(lettre.charCodeAt(0), 2)).join('')
  return `${PREFIXE_IDENTIFIANT}${hex(TYPES_ENCODES.indexOf(type), 1)}${hex(numero, 2)}${codes}`.padEnd(
    PREFIXE_IDENTIFIANT.length + 12,
    '0',
  )
}

function decoder(id: string): { bloc: string; type: TypeVerification } | null {
  if (!id.startsWith(PREFIXE_IDENTIFIANT)) return null
  const fin = id.slice(PREFIXE_IDENTIFIANT.length)
  const type = TYPES_ENCODES[Number.parseInt(fin.slice(0, 1), 16)]
  const lettres = fin.slice(3).match(/../gu) ?? []
  const bloc = lettres
    .map((hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .join('')
    .replace(/\0+$/u, '')
  return type === undefined || MANIFESTES_GRAINE[bloc] === undefined ? null : { bloc, type }
}

function creer(
  magasin: Magasin,
  id: string,
  bloc: string,
  type: TypeVerification,
  maintenant: string,
) {
  const manifeste = MANIFESTES_GRAINE[bloc]
  if (manifeste === undefined) return
  const parties = tirerParties(magasin.lire(), manifeste, maintenant)
  magasin.ecrire((avant) => ({
    ...avant,
    verifications: {
      ...avant.verifications,
      [id]: {
        bloc,
        type,
        parties,
        debut: null,
        reponses: {},
        reporteeJusqua: null,
        resultat: null,
      },
    },
  }))
}

/**
 * L'identifiant de la vérification en cours d'un bloc, créée à la première demande : l'écran
 * Aujourd'hui en a besoin pour son lien. Une vérification terminée n'est jamais rouverte.
 */
export function verificationPour(
  magasin: Magasin,
  bloc: string,
  type: TypeVerification,
  maintenant: string,
): string | null {
  if (MANIFESTES_GRAINE[bloc] === undefined) return null
  const memes = Object.entries(magasin.lire().verifications).filter(
    ([, v]) => v.bloc === bloc && v.type === type,
  )
  const enCours = memes.find(([, v]) => v.resultat === null)
  if (enCours !== undefined) return enCours[0]
  const id = identifiantVerification(bloc, type, memes.length)
  creer(magasin, id, bloc, type, maintenant)
  return id
}

/** Les blocs dont une vérification est reportée au-delà de ce jour : la file du jour ne les propose plus. */
export function blocsReportes(etat: EtatDemo, jour: string): ReadonlySet<string> {
  return new Set(
    Object.values(etat.verifications)
      .filter((v) => v.resultat === null && v.reporteeJusqua !== null && v.reporteeJusqua > jour)
      .map((v) => v.bloc),
  )
}

function lire(magasin: Magasin, id: string, maintenant: string) {
  const decode = decoder(id)
  if (magasin.lire().verifications[id] === undefined && decode !== null) {
    creer(magasin, id, decode.bloc, decode.type, maintenant)
  }
  const verification = magasin.lire().verifications[id]
  if (verification === undefined) {
    throw probleme(404, 'introuvable', 'Introuvable', 'Cette vérification n’existe pas.')
  }
  const manifeste = MANIFESTES_GRAINE[verification.bloc]
  if (manifeste === undefined) {
    throw probleme(404, 'introuvable', 'Introuvable', 'Ce bloc n’existe pas.')
  }
  return { verification, manifeste }
}

function partieDeManifeste(manifeste: Manifeste, id: string): Differee {
  const differee = manifeste.differees.find((candidate) => candidate.id === id)
  if (differee === undefined) {
    throw probleme(404, 'introuvable', 'Introuvable', `La partie « ${id} » n’existe pas.`)
  }
  return differee
}

/** Vrai si la page du bloc a été ouverte dans la fenêtre sans page avant une vérification. */
function revuRecemment(
  etat: EtatDemo,
  bloc: string,
  maintenant: string,
): 'hier' | 'aujourdhui' | null {
  const fenetreMs = etat.reglages.heuresSansPageAvantVerification * 3_600_000
  const ouvertures = faitsDuBloc(etat, bloc).filter(
    (fait) =>
      fait.type === 'bloc_ouvert' &&
      Date.parse(maintenant) - Date.parse(fait.date) <= fenetreMs &&
      Date.parse(fait.date) <= Date.parse(maintenant),
  )
  const derniere = ouvertures
    .map(({ date }) => date)
    .sort()
    .at(-1)
  if (derniere === undefined) return null
  return jourDuReglage(etat, derniere) === jourDuReglage(etat, maintenant) ? 'aujourdhui' : 'hier'
}

function dateDue(etat: EtatDemo, v: VerificationDemo, maintenant: string): string {
  const echeance = echeances(resultatDuBloc(etat, v.bloc, maintenant), etat.reglages)
  const jour = jourDuReglage(etat, maintenant)
  const attendue = echeance?.genre === 'jour' ? echeance.apres : jour
  return v.reporteeJusqua !== null && v.reporteeJusqua > attendue ? v.reporteeJusqua : attendue
}

interface PartieCorrigee {
  readonly niveau?: PartieDuResultat['niveau']
  readonly reussi?: boolean
  readonly cas?: PartieDuResultat['cas']
  readonly compte: boolean
  readonly correction: string
  readonly indice?: string
}

function corrigerPartie(
  etat: EtatDemo,
  differee: Differee,
  corps: {
    reponse: string
    support: { colle: boolean; retour_cours: boolean }
    code?: { reussis: number; total: number } | undefined
  },
): PartieCorrigee {
  const certitude = etat.interrupteurs.correctionNonVerifiee ? 'non_verifie' : 'sur'
  const comptee = (recopiee: boolean) =>
    compte({
      tour: 1,
      colle: corps.support.colle,
      retourCours: corps.support.retour_cours,
      recopiee,
      certitude: differee.type === 'tache' ? 'sur' : certitude,
    })
  if (differee.type === 'tache') {
    const { verification } = differee
    if (verification?.mode === 'code') {
      if (corps.code === undefined) {
        throw probleme(
          400,
          'donnees_invalides',
          'Code non testé',
          'Teste ton code avant de l’envoyer.',
        )
      }
      const { reussis, total } = corps.code
      const reussi = reussis === total && total >= verification.cas.length
      const resultat = comptee(false)
      return {
        reussi,
        cas: { reussis, total },
        compte: resultat.compte,
        correction: `${String(reussis)} cas sur ${String(total)}.`,
      }
    }
    const reussi = (verification?.reponses ?? [differee.attendu]).some(
      (attendue) => attendue === corps.reponse.trim(),
    )
    return {
      reussi,
      compte: comptee(false).compte,
      correction: reussi ? 'Réponse exacte.' : `Attendu : ${differee.attendu}`,
    }
  }
  const correction = corrigerSimule(corps.reponse, differee.attendu)
  if (correction.refusee) {
    throw probleme(400, 'donnees_invalides', 'Réponse refusée', correction.message)
  }
  const resultat = comptee(
    estRecopiee(corps.reponse, [differee.attendu], etat.reglages.seuilRecopie),
  )
  return {
    niveau: correction.niveau,
    compte: resultat.compte,
    correction: correction.message,
    ...(correction.indice === undefined ? {} : { indice: correction.indice }),
  }
}

const rang = (statut: Statut) => ORDRE_DES_STATUTS.indexOf(statut)

function reponseDeFait(
  partie: { id: string; type: TypeDifferee },
  corrigee: VerificationDemo['reponses'][string],
): ReponseVerification {
  const commun = { question: partie.id, tour: 1, compte: corrigee.compte }
  if (partie.type === 'tache') {
    return {
      type: 'tache',
      ...commun,
      ...(corrigee.reussi === undefined ? {} : { reussi: corrigee.reussi }),
    }
  }
  return {
    type: partie.type,
    ...commun,
    ...(corrigee.niveau === undefined ? {} : { niveau: corrigee.niveau }),
  }
}

export interface OptionsVerifications {
  /** Délai simulé de la correction finale, en millisecondes (800 par défaut). */
  readonly delaiCorrectionMs?: number
}

export function routesVerificationsDemo({
  delaiCorrectionMs = DELAI_CORRECTION_SIMULEE_MS,
}: OptionsVerifications = {}) {
  return [
    definir(ROUTES['GET /verifications/:id'], ({ magasin, horloge, params }) => {
      const { verification, manifeste } = lire(magasin, params.id, horloge.maintenant())
      const etat = magasin.lire()
      const maintenant = horloge.maintenant()
      const terminee = verification.resultat !== null
      return {
        id: params.id,
        type: verification.type,
        due_le: dateDue(etat, verification, maintenant),
        terminee,
        revu_recemment:
          terminee || verification.debut !== null
            ? null
            : revuRecemment(etat, verification.bloc, maintenant),
        parties: verification.parties.map(({ id, type }) => {
          const differee = partieDeManifeste(manifeste, id)
          const mode = differee.verification
          return {
            id,
            type,
            consigne: differee.consigne,
            ...(type === 'tache' && mode?.mode === 'code'
              ? { tache: { mode: 'code' as const, langage: mode.langage, cas: mode.cas } }
              : type === 'tache'
                ? { tache: { mode: 'exacte' as const } }
                : {}),
            envoyee: verification.reponses[id] !== undefined,
          }
        }),
        resultat: verification.resultat,
      }
    }),

    definir(ROUTES['POST /verifications/:id/reporter'], ({ magasin, horloge, params, corps }) => {
      const { verification } = lire(magasin, params.id, horloge.maintenant())
      const etat = magasin.lire()
      const maintenant = horloge.maintenant()
      const demain = ajouterJours(jourDuReglage(etat, maintenant), 1)
      if (verification.resultat !== null) {
        throw probleme(409, 'conflit', 'Déjà terminée', 'Cette vérification est terminée.')
      }
      if (!dejaRecu(etat, corps.id)) {
        magasin.ecrire((avant) => ({
          ...avant,
          idsRecus: [...avant.idsRecus, corps.id],
          verifications: {
            ...avant.verifications,
            [params.id]: { ...verification, reporteeJusqua: demain },
          },
        }))
      }
      return { due_le: demain }
    }),

    definir(
      ROUTES['POST /verifications/:id/reponses'],
      async ({ magasin, horloge, attendre, params, corps }) => {
        const { verification, manifeste } = lire(magasin, params.id, horloge.maintenant())
        const etat = magasin.lire()
        const maintenant = horloge.maintenant()
        if (etat.interrupteurs.correctionIndisponible) {
          throw probleme(
            503,
            'erreur_interne',
            'Correction indisponible',
            'La correction ne répond pas.',
          )
        }
        if (etat.interrupteurs.plafondAtteint) {
          throw probleme(
            429,
            'budget_atteint',
            'Plafond atteint',
            'Le plafond mensuel de l’IA est atteint.',
          )
        }
        const partie = verification.parties.find(({ id }) => id === corps.partie)
        if (partie === undefined) {
          throw probleme(
            404,
            'introuvable',
            'Introuvable',
            `La partie « ${corps.partie} » n’existe pas.`,
          )
        }
        const dejaEnvoyee = verification.reponses[partie.id] !== undefined
        const restantes = verification.parties.filter(
          ({ id }) => verification.reponses[id] === undefined,
        )
        const derniere = restantes.length === 1 && !dejaEnvoyee
        if (dejaRecu(etat, corps.id) || dejaEnvoyee) {
          return {
            partie: partie.id,
            terminee: verification.resultat !== null,
            ...(verification.resultat === null ? {} : { resultat: verification.resultat }),
          }
        }
        if (derniere) await attendre(delaiCorrectionMs)

        const differee = partieDeManifeste(manifeste, partie.id)
        const corrigee = corrigerPartie(etat, differee, corps)
        const debut = verification.debut ?? maintenant
        const reponses = {
          ...verification.reponses,
          [partie.id]: { date: maintenant, reponse: corps.reponse, ...corrigee },
        }
        const suivi: VerificationDemo = { ...verification, debut, reponses }

        if (!derniere) {
          magasin.ecrire((avant) => ({
            ...avant,
            idsRecus: [...avant.idsRecus, corps.id],
            verifications: { ...avant.verifications, [params.id]: suivi },
          }))
          return { partie: partie.id, terminee: false }
        }

        // Dernière partie : le fait est enregistré et le moteur recalcule le statut.
        const reponsesDeFait = verification.parties.flatMap((candidate) => {
          const faite = reponses[candidate.id]
          return faite === undefined ? [] : [reponseDeFait(candidate, faite)]
        })
        const validite = validiteVerification(
          faitsDuBloc(etat, verification.bloc),
          debut,
          reponsesDeFait,
          etat.reglages,
        )
        const statutAvant = resultatDuBloc(etat, verification.bloc, maintenant).statut
        const proposee = etat.interrupteurs.erreurIa ? manifeste.erreurs_critiques[0] : undefined
        const transfert = verification.parties.find(({ type }) => type === 'transfert')
        const idCorrection = nouvelId(Date.parse(maintenant))
        const faits: Fait[] = [
          {
            id: corps.id,
            bloc: verification.bloc,
            date: maintenant,
            type: 'verification_terminee',
            verification: verification.type,
            valable: validite.valable,
            ...(validite.valable ? {} : { raisonInvalide: validite.raison }),
            reponses: reponsesDeFait,
          },
          ...(proposee === undefined || transfert === undefined
            ? []
            : [
                {
                  id: idCorrection,
                  bloc: verification.bloc,
                  date: maintenant,
                  type: 'correction' as const,
                  serie: 'verification' as const,
                  question: transfert.id,
                  tour: 1,
                  niveau: reponses[transfert.id]?.niveau ?? 'partiel',
                  compte: true,
                  confiance: corps.confiance,
                  erreursIa: [proposee.id],
                },
              ]),
        ]
        enregistrer(magasin, corps.id, faits)

        const apres = magasin.lire()
        const resultatBloc = resultatDuBloc(apres, verification.bloc, maintenant)
        const reussie = validite.valable && compositionReussie(reponsesDeFait)
        const reprogrammee = validite.valable
          ? null
          : ajouterJours(jourDuReglage(apres, maintenant), 1)
        const echeance = echeances(resultatBloc, apres.reglages)
        const prochaine =
          reprogrammee !== null
            ? { type: verification.type, apres: reprogrammee }
            : echeance !== null && echeance.type !== 'consolidation'
              ? { type: echeance.type, apres: echeance.apres }
              : null
        const resultat: Resultat = {
          bloc: { code: verification.bloc, titre: manifeste.titre },
          issue: proposee !== undefined ? 'a_examiner' : reussie ? 'reussie' : 'ratee',
          valable: validite.valable,
          ...(validite.valable ? {} : { raison_invalide: validite.raison }),
          statut_avant: statutAvant,
          statut: resultatBloc.statut,
          descend: rang(resultatBloc.statut) < rang(statutAvant),
          prochaine,
          parties: verification.parties.flatMap(({ id, type }): PartieDuResultat[] => {
            const faite = reponses[id]
            if (faite === undefined) return []
            return [
              {
                id,
                type,
                consigne: partieDeManifeste(manifeste, id).consigne,
                ...(faite.niveau === undefined ? {} : { niveau: faite.niveau }),
                ...(faite.reussi === undefined ? {} : { reussi: faite.reussi }),
                ...(faite.cas === undefined ? {} : { cas: faite.cas }),
                compte: faite.compte,
                correction: faite.correction,
                ...(faite.indice === undefined ? {} : { indice: faite.indice }),
              },
            ]
          }),
          erreur_a_confirmer:
            proposee === undefined || transfert === undefined
              ? null
              : {
                  correction: idCorrection,
                  erreur: proposee.id,
                  libelle: proposee.libelle,
                  explication: `${PREFIXE_CORRECTION_SIMULEE}ta réponse laisse penser que « ${proposee.libelle} »`,
                  extrait: (reponses[transfert.id]?.reponse ?? '').slice(0, LONGUEUR_EXTRAIT),
                },
        }
        magasin.ecrire((avant) => ({
          ...avant,
          verifications: {
            ...avant.verifications,
            [params.id]: {
              ...suivi,
              reporteeJusqua: reprogrammee ?? suivi.reporteeJusqua,
              resultat,
            },
          },
        }))
        return { partie: partie.id, terminee: true, resultat } satisfies SortieRoute<
          (typeof ROUTES)['POST /verifications/:id/reponses']
        >
      },
    ),
  ]
}
