import demo from '../../fixtures/manifeste-demo.json' with { type: 'json' }
import { EXEMPLES_PAGE } from '../pont.exemples.ts'
import { Reglages } from '../reglages.ts'
import type { CleRoute } from './index.ts'

// Un exemple valide par route, et des exemples invalides : ce que les tests de l'API rejouent.

const ID = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b'
const AUTRE_ID = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c'
const INSTANT = '2026-06-01T10:00:00Z'

const statutBloc = {
  statut: 'vu',
  manque: [{ code: 'consolidation_trop_tot', apres: '2026-06-01T11:30:00Z' }],
  erreurs_ouvertes: [],
}

const correction = {
  id: ID,
  echantillon: false,
  question: 'R1',
  tour: 1,
  message: 'Presque : il manque la limite d’un seul bloc.',
  niveau: 'partiel',
  erreurs_critiques: ['E1'],
  source: 'support',
  ref: 'ET2',
  certitude: 'sur',
  compte: true,
}

const entreeJournal = {
  id: ID,
  date: INSTANT,
  type: 'note',
  bloc: 'D01',
  texte: 'Je confonds encore fiche et cours.',
}

const demandeCorrection = {
  id: ID,
  serie: 'restitution',
  tentative: 1,
  question: 'R1',
  reponse: 'Une fiche résume un seul bloc.',
  confiance: 'sur',
  relance: '',
  support: { colle: false, retour_cours: false },
  bloc: 'D01',
  version: 3,
}

const moi = { id: ID, nom_utilisateur: 'amine', fuseau: 'Europe/Paris' }

export interface ExempleRoute {
  readonly params?: unknown
  readonly requete?: unknown
  readonly corps?: unknown
  readonly reponse?: unknown
  /** Des entrées qui doivent être refusées, avec la partie de la route qu'elles visent. */
  readonly invalides: readonly {
    readonly partie: 'params' | 'requete' | 'corps' | 'reponse'
    readonly valeur: unknown
  }[]
}

