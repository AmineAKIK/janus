// Peuplement d'une base de mesure : un utilisateur avec un gros historique de faits.
//
//   node apps/api/bench/graine.ts --base janus_perf_api --faits 200000
//
// Hors du build et des tests. Elle crée (ou recrée) la base, applique les migrations, importe un plan de
// 10 modules x 20 blocs avec leurs fiches et leurs cartes, génère les faits côté serveur PostgreSQL
// (identifiants de type UUID v7, rangés par date comme en production), puis recalcule chaque bloc avec
// le vrai moteur pour remplir `statuts_courants` et `echeances`.
import pg from 'pg'
import { Reglages, nouvelId } from '@janus/contrats'
import { BLOCS_PAR_PARTIE, MODULES, PARTIES_PAR_MODULE, planDeMesure } from './plan.ts'
import { instantEnMs } from '@janus/moteur'
import { Manifeste } from '@janus/contrats'
import { creerBase } from '../src/base/base.ts'
import { migrer } from '../src/base/migrer.ts'
import { horlogeSysteme } from '../src/horloge.ts'
import { recalculer } from '../src/recalcul.ts'
import { creerHacheur } from '../src/domaines/auth/composition.ts'
import * as t from '../src/base/schema/index.ts'
import { eq } from 'drizzle-orm'

function option(nom: string, defaut: string): string {
  const position = process.argv.indexOf(`--${nom}`)
  return position < 0 ? defaut : (process.argv[position + 1] ?? defaut)
}

const SERVEUR = option('serveur', 'postgres://janus:janus@localhost:5432/postgres')
const NOM_BASE = option('base', 'janus_perf_api')
const FAITS = Number(option('faits', '200000'))
const MOT_DE_PASSE_ROLE = 'perf'

const urlProprietaire = (() => {
  const url = new URL(SERVEUR)
  url.pathname = `/${NOM_BASE}`
  return url.toString()
})()
/** Un rôle propre à la mesure, membre de `janus_app` : mêmes droits, mêmes délais (10 s, 2 s) qu'en production. */
const urlApplication = (() => {
  const url = new URL(urlProprietaire)
  url.username = 'janus_perf_app'
  url.password = MOT_DE_PASSE_ROLE
  return url.toString()
})()

