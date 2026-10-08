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

const noteJournal = {
  id: ID,
  entree: 'f0001',
  date: INSTANT,
  texte: 'Je confonds encore fiche et cours.',
}

const ligneJournal = {
  id: 'f0001',
  date: INSTANT,
  bloc: 'D01',
  type: 'restitution',
  resume: '4 sur 5 comptées · 1 ne compte pas (collé) · statut inchangé',
  detail: ['R1 · solide'],
  note: noteJournal,
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

const moi = { id: ID, nom_utilisateur: 'amine', fuseau: 'Europe/Paris', cle_vapid: 'cle-publique' }

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
      { partie: 'corps', valeur: { ancien: 'ancien-secret', nouveau: 'a'.repeat(73) } },
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
    corps: { id: ID, erreur: 'E1', correction: AUTRE_ID, decision: 'confirmee' },
    reponse: statutBloc,
    invalides: [
      {
        partie: 'corps',
        valeur: { id: ID, erreur: '', correction: AUTRE_ID, decision: 'confirmee' },
      },
      {
        partie: 'corps',
        valeur: { id: ID, erreur: 'E1', correction: 'x', decision: 'confirmee' },
      },
      {
        partie: 'corps',
        valeur: { id: ID, erreur: 'E1', correction: AUTRE_ID, decision: 'peut_etre' },
      },
      { partie: 'corps', valeur: { erreur: 'E1', correction: AUTRE_ID, decision: 'confirmee' } },
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
    corps: {
      id: AUTRE_ID,
      compte: true,
      niveau: 'solide',
      raison: 'Je retiens ce niveau.',
    },
    reponse: statutBloc,
    invalides: [
      { partie: 'corps', valeur: { compte: true } },
      {
        partie: 'corps',
        valeur: { id: AUTRE_ID, compte: false, niveau: 'solide', raison: 'Assez longue.' },
      },
      { partie: 'corps', valeur: { id: AUTRE_ID, compte: true, niveau: 'solide' } },
      {
        partie: 'corps',
        valeur: { id: AUTRE_ID, compte: true, niveau: 'solide', raison: 'court' },
      },
      { partie: 'corps', valeur: { id: AUTRE_ID, compte: true, raison: 'Assez longue.' } },
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
          lien: `/verifications/${ID}`,
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
    reponse: {
      questions: [
        { id: 'RA1', question: 'Qu’est-ce qu’une fiche ?', deja: null },
        {
          id: 'RA2',
          question: 'À quoi sert un manifeste ?',
          deja: {
            bloc: 'D01',
            confiance: 'sur',
            reponse: 'À décrire la fiche.',
            correction: {
              id: ID,
              echantillon: false,
              question: 'RA2',
              tour: 1,
              message: 'Bien.',
              niveau: 'solide',
              erreurs_critiques: [],
              source: 'support',
              ref: 'RA2',
              certitude: 'sur',
              compte: true,
            },
          },
        },
      ],
    },
    invalides: [
      {
        partie: 'reponse',
        valeur: { questions: [{ id: 'RA1', question: 'Q', deja: null, bloc: 'D01' }] },
      },
      { partie: 'reponse', valeur: { questions: [{ id: 'RA1', question: 'Q' }] } },
    ],
  },
  'GET /cartes/dues': {
    reponse: {
      dues: [
        {
          id: 'C1',
          bloc: 'D01',
          recto: 'Recto',
          verso: 'Verso',
          nouvelle: false,
          apercu: {
            a_revoir: 600_000,
            difficile: 172_800_000,
            bien: 432_000_000,
            facile: 1_036_800_000,
          },
        },
      ],
      nouvelles: [],
      prochaine: null,
    },
    invalides: [
      { partie: 'reponse', valeur: { dues: [{ id: 'C1' }], nouvelles: [], prochaine: null } },
      { partie: 'reponse', valeur: { dues: [], nouvelles: [] } },
    ],
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
      revu_recemment: null,
      parties: [
        {
          id: 'DE1',
          type: 'explication',
          consigne: 'Explique ce qu’est une fiche.',
          envoyee: false,
        },
        {
          id: 'DT1',
          type: 'tache',
          consigne: 'Écris une fonction double(n).',
          tache: { mode: 'code', langage: 'js', cas: [{ entree: [2], sortie: 4 }] },
          envoyee: false,
        },
      ],
      resultat: null,
    },
    invalides: [
      { partie: 'params', valeur: { id: 'abc' } },
      {
        partie: 'reponse',
        valeur: {
          id: ID,
          type: 'examen',
          due_le: 'x',
          terminee: false,
          revu_recemment: null,
          parties: [],
          resultat: null,
        },
      },
    ],
  },
  'POST /verifications/:id/reponses': {
    params: { id: ID },
    corps: {
      id: AUTRE_ID,
      partie: 'DE1',
      reponse: 'Une fiche résume un seul bloc.',
      confiance: 'sur',
      support: { colle: false, retour_cours: false },
    },
    reponse: { partie: 'DE1', terminee: false },
    invalides: [
      {
        partie: 'corps',
        valeur: {
          id: AUTRE_ID,
          partie: 'DE1',
          reponse: '',
          confiance: 'sur',
          support: { colle: false, retour_cours: false },
        },
      },
      { partie: 'corps', valeur: { partie: 'DE1', reponse: 'x' } },
      { partie: 'reponse', valeur: { partie: 'DE1' } },
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
    requete: { module: 'M1', periode: '7j' },
    reponse: {
      modules: [{ id: 'M1', titre: 'Module 1' }],
      module: { id: 'M1', titre: 'Module 1' },
      periode: '7j',
      blocs: [
        {
          bloc: 'D01',
          titre_court: 'Démo',
          partie: 'P1',
          statut: 'acquis',
          prerequis: [],
          force: false,
          redescendu: false,
          prerequis_non_valides: false,
        },
      ],
      a_faire: {
        aujourdhui: 1,
        a_venir: 0,
        taches: [{ tache: { type: 'bloc', bloc: 'D02' }, lien: '/blocs/D02', faite: false }],
      },
      erreurs: [
        {
          erreur: 'E1',
          libelle: 'Confondre fiche et cours.',
          nombre: 2,
          blocs: ['D01'],
          ouverte: true,
        },
      ],
      decisions: {
        forces: [{ date: INSTANT, bloc: 'D01', statut: 'vu', raison: 'Je l’ai vu en cours.' }],
        sans_prerequis: [{ date: INSTANT, bloc: 'D02', raison: null }],
      },
      mesures: {
        autonomie: {
          semaines: [
            { debut: '2026-09-21', sans_aide: 1, total: 2, part: 0.5 },
            { debut: '2026-09-28', sans_aide: 0, total: 0, part: null },
            { debut: '2026-10-05', sans_aide: 2, total: 4, part: 0.5 },
            { debut: '2026-10-12', sans_aide: 3, total: 4, part: 0.75 },
          ],
          aide_moyenne: 0.5,
        },
        retention: [
          {
            debut: '2026-09-21',
            cartes: { reussis: 8, total: 10 },
            questions: { reussis: 4, total: 6 },
            verifications: { reussis: 1, total: 1 },
          },
          {
            debut: '2026-09-28',
            cartes: { reussis: 0, total: 0 },
            questions: { reussis: 0, total: 0 },
            verifications: { reussis: 0, total: 0 },
          },
        ],
        calibration: {
          lignes: [
            { confiance: 'sur', justes: 6, faux: 1 },
            { confiance: 'hesitant', justes: 2, faux: 2 },
            { confiance: 'hasard', justes: 0, faux: 1 },
          ],
          erreurs_sures: [{ bloc: 'D01', question: 'R1', date: INSTANT }],
        },
        aisance: [
          {
            bloc: 'D01',
            titre_court: 'Variables',
            cible: {
              libelle: 'Écrire une boucle',
              objectif_s: 60,
              meilleur_s: 45,
              reussites: 2,
              reussites_requises: 3,
              jours: 1,
              jours_requis: 2,
            },
          },
          { bloc: 'D02', titre_court: 'Conditions', cible: null },
        ],
        revue: {
          a_proposer: true,
          blocs_depuis: 3,
          blocs_requis: 3,
          temps_s: 5400,
          pratique_s: 1800,
          a_reprendre: [{ bloc: 'D01', question: 'R1', fois: 2 }],
          etapes_sautees: [{ etape: 'pretest', blocs: 2 }],
        },
        fiabilite: {
          copies_relues: 4,
          desaccords: 1,
          non_verifiees: 0,
          contestations: 1,
          alerte: true,
        },
        temps: {
          total_s: 1500,
          lecture_s: 300,
          pratique_s: 900,
          restitution_s: 200,
          blocs: [{ bloc: 'D01', titre_court: 'Variables', secondes: 1500 }],
        },
      },
      cout_ia: { depense_millioniemes: 1_500_000, plafond_millioniemes: 10_000_000 },
    },
    invalides: [
      { partie: 'requete', valeur: { periode: '1an' } },
      { partie: 'reponse', valeur: { blocs: [], a_faire: [] } },
    ],
  },
  'GET /journal': {
    requete: { module: 'M1', bloc: 'D01', type: 'restitution', avant: INSTANT },
    reponse: {
      modules: [{ id: 'M1', titre: 'Environnement numérique' }],
      entrees: [ligneJournal],
      suivant: null,
      blocs: [{ bloc: 'D01', titre_court: 'Fiche et cours', statut: 'vu' }],
      idees: [{ id: ID, date: INSTANT, texte: 'Ajouter un mode révision rapide.' }],
    },
    invalides: [
      { partie: 'requete', valeur: { type: 'secret' } },
      { partie: 'requete', valeur: { avant: 'hier' } },
      { partie: 'reponse', valeur: { entrees: [{ ...ligneJournal, type: 'secret' }] } },
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
    corps: { id: ID, entree: 'f0001', texte: 'Je confonds encore fiche et cours.' },
    reponse: noteJournal,
    invalides: [
      { partie: 'corps', valeur: { id: ID, entree: 'f0001', texte: '   ' } },
      { partie: 'corps', valeur: { id: ID, entree: 'f0001', texte: 'a'.repeat(1001) } },
    ],
  },
  'PATCH /journal/notes/:id': {
    params: { id: ID },
    corps: { texte: 'Note corrigée.' },
    reponse: noteJournal,
    invalides: [
      { partie: 'corps', valeur: { texte: '' } },
      { partie: 'params', valeur: { id: '1' } },
    ],
  },
  'POST /journal/idees': {
    corps: { id: ID, texte: 'Ajouter un mode révision rapide.' },
    reponse: { id: ID, date: INSTANT, texte: 'Ajouter un mode révision rapide.' },
    invalides: [{ partie: 'corps', valeur: { texte: 'sans identifiant' } }],
  },
  'POST /revues-methode': {
    corps: { id: ID, texte: 'Les consolidations marchent bien, les retests moins.' },
    invalides: [{ partie: 'corps', valeur: { id: ID, texte: '' } }],
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