export const EXEMPLES_ROUTES: Record<CleRoute, ExempleRoute> = {
  'POST /session': {
    corps: { nom_utilisateur: 'amine', mot_de_passe: 'secret-solide' },
    reponse: moi,
    invalides: [
      { partie: 'corps', valeur: { nom_utilisateur: 'amine' } },
      { partie: 'corps', valeur: { nom_utilisateur: '', mot_de_passe: 'x' } },
      { partie: 'reponse', valeur: { ...moi, id: 'pas-un-uuid' } },
    ],
  },
  'DELETE /session': { invalides: [] },
  'GET /moi': { reponse: moi, invalides: [{ partie: 'reponse', valeur: { id: ID } }] },
  'PATCH /moi/mot-de-passe': {
    corps: { ancien: 'ancien-secret', nouveau: 'nouveau-secret' },
    invalides: [
      { partie: 'corps', valeur: { ancien: 'ancien-secret', nouveau: 'court' } },
      { partie: 'corps', valeur: { nouveau: 'nouveau-secret' } },
    ],
  },
  'GET /sessions': {
    reponse: {
      sessions: [
        {
          id: ID,
          appareil: 'Samsung',
          creee_le: INSTANT,
          derniere_activite: INSTANT,
          courante: true,
        },
      ],
    },
    invalides: [{ partie: 'reponse', valeur: { sessions: [{ id: ID }] } }],
  },
  'DELETE /sessions/:id': {
    params: { id: ID },
    invalides: [{ partie: 'params', valeur: { id: 'abc' } }],
  },
  'DELETE /compte': {
    corps: { mot_de_passe: 'secret-solide' },
    invalides: [{ partie: 'corps', valeur: {} }],
  },
  'GET /formations': {
    reponse: { formations: [{ id: 'dwwm', titre: 'DWWM', description: 'Titre professionnel.' }] },
    invalides: [{ partie: 'reponse', valeur: { formations: [{ id: 'dwwm' }] } }],
  },
  'GET /formations/:id/modules': {
    params: { id: 'dwwm' },
    reponse: {
      modules: [
        { id: 'm1', code: 'M1', titre: 'Module 1', description: '', ordre: 1, importe: true },
      ],
    },
    invalides: [
      { partie: 'params', valeur: { id: '' } },
      { partie: 'reponse', valeur: { modules: [{ id: 'm1' }] } },
    ],
  },
  'GET /modules/:id/blocs': {
    params: { id: 'm1' },
    reponse: {
      blocs: [
        {
          bloc: 'D01',
          titre: 'Démonstration',
          titre_court: 'Démo',
          partie: 'P1',
          prerequis: [],
          statut: 'en_cours',
        },
      ],
    },
    invalides: [
      { partie: 'params', valeur: {} },
      { partie: 'reponse', valeur: { blocs: [{ bloc: 'd01' }] } },
    ],
  },
  'GET /blocs/:id': {
    params: { id: 'D01' },
    reponse: {
      ...statutBloc,
      bloc: 'D01',
      module: 'M1',
      version: 3,
      manifeste: demo,
      problemes: [],
      serie_ouverte: { restitution: true, consolidation: false },
      force: null,
      acces: 'libre',
      preuves: {
        comprendre: { date: INSTANT },
        faire_seul: null,
        transferer: null,
        retenir: { date: INSTANT, prochaine: { type: 'retest', apres: '2026-11-01' } },
        aisance: 'non_requis',
      },
      fiche_url: 'https://fiches.example.org/D01/3/index.html',
      etat_page: { version: 2, etat: { etape: 'ET3' } },
    },
    invalides: [
      { partie: 'params', valeur: { id: 'bloc' } },
      { partie: 'reponse', valeur: { ...statutBloc, bloc: 'D01' } },
    ],
  },
  'POST /blocs/:id/ouvrir': {
    params: { id: 'D01' },
    corps: { id: ID, hors_prerequis: true, raison: 'Je connais déjà.' },
    reponse: { acces: 'raison_requise', ...statutBloc },
    invalides: [
      { partie: 'corps', valeur: { id: ID } },
      { partie: 'corps', valeur: { id: 'x', hors_prerequis: false } },
      { partie: 'reponse', valeur: { acces: 'ouvert', ...statutBloc } },
    ],
  },
  'POST /evenements': {
    corps: { ...EXEMPLES_PAGE['etape.vue'] },
    reponse: { doublon: false, statut: statutBloc },
    invalides: [
      { partie: 'corps', valeur: { id: ID, type: 'temps.actif', bloc: 'D01', secondes: 0 } },
      { partie: 'corps', valeur: { type: 'inconnu' } },
      { partie: 'reponse', valeur: { doublon: 'non', statut: null } },
    ],
  },
  'PUT /blocs/:id/etat-page': {
    params: { id: 'D01' },
    corps: { version: 2, etat: { etape: 'ET3' } },
    reponse: { version: 3 },
    invalides: [
      { partie: 'corps', valeur: { version: -1, etat: {} } },
      { partie: 'corps', valeur: { version: 0, etat: 'texte' } },
      { partie: 'reponse', valeur: { version: 0 } },
    ],
  },
  'POST /blocs/:id/erreurs': {
    params: { id: 'D01' },
    corps: { id: ID, ids: ['E1', 'E3'] },
    reponse: statutBloc,
    invalides: [
      { partie: 'corps', valeur: { id: ID, ids: [''] } },
      { partie: 'corps', valeur: { ids: [] } },
    ],
  },
  'POST /blocs/:id/forcer': {
    params: { id: 'D01' },
    corps: { action: 'forcer', id: ID, statut: 'acquis', raison: 'Je maîtrise déjà ce bloc.' },
    reponse: {
      ...statutBloc,
      force: { statut: 'acquis', raison: 'Je maîtrise déjà ce bloc.' },
      statut_calcule: 'vu',
    },
    invalides: [
      { partie: 'corps', valeur: { action: 'forcer', id: ID, statut: 'acquis' } },
      { partie: 'corps', valeur: { action: 'forcer', id: ID, statut: 'super', raison: 'x' } },
      { partie: 'corps', valeur: { action: 'lever' } },
      { partie: 'reponse', valeur: statutBloc },
    ],
  },
  'POST /corrections': {
    corps: demandeCorrection,
    reponse: correction,
    invalides: [
      { partie: 'corps', valeur: { ...demandeCorrection, bloc: undefined } },
      { partie: 'corps', valeur: { ...demandeCorrection, version: undefined } },
      { partie: 'corps', valeur: { ...demandeCorrection, serie: 'rappel' } },
      { partie: 'corps', valeur: { ...demandeCorrection, reponse: '' } },
      { partie: 'corps', valeur: { ...demandeCorrection, tentative: 0 } },
      { partie: 'reponse', valeur: { ...correction, niveau: 'moyen' } },
    ],
  },
  'POST /corrections/:id/accord': {
    params: { id: ID },
    corps: { accord: true },
    invalides: [
      { partie: 'params', valeur: { id: 'x' } },
      { partie: 'corps', valeur: { accord: 'oui' } },
    ],
  },
  'POST /corrections/:id/trancher': {
    params: { id: ID },
    corps: { id: AUTRE_ID, decision: 'amine', niveau: 'solide' },
    reponse: { correction, statut: statutBloc },
    invalides: [
      { partie: 'corps', valeur: { id: AUTRE_ID, decision: 'personne' } },
      { partie: 'corps', valeur: { decision: 'ia' } },
      { partie: 'reponse', valeur: { correction } },
    ],
  },
  'GET /aujourdhui': {
    reponse: {
      jour: '2026-06-01',
      en_retard: false,
      premiere_connexion: false,
      taches: [
        {
          tache: {
            type: 'reprendre_erreur',
            bloc: 'D01',
            erreur: 'E3',
            libelle: 'Ignorer le statut.',
            lien: '/blocs/D01?etape=ET7',
          },
          lien: '/blocs/D01?etape=ET7',
          faite: false,
        },
        { tache: { type: 'questions_debut', nombre: 6 }, lien: '/questions', faite: false },
        { tache: { type: 'reprise', blocs: ['D01'] }, lien: '/blocs/D01', faite: false },
        {
          tache: { type: 'verification', bloc: 'D01', apres: '2026-06-04' },
          lien: '/verifications/D01',
          faite: false,
        },
        {
          tache: { type: 'consolidation', bloc: 'D02', apres: INSTANT },
          lien: '/blocs/D02',
          faite: false,
        },
        { tache: { type: 'cartes', dues: 12, nouvelles: 3 }, lien: '/revision', faite: true },
        { tache: { type: 'bloc', bloc: 'D03' }, lien: '/blocs/D03', faite: false },
      ],
      module: {
        id: 'M1',
        titre: 'Module 1',
        blocs: [{ bloc: 'D01', titre_court: 'Fiches', statut: 'en_cours' }],
      },
    },
    invalides: [
      {
        partie: 'reponse',
        valeur: {
          jour: '2026-06-01',
          en_retard: false,
          premiere_connexion: false,
          taches: [{ tache: { type: 'inconnu' }, lien: '/', faite: false }],
          module: null,
        },
      },
      {
        partie: 'reponse',
        valeur: {
          jour: '2026-06-01',
          en_retard: false,
          premiere_connexion: false,
          taches: [{ tache: { type: 'questions_debut', nombre: 0 }, lien: '/', faite: false }],
          module: null,
        },
      },
      {
        partie: 'reponse',
        valeur: {
          jour: '2026-06-01',
          en_retard: true,
          retour: { jours: 3 },
          premiere_connexion: false,
          taches: [],
          module: null,
        },
      },
    ],
  },
  'GET /questions-debut': {
    reponse: { questions: [{ id: 'RA1', question: 'Qu’est-ce qu’une fiche ?' }] },
    invalides: [
      { partie: 'reponse', valeur: { questions: [{ id: 'RA1', question: 'Q', bloc: 'D01' }] } },
    ],
  },
  'GET /cartes/dues': {
    reponse: {
      dues: [{ id: 'C1', bloc: 'D01', recto: 'Recto', verso: 'Verso' }],
      nouvelles: [],
    },
    invalides: [{ partie: 'reponse', valeur: { dues: [{ id: 'C1' }], nouvelles: [] } }],
  },
  'POST /cartes/:id/note': {
    params: { id: 'C1' },
    corps: { id: ID, note: 'bien' },
    reponse: { echeance: INSTANT },
    invalides: [
      { partie: 'corps', valeur: { id: ID, note: 'moyen' } },
      { partie: 'params', valeur: { id: '' } },
      { partie: 'reponse', valeur: { echeance: 'demain' } },
    ],
  },
  'GET /verifications/:id': {
    params: { id: ID },
    reponse: {
      id: ID,
      type: 'verification',
      due_le: '2026-06-04',
      terminee: false,
      questions: [{ id: 'DE1', type: 'explication', consigne: 'Explique ce qu’est une fiche.' }],
    },
    invalides: [
      { partie: 'params', valeur: { id: 'abc' } },
      {
        partie: 'reponse',
        valeur: { id: ID, type: 'examen', due_le: 'x', terminee: false, questions: [] },
      },
    ],
  },
  'POST /verifications/:id/reponses': {
    params: { id: ID },
    corps: { id: AUTRE_ID, question: 'DE1', reponse: 'Une fiche résume un seul bloc.' },
    reponse: { question: 'DE1', tour: 1, compte: true, niveau: 'solide', terminee: false },
    invalides: [
      { partie: 'corps', valeur: { id: AUTRE_ID, question: 'DE1', reponse: '' } },
      { partie: 'corps', valeur: { question: 'DE1', reponse: 'x' } },
      { partie: 'reponse', valeur: { question: 'DE1', tour: 0, compte: true, terminee: false } },
    ],
  },
  'POST /verifications/:id/reporter': {
    params: { id: ID },
    corps: { id: AUTRE_ID },
    reponse: { due_le: '2026-06-05' },
    invalides: [
      { partie: 'corps', valeur: {} },
      { partie: 'reponse', valeur: {} },
    ],
  },
  'GET /tableau-de-bord': {
    reponse: {
      blocs: [{ bloc: 'D01', titre_court: 'Démo', statut: 'acquis', prerequis: [] }],
      a_faire: [{ type: 'bloc', bloc: 'D02' }],
      erreurs_ouvertes: [{ bloc: 'D01', erreur: 'E1', libelle: 'Confondre fiche et cours.' }],
    },
    invalides: [{ partie: 'reponse', valeur: { blocs: [], a_faire: [] } }],
  },
  'GET /journal': {
    requete: { avant: INSTANT, limite: '50' },
    reponse: { entrees: [entreeJournal] },
    invalides: [
      { partie: 'requete', valeur: { limite: '0' } },
      { partie: 'requete', valeur: { avant: 'hier' } },
      { partie: 'reponse', valeur: { entrees: [{ ...entreeJournal, type: 'secret' }] } },
    ],
  },
  'GET /journal/export.txt': {
    reponse: '2026-06-01 12:00  Note : je confonds encore fiche et cours.\n',
    invalides: [{ partie: 'reponse', valeur: { texte: 'non' } }],
  },
  'GET /export.json': {
    reponse: { version: 1, genere_le: INSTANT, donnees: { faits: [], reglages: {} } },
    invalides: [{ partie: 'reponse', valeur: { version: 2, genere_le: INSTANT, donnees: {} } }],
  },
  'POST /journal/notes': {
    corps: { id: ID, texte: 'Je confonds encore fiche et cours.', bloc: 'D01' },
    reponse: entreeJournal,
    invalides: [
      { partie: 'corps', valeur: { id: ID, texte: '   ' } },
      { partie: 'corps', valeur: { id: ID, texte: 'a'.repeat(10_001) } },
    ],
  },
  'PATCH /journal/notes/:id': {
    params: { id: ID },
    corps: { texte: 'Note corrigée.' },
    reponse: entreeJournal,
    invalides: [
      { partie: 'corps', valeur: { texte: '' } },
      { partie: 'params', valeur: { id: '1' } },
    ],
  },
  'POST /journal/idees': {
    corps: { id: ID, texte: 'Ajouter un mode révision rapide.' },
    reponse: { ...entreeJournal, type: 'idee', bloc: null },
    invalides: [{ partie: 'corps', valeur: { texte: 'sans identifiant' } }],
  },
  'POST /revues-methode': {
    corps: { id: ID, texte: 'Les consolidations marchent bien, les retests moins.' },
    invalides: [{ partie: 'corps', valeur: { id: ID } }],
  },
  'GET /reglages': {
    reponse: Reglages.parse({}),
    invalides: [{ partie: 'reponse', valeur: { questionsDebut: 99 } }],
  },
  'PATCH /reglages': {
    corps: { questionsDebut: 8, retentionVisee: 0.92 },
    reponse: Reglages.parse({ questionsDebut: 8, retentionVisee: 0.92 }),
    invalides: [
      { partie: 'corps', valeur: { questionsDebut: 3 } },
      { partie: 'corps', valeur: { retentionVisee: 0.5 } },
      { partie: 'corps', valeur: { inconnu: 1 } },
    ],
  },
  'POST /push/abonnements': {
    corps: {
      id: ID,
      endpoint: 'https://push.example.org/abonnement/abc',
      cles: { p256dh: 'BKey', auth: 'cleauth' },
    },
    reponse: { id: ID },
    invalides: [
      {
        partie: 'corps',
        valeur: { id: ID, endpoint: 'pas-une-url', cles: { p256dh: 'a', auth: 'b' } },
      },
      {
        partie: 'corps',
        valeur: { id: ID, endpoint: 'https://push.example.org/a', cles: { p256dh: '', auth: 'b' } },
      },
    ],
  },
  'DELETE /push/abonnements/:id': {
    params: { id: ID },
    invalides: [{ partie: 'params', valeur: { id: 'x' } }],
  },
}
