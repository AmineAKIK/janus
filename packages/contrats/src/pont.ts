import { z } from 'zod'
import { CodeBloc, Identifiant, Texte } from './primitives.ts'
import { Aide, Certitude, Confiance, Niveau, RaisonNonCompte, Source, Statut } from './enums.ts'
import { InstantUtc } from './faits.ts'

// Les messages entre une fiche (iframe sandbox) et l'appli, section « Pont » du cadrage.
// Les noms des champs sont ceux du cadrage (`duree_s`, `serie_ouverte`...), comme dans le manifeste.

export { CodeBloc, Identifiant }

/** Taille maximale d'une réponse libre, en caractères. */
export const TAILLE_MAX_REPONSE = 2000
/** Taille maximale de l'état d'une page une fois écrit en JSON (200 ko), en octets. */
export const TAILLE_MAX_ETAT_OCTETS = 200_000

export const Reponse = z.string().max(TAILLE_MAX_REPONSE)
/** Un identifiant tiré par le client, UUID v7. */
export const IdUuid = z.uuid({ version: 'v7' })

/** Les codes de ce qui manque pour le statut suivant, rendus par le moteur ; l'interface les traduit en phrases. */
export const CodeManque = z.enum([
  'restitution_incomplete',
  'pratique_aide',
  'atelier_manquant',
  'erreur_ouverte',
  'verification_a_venir',
  'verification_a_faire',
  'retest_a_venir',
  'retest_a_faire',
  'reprise_a_faire',
  'aisance_non_atteinte',
])
export type CodeManque = z.infer<typeof CodeManque>

/** Un manque et ses paramètres : questions, exercices ou erreurs concernés, jour à partir duquel c'est possible. */
export const Manque = z.strictObject({
  code: CodeManque,
  questions: z.array(Identifiant).optional(),
  exercices: z.array(Identifiant).optional(),
  erreurs: z.array(Identifiant).optional(),
  apres: z.string().optional(),
})
export type Manque = z.infer<typeof Manque>

/** Un jour `AAAA-MM-JJ`. */
const JourIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * La pratique du bloc telle que le serveur la garde : ses résultats depuis la fiche recommencée (ou
 * la mise à reprendre), dans l'ordre, et les items dont l'explication est Solide. La page en relit
 * chaque item avec `suivreLaPratique` (`pratique.ts`), la même règle que le moteur : elle n'en garde
 * aucune copie. `aujourdhui` est le jour de l'appli (fuseau et heure de bascule).
 */
export const PratiqueDuBloc = z.strictObject({
  aujourdhui: JourIso,
  resultats: z.array(
    z.strictObject({
      id: Identifiant,
      item: Identifiant,
      reussi: z.boolean(),
      aide: Aide,
      brute: z.boolean(),
      jour: JourIso,
      cas: z.enum(['origine', 'variante']).nullable(),
    }),
  ),
  expliques: z.array(Identifiant),
})
export type PratiqueDuBloc = z.infer<typeof PratiqueDuBloc>

/** L'état d'une page : un objet JSON de 200 ko au plus. */
/**
 * Ce que le serveur calcule et que la page lit (etat.init, statut.maj), jamais ne sauve. Leçon du
 * B01 : une page qui garde sa propre copie d'un de ces états finit par diverger du serveur.
 */
export const CLES_DU_SERVEUR = [
  'statut',
  'manque',
  'serie_ouverte',
  'serieOuverte',
  'aisance',
  'etapes_vues',
  'etapesVues',
  'erreurs_ouvertes',
  'erreursOuvertes',
  'preuves',
] as const

export const EtatPage = z
  .record(z.string(), z.json())
  .refine((etat) => CLES_DU_SERVEUR.every((cle) => !(cle in etat)), {
    error: 'L’état de la page ne porte pas ce que le serveur calcule (statut, séries, aisance…).',
  })
  .refine(
    (etat) => new TextEncoder().encode(JSON.stringify(etat)).length <= TAILLE_MAX_ETAT_OCTETS,
    {
      error: 'L’état de la page ne doit pas dépasser 200 ko.',
    },
  )

/** Ce que tout message de la page porte : un identifiant unique, le bloc, la version du manifeste et l'heure du téléphone (indicative). */
const communPage = {
  id: IdUuid,
  bloc: CodeBloc,
  version: z.number().int().min(1),
  t: z.iso.datetime({ offset: true }),
}