const admin = new pg.Client({ connectionString: SERVEUR })
await admin.connect()
await admin.query(`DROP DATABASE IF EXISTS "${NOM_BASE}" WITH (FORCE)`)
await admin.query(`CREATE DATABASE "${NOM_BASE}"`)
await migrer(urlProprietaire)
await admin.query(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'janus_perf_app') THEN
    CREATE ROLE janus_perf_app LOGIN PASSWORD '${MOT_DE_PASSE_ROLE}' IN ROLE janus_app;
    ALTER ROLE janus_perf_app SET lock_timeout = '2s';
    ALTER ROLE janus_perf_app SET statement_timeout = '10s';
  END IF; END $$`)
await admin.end()

const client = new pg.Client({ connectionString: urlProprietaire })
await client.connect()
let ms = instantEnMs(horlogeSysteme.maintenant())
const id = () => nouvelId(ms++)
const horodatage = horlogeSysteme.maintenant()

// --- Le plan : formation, modules, parties, blocs, fiches, cartes.
const formationId = id()
await client.query('INSERT INTO formations (id, code, titre) VALUES ($1, $2, $3)', [
  formationId,
  'PERF',
  'Formation de mesure',
])
const plan = planDeMesure()
const idDuModule = new Map<string, string>()
for (const m of MODULES) {
  const moduleId = id()
  idDuModule.set(m.code, moduleId)
  await client.query(
    'INSERT INTO modules (id, formation_id, code, titre, ordre, importe) VALUES ($1,$2,$3,$4,$5,true)',
    [moduleId, formationId, m.code, `Module ${m.code}`, m.ordre],
  )
}
const idDeLaPartie = new Map<string, string>()
for (const bloc of plan) {
  const cle = `${bloc.module}/${bloc.partie}`
  if (idDeLaPartie.has(cle)) continue
  const partieId = id()
  idDeLaPartie.set(cle, partieId)
  await client.query(
    'INSERT INTO parties (id, module_id, code, titre, ordre) VALUES ($1,$2,$3,$4,$5)',
    [partieId, idDuModule.get(bloc.module), bloc.partie, `Partie ${bloc.partie}`, bloc.rangPartie],
  )
}
for (const bloc of plan) {
  const blocId = id()
  const manifeste = Manifeste.parse(bloc.manifeste)
  await client.query(
    'INSERT INTO blocs (id, module_id, partie_id, code, titre, ordre) VALUES ($1,$2,$3,$4,$5,$6)',
    [
      blocId,
      idDuModule.get(bloc.module),
      idDeLaPartie.get(`${bloc.module}/${bloc.partie}`),
      bloc.code,
      bloc.titre,
      bloc.ordre,
    ],
  )
  await client.query(
    'INSERT INTO fiches_versions (id, bloc_id, version, empreinte, chemin, manifeste, cree_le) VALUES ($1,$2,1,$3,$4,$5,$6)',
    [
      id(),
      blocId,
      bloc.empreinte,
      `${bloc.code}/${bloc.empreinte}.html`,
      JSON.stringify(bloc.manifeste),
      horodatage,
    ],
  )
  for (const carte of manifeste.cartes) {
    await client.query(
      'INSERT INTO cartes (id, bloc_id, carte_id, recto, verso) VALUES ($1,$2,$3,$4,$5)',
      [id(), blocId, carte.id, carte.recto, carte.verso],
    )
  }
}

// --- L'utilisateur.
const userId = id()
await client.query(
  'INSERT INTO users (id, nom_utilisateur, mot_de_passe_hash, reglages, cree_le) VALUES ($1,$2,$3,$4,$5)',
  [
    userId,
    'perf',
    await creerHacheur(4).hacher('perf-janus'),
    JSON.stringify(Reglages.parse({})),
    horodatage,
  ],
)

// --- Les faits, générés par PostgreSQL. `p.debut` : le bloc n°rang s'étudie sur 40 jours, l'un après l'autre.
const NB_BLOCS = MODULES.length * PARTIES_PAR_MODULE * BLOCS_PAR_PARTIE
await client.query(`SELECT setseed(0.42)`)
await client.query(`
CREATE TEMP TABLE plan AS
SELECT row_number() OVER (ORDER BY m.ordre, b.ordre)::int AS rang, b.id AS bloc_id, fv.id AS version_id,
       now() - interval '360 days' + (row_number() OVER (ORDER BY m.ordre, b.ordre) - 1) * (320.0 / ${String(NB_BLOCS)}) * interval '1 day' AS debut
FROM blocs b JOIN modules m ON m.id = b.module_id JOIN fiches_versions fv ON fv.bloc_id = b.id`)
await client.query(`
CREATE FUNCTION pg_temp.uuid7(ts timestamptz, g bigint) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT (lpad(to_hex((extract(epoch FROM ts) * 1000)::bigint), 12, '0') || '7' || substr(md5(g::text || 'a'), 1, 3) || '8' || substr(md5(g::text || 'b'), 1, 15))::uuid $$`)

// evenements : 55 % de temps actif, le reste en faits du moteur et en réponses de pré-test.
const nbEvenements = Math.round(FAITS * 0.82)
await client.query(
  `
