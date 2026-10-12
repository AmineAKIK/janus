-- Le rôle de l'API : il se connecte (mot de passe posé hors dépôt) mais ne peut ni modifier ni effacer
-- un fait. Les migrations tournent avec le rôle propriétaire, l'API avec `janus_app`.
-- Le rôle est commun à toutes les bases du serveur : s'il existe déjà, ou si deux bases le créent en
-- même temps (les tests), l'erreur de doublon est ignorée.
DO $$
BEGIN
	BEGIN
		CREATE ROLE janus_app LOGIN;
		ALTER ROLE janus_app SET lock_timeout = '2s';
		ALTER ROLE janus_app SET statement_timeout = '10s';
	EXCEPTION WHEN duplicate_object OR unique_violation THEN
		-- Le rôle existe déjà (autre base du même serveur, ou course entre deux créations) : rien à faire.
		NULL;
	END;
END
$$;
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