/**
 * Une explication que le manifeste ne déclare pas, demandée après une solution vue (« refais, puis
 * explique ») ou pour un schéma refait de mémoire : la page dit la question posée et ce qui est
 * attendu. Seulement dans la série `explication`, et sa correction ne compte jamais pour le statut ;
 * après une solution vue, elle est faite avec support (la solution).
 */
export const ExplicationLibre = z.strictObject({
  question: Texte,
  attendu: Texte,
  /**
   * Faux pour une explication qui ne suit pas une solution vue (le schéma du bloc refait de mémoire) :
   * elle n'est pas faite avec support. Absent, l'explication libre suit une solution vue.
   */
  apres_solution: z.boolean().optional(),
})

/**
 * Ce que l'apprenant envoie pour être corrigé : la question, sa réponse, sa confiance, la relance
 * (vide au premier tour) et le support dont il s'est servi. Le message `restitution.demande` et
 * `POST /corrections` le portent à l'identique.
 */
export const champsReponse = {
  question: Identifiant,
  reponse: Reponse.min(1),
  confiance: Confiance,
  /** Le texte de la relance, vide au premier tour. */
  relance: Reponse,
  support: z.strictObject({ colle: z.boolean(), retour_cours: z.boolean() }),
  libre: ExplicationLibre.optional(),
}

/** La seule série que la page pose elle-même : la restitution. */
/** Les séries qu'une page fait corriger : la restitution, et les explications de ses exercices. */
const SeriePage = z.enum(['restitution', 'explication'])

/** Hauteur maximale du contenu d'une page, en pixels CSS. */
export const HAUTEUR_MAX_PAGE = 200_000

/** Taille maximale d'une adresse que la fiche demande d'ouvrir. */
export const TAILLE_MAX_LIEN = 2000

/** Une adresse que la fiche demande d'ouvrir : https seulement, sans identifiants dans l'adresse. */
export const LienExterne = z
  .url({ protocol: /^https$/ })
  .max(TAILLE_MAX_LIEN)
  .refine((adresse) => {
    // Une adresse illisible est déjà refusée par `z.url` : la vérification ne doit pas lever.
    if (!URL.canParse(adresse)) return true
    const { username, password } = new URL(adresse)
    return username === '' && password === ''
  }, 'Une adresse ne porte ni nom ni mot de passe.')

/** Un message de la page vers l'appli (`window.parent.postMessage`). Le serveur date tout avec sa propre heure. */
export const MessagePage = z.discriminatedUnion('type', [
  z.strictObject({ ...communPage, type: z.literal('page.prete'), schema: z.literal(2) }),
  z.strictObject({ ...communPage, type: z.literal('etape.vue'), etape: Identifiant }),
  z.strictObject({
    ...communPage,
    type: z.literal('pretest.reponse'),
    question: Identifiant,
    reponse: Reponse,
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('pratique.resultat'),
    exercice: Identifiant,
    item: Identifiant,
    reussi: z.boolean(),
    /** L'aide de cet essai seul : le serveur y ajoute l'aide que l'item garde (`RejeuPratique`). */
    aide: Aide,
    essais: z.number().int().min(1),
    /** Le cas sur lequel l'item a été fait, quand l'outil le dit. */
    cas: z.enum(['origine', 'variante']).optional(),
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('atelier.resultat'),
    reussi: z.boolean(),
    predictions_justes: z.number().int().min(0),
    aide: Aide,
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('aisance.resultat'),
    reussi: z.boolean(),
    duree_s: z.number().min(0),
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('restitution.demande'),
    serie: SeriePage,
    ...champsReponse,
  }),
  z.strictObject({ ...communPage, type: z.literal('bilan.erreurs'), ids: z.array(Identifiant) }),
  z.strictObject({ ...communPage, type: z.literal('etat.sauver'), etat: EtatPage }),
  /** Ouvre un site dans un nouvel onglet : la fiche (sandbox) ne peut pas le faire seule. Reste dans l'appli. */
  z.strictObject({ ...communPage, type: z.literal('lien.ouvrir'), url: LienExterne }),
  /** La hauteur du contenu de la page : l'appli la donne à l'iframe, qui ne défile plus seule. Reste dans l'appli. */
  z.strictObject({
    ...communPage,
    type: z.literal('page.taille'),
    hauteur: z.number().int().min(1).max(HAUTEUR_MAX_PAGE),
  }),
  /** La page change d'écran ou d'étape : l'appli ramène son haut à l'écran. Reste dans l'appli. */
  z.strictObject({ ...communPage, type: z.literal('page.haut') }),
  z.strictObject({
    ...communPage,
    type: z.literal('correction.accord'),
    /** L'identifiant de la correction jugée. */
    correction: IdUuid,
    accord: z.boolean(),
  }),
])
export type MessagePage = z.infer<typeof MessagePage>