INSERT INTO evenements (id, user_id, bloc_id, fiche_version_id, type, donnees, empreinte, aide, date_serveur)
SELECT pg_temp.uuid7(ts, g), $1, bloc_id, version_id, type,
  CASE type
    WHEN 'temps.actif' THEN jsonb_build_object('secondes', 60, 'etape', (ARRAY['carte', 'pretest', 'explication', 'pratique', 'atelier', 'aisance', 'restitution', 'consolidation'])[1 + floor(r2 * 8)::int])
    WHEN 'etape_vue' THEN jsonb_build_object('etape', 'ET' || (1 + floor(r2 * 9)::int))
    WHEN 'pratique_resultat' THEN jsonb_build_object('exercice', 'PR1', 'item', 'PR1-' || (1 + floor(r2 * 3)::int), 'reussi', r2 > 0.3, 'aide', aide)
    WHEN 'atelier_resultat' THEN jsonb_build_object('reussi', r2 > 0.3, 'aide', aide)
    WHEN 'aisance_resultat' THEN jsonb_build_object('reussi', r2 > 0.3, 'dureeS', 30 + floor(r2 * 200))
    WHEN 'pretest.reponse' THEN jsonb_build_object('question', 'PT' || (1 + floor(r2 * 5)::int), 'reponse', repeat('r', 120))
    WHEN 'bloc_ouvert' THEN jsonb_build_object('horsPrerequis', false)
    ELSE jsonb_build_object('ids', '[]'::jsonb)
  END,
  encode(sha256(convert_to(g::text, 'UTF8')), 'hex'),
  CASE WHEN type IN ('pratique_resultat', 'atelier_resultat') THEN aide END,
  ts
FROM (
  SELECT s.g, p.bloc_id, p.version_id, s.r2, s.aide,
    LEAST(p.debut + (ARRAY[0, 1, 2, 4, 9, 17, 29, 40])[1 + floor(s.r4 * 8)::int] * interval '1 day' + s.r3 * interval '3 hours', now() - interval '1 minute') AS ts,
    CASE WHEN s.r < 0.67 THEN 'temps.actif' WHEN s.r < 0.80 THEN 'etape_vue' WHEN s.r < 0.88 THEN 'pratique_resultat'
         WHEN s.r < 0.90 THEN 'atelier_resultat' WHEN s.r < 0.92 THEN 'aisance_resultat' WHEN s.r < 0.96 THEN 'pretest.reponse'
         WHEN s.r < 0.99 THEN 'bloc_ouvert' ELSE 'bilan.erreurs' END AS type
  FROM (SELECT g, 1 + floor(random() * ${String(NB_BLOCS)})::int AS rang, random() AS r, random() AS r2, random() AS r3, random() AS r4,
               floor(random() * 5)::int AS aide FROM generate_series(1, $2::bigint) g) s
  JOIN plan p USING (rang)
) x ORDER BY ts`,
  [userId, nbEvenements],
)

// corrections : 15 % des faits.
const nbCorrections = Math.round(FAITS * 0.15)
await client.query(
  `
INSERT INTO corrections (id, user_id, bloc_id, question_id, serie, tentative, tour, confiance, reponse, support_colle,
  support_retour_cours, recopiee, message, niveau, erreurs_ids, source, ref, certitude, compte, raison_non_compte, conteste,
  modele, parametres, jetons_entree, jetons_sortie, cout_millioniemes, consigne_empreinte, brut, echantillon, date_serveur)
SELECT pg_temp.uuid7(ts, g + 100000000), $1, bloc_id, question, serie, g, 1 + (g % 2), confiance, repeat('reponse ', 40), false, false, false,
  repeat('Message de correction. ', 15), niveau, CASE WHEN r2 > 0.9 THEN '["E1"]'::jsonb ELSE '[]'::jsonb END,
  'support', 'ref', 'sur', r2 < 0.85, CASE WHEN r2 < 0.85 THEN NULL ELSE 'relance' END, false, 'deepseek-flash', '{}'::jsonb,
  1200, 300, 900, encode(sha256('c'::bytea), 'hex'), repeat('brut ', 120), r2 < 0.1, ts
