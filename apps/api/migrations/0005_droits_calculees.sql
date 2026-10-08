-- Les tables calculées et l'état de l'appli : le rôle de l'API les lit et les modifie.
GRANT SELECT, INSERT, UPDATE, DELETE ON statuts_courants, echeances, revues_fsrs, journal, abonnements_push TO janus_app;
--> statement-breakpoint
-- Le budget IA ne s'efface pas : on le réserve, on le consomme.
GRANT SELECT, INSERT, UPDATE ON budget_ia TO janus_app;