/** Une correction rendue par le serveur : ce que la page affiche, et que l'API de corrections renvoie. */
export const champsCorrection = {
  /** L'identifiant de la correction, que la page renvoie dans `correction.accord`. */
  id: IdUuid,
  /** Vrai pour une correction de premier tour sur dix : la page demande alors l'avis d'Amine. */
  echantillon: z.boolean(),
  question: Identifiant,
  tour: z.number().int().min(1),
  message: z.string(),
  niveau: Niveau,
  erreurs_critiques: z.array(Identifiant),
  source: Source,
  ref: z.string(),
  certitude: Certitude,
  compte: z.boolean(),
  raison_non_compte: RaisonNonCompte.optional(),
}
export const CorrectionRecue = z.strictObject(champsCorrection)
export type CorrectionRecue = z.infer<typeof CorrectionRecue>

/**
 * La correction telle que l'API la rend à l'appli (`POST /corrections`, la série du jour) : celle de
 * la page, plus le modèle qui l'a rendue et s'il est le tuteur de secours. Décision du 14 octobre
 * 2026 : Haiku est le tuteur principal, DeepSeek le secours, et une correction de secours se voit.
 * La page, elle, ne reçoit que `CorrectionRecue` : le pont embarqué dans les fiches publiées refuse
 * tout champ en plus.
 */
export const CorrectionRendue = z.strictObject({
  ...champsCorrection,
  /** Le modèle du fournisseur (`claude-haiku-5-5`, `deepseek-flash`, `faux`…). */
  modele: z.string().min(1),
  secours: z.boolean(),
})
export type CorrectionRendue = z.infer<typeof CorrectionRendue>

const CorrectionSansExtras = z.object(champsCorrection)

/** Ce que la page reçoit d'une correction rendue : les champs du pont, rien de plus. */
export function pourLaPage(rendue: CorrectionRendue): CorrectionRecue {
  return CorrectionSansExtras.parse(rendue)
}

/** Un message de l'appli vers la page. */
export const MessageAppli = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('etat.init'),
    /** Le bloc et la version du manifeste : en mode appli, la fiche les utilise à la place de ceux de son manifeste embarqué. */
    bloc: CodeBloc,
    version: z.number().int().min(1),
    /** L'état sauvegardé, `null` s'il n'y en a pas encore. */
    etat: EtatPage.nullable(),
    statut: Statut,
    serie_ouverte: z.strictObject({ restitution: z.boolean() }),
    /**
     * Les séries d'aisance réussies que le serveur garde, de la plus ancienne à la plus récente : la
     * date et la durée de la conversion la plus lente. La fiche y relit ses niveaux, même après un
     * recommencement qui a vidé son état.
     */
    aisance: z.array(z.strictObject({ le: InstantUtc, duree_s: z.number().min(0) })),
    pratique: PratiqueDuBloc,
    /** Le thème choisi dans l'appli : la fiche s'y aligne (une fiche sans ce champ suit le réglage du téléphone). */
    theme: z.enum(['clair', 'sombre', 'systeme']).optional(),
  }),
  z.strictObject({ type: z.literal('restitution.correction'), ...champsCorrection }),
  z.strictObject({
    type: z.literal('statut.maj'),
    statut: Statut,
    manque: z.array(Manque),
    pratique: PratiqueDuBloc,
  }),
  z.strictObject({
    type: z.literal('erreur'),
    code: z.enum(['correction_indisponible', 'plafond_atteint', 'message_refuse']),
    detail: z.string(),
    /** L'identifiant du message de la page qui a été refusé, s'il y en a un. */
    message_id: IdUuid.optional(),
  }),
  z.strictObject({
    type: z.literal('etape.aller'),
    /** L'étape à afficher (fil d'étapes de l'appli). */
    etape: Identifiant,
    /** « Revoir le cours » pendant une série : la fiche rouvre le cours, les réponses suivantes le disent. */
    retour_cours: z.literal(true).optional(),
  }),
  z.strictObject({
    type: z.literal('erreur.rejetee'),
    /** La question dont la correction avait repéré l'erreur. */
    question: Identifiant,
    /** L'erreur critique qu'Amine a rejetée : le bilan ne la coche plus d'office pour cette question. */
    erreur: Identifiant,
  }),
])
export type MessageAppli = z.infer<typeof MessageAppli>