FROM (
  SELECT g, p.bloc_id, LEAST(p.debut + (ARRAY[0, 1, 2, 4, 9, 17, 29, 40])[1 + floor(s.r4 * 8)::int] * interval '1 day' + s.r3 * interval '3 hours', now() - interval '1 minute') AS ts, s.r2,
    CASE WHEN s.r < 0.5 THEN 'rappel' WHEN s.r < 0.7 THEN 'restitution' WHEN s.r < 0.9 THEN 'consolidation' ELSE 'verification' END AS serie,
    CASE WHEN s.r < 0.5 THEN 'RA' || (1 + floor(s.r2 * 6)::int) ELSE 'Q' || (1 + floor(s.r2 * 12)::int) END AS question,
    (ARRAY['sur', 'hesitant', 'hasard'])[1 + floor(s.r3 * 3)::int] AS confiance,
    (ARRAY['solide', 'partiel', 'fragile', 'pas_encore'])[1 + floor(s.r2 * 4)::int] AS niveau
  FROM (SELECT g, 1 + floor(random() * ${String(NB_BLOCS)})::int AS rang, random() AS r, random() AS r2, random() AS r3, random() AS r4
        FROM generate_series(1, $2::bigint) g) s
  JOIN plan p USING (rang)
) x ORDER BY ts`,
  [userId, nbCorrections],
)

// Le reste : forçages, décisions, notes de cartes, revues FSRS, journal, idées, vérifications, séries du jour, états de page.
await client.query(
  `INSERT INTO statuts_forces (id, user_id, bloc_id, action, statut, raison, date_serveur)
   SELECT pg_temp.uuid7(debut + interval '30 days', rang + 200000000), $1, bloc_id, 'forcer', 'acquis', 'Déjà maîtrisé.', LEAST(debut + interval '30 days', now() - interval '1 minute')
   FROM plan WHERE rang % 40 = 0`,
  [userId],
)
await client.query(
  `INSERT INTO decisions_erreurs (id, user_id, bloc_id, erreur_id, decision, source, date_serveur)
   SELECT pg_temp.uuid7(debut + interval '20 days', rang + 300000000), $1, bloc_id, 'E1', 'cochee', 'amine', LEAST(debut + interval '20 days', now() - interval '1 minute')
   FROM plan WHERE rang % 7 = 0`,
  [userId],
)
await client.query(
  `INSERT INTO notes_cartes (id, user_id, carte_id, note, date_serveur)
   SELECT pg_temp.uuid7(ts, g + 400000000), $1, carte_id, (ARRAY['a_revoir', 'difficile', 'bien', 'facile'])[1 + floor(random() * 4)::int], ts
   FROM (SELECT g, c.id AS carte_id, LEAST(p.debut + random() * interval '60 days', now() - interval '1 minute') AS ts
         FROM generate_series(1, $2::bigint) g
         JOIN (SELECT id, bloc_id, row_number() OVER (ORDER BY id)::int AS n FROM cartes) c ON c.n = 1 + (g % (SELECT count(*) FROM cartes))
         JOIN plan p ON p.bloc_id = c.bloc_id) s ORDER BY ts`,
  [userId, Math.round(FAITS * 0.03)],
)
await client.query(
  `INSERT INTO revues_fsrs (id, user_id, carte_id, due_le, etat, version_moteur)
   SELECT pg_temp.uuid7(now(), n + 500000000), $1, c.id, due, jsonb_build_object('echeance', to_char(due AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     'stabilite', 4.2, 'difficulte', 5.1, 'joursProgrammes', 4, 'etapeApprentissage', 0, 'repetitions', 3, 'oublis', 0, 'phase', 'revision',
     'derniereRevision', to_char(derniere AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     'introduiteLe', to_char((derniere - interval '20 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'noteId', 'n'), 0
   FROM (SELECT id, row_number() OVER (ORDER BY id) AS n, derniere, derniere + (random() * 20 - 3) * interval '1 day' AS due
         FROM (SELECT id, now() - (1 + random() * 14) * interval '1 day' AS derniere FROM cartes) k) c
   WHERE c.n % 3 <> 0`,
  [userId],
)
await client.query(
  `INSERT INTO idees (id, user_id, texte, date_serveur)
   SELECT pg_temp.uuid7(now() - g * interval '1 day', g + 600000000), $1, 'Une idée à explorer plus tard, numéro ' || g, now() - g * interval '1 day' FROM generate_series(1, 150) g`,
  [userId],
)
await client.query(
  `INSERT INTO revues_methode (id, user_id, texte, date_serveur)
   SELECT pg_temp.uuid7(now() - g * interval '7 days', g + 700000000), $1, 'Revue ' || g, now() - g * interval '7 days' FROM generate_series(1, 40) g`,
  [userId],
)
await client.query(
  `INSERT INTO verifications_tirees (id, user_id, bloc_id, type, tirage, date_serveur)
   SELECT pg_temp.uuid7(debut + interval '35 days', rang + 800000000), $1, bloc_id, 'verification',
     '[{"id":"DE1","type":"explication"},{"id":"DT1","type":"tache"},{"id":"DR1","type":"transfert"}]'::jsonb, LEAST(debut + interval '35 days', now() - interval '1 minute')
   FROM plan WHERE rang % 3 = 0`,
  [userId],
)
await client.query(
  `INSERT INTO series_questions_debut (id, user_id, jour, questions, date_serveur)
   SELECT pg_temp.uuid7(now() - g * interval '1 day', g + 900000000), $1, (current_date - g), '[{"bloc":"B001","question":"RA1"},{"bloc":"B002","question":"RA2"}]'::jsonb, now() - g * interval '1 day'
   FROM generate_series(1, 300) g`,
  [userId],
)
await client.query(
  `INSERT INTO etats_page (user_id, bloc_id, etat, version, mis_a_jour_le)
   SELECT $1, bloc_id, jsonb_build_object('notes', repeat('x', 4000), 'reponses', (SELECT jsonb_agg(i) FROM generate_series(1, 40) i)), 5, now() FROM plan`,
  [userId],
)
await client.query('ANALYZE')
await client.end()

// --- Les statuts et échéances calculés, avec le vrai moteur (bloc par bloc, comme à l'écriture).
const base = creerBase(urlProprietaire)
const blocs = await base.db.select({ id: t.blocs.id, code: t.blocs.code }).from(t.blocs)
const [utilisateur] = await base.db.select().from(t.users).where(eq(t.users.id, userId))
const reglages = Reglages.parse(utilisateur?.reglages)
const maintenant = horlogeSysteme.maintenant()
const debut = performance.now()
for (const bloc of blocs) {
  const [fiche] = await base.db
    .select({ manifeste: t.fichesVersions.manifeste })
    .from(t.fichesVersions)
    .where(eq(t.fichesVersions.blocId, bloc.id))
  await base.enTransaction((tx) =>
    recalculer(tx, {
      userId,
      bloc,
      manifeste: Manifeste.parse(fiche?.manifeste),
      reglages,
      maintenant,
    }),
  )
}
await base.fermer()
const verif = new pg.Client({ connectionString: urlProprietaire })
await verif.connect()
await verif.query('VACUUM (ANALYZE)')
const taille = await verif.query<{ table: string; lignes: string; taille: string }>(
  `SELECT relname AS table, reltuples::bigint::text AS lignes, pg_size_pretty(pg_total_relation_size(oid)) AS taille
   FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND reltuples > 0 ORDER BY pg_total_relation_size(oid) DESC`,
)
await verif.end()
process.stdout.write(
  `Base ${NOM_BASE} prête (${String(NB_BLOCS)} blocs, ${String(FAITS)} faits visés, recalcul ${String(Math.round(performance.now() - debut))} ms).\n`,
)
process.stdout.write(
  `${taille.rows.map((r) => `${r.table}: ${r.lignes} lignes, ${r.taille}`).join('\n')}\n`,
)
process.stdout.write(
  `DATABASE_URL=${urlApplication}\nDATABASE_URL_PROPRIETAIRE=${urlProprietaire}\nutilisateur=perf mot_de_passe=perf-janus\n`,
)
