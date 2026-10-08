-- Le rôle de l'API : il se connecte (mot de passe posé hors dépôt) mais ne peut ni modifier ni effacer
-- un fait. Les migrations tournent avec le rôle propriétaire, l'API avec `janus_app`.
-- Un verrou consultatif évite que deux bases créées en même temps (les tests) se disputent le rôle.
DO $$
BEGIN
	PERFORM pg_advisory_xact_lock(hashtext('janus_app'));
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'janus_app') THEN
		CREATE ROLE janus_app LOGIN;
	END IF;
END
$$;
--> statement-breakpoint
ALTER ROLE janus_app SET lock_timeout = '2s';
--> statement-breakpoint
ALTER ROLE janus_app SET statement_timeout = '10s';
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO janus_app;
--> statement-breakpoint
-- Le catalogue : lu, importé, corrigé. Une version de fiche, elle, ne s'ajoute qu'une fois.
GRANT SELECT, INSERT, UPDATE ON formations, modules, parties, blocs, cartes, taches_reservees TO janus_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON fiches_versions TO janus_app;
--> statement-breakpoint
-- L'état d'Amine : modifiable.
GRANT SELECT, INSERT, UPDATE, DELETE ON users, etats_page TO janus_app;
--> statement-breakpoint
-- Les faits : ajout seul, ni UPDATE ni DELETE.
GRANT SELECT, INSERT ON evenements, corrections, statuts_forces, decisions_erreurs, notes_journal, idees, revues_methode, verifications_tirees, series_questions_debut, sessions, sessions_revoquees, rappels_envoyes TO janus_app;
