CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"serie" text NOT NULL,
	"tentative" integer NOT NULL,
	"tour" integer NOT NULL,
	"confiance" text NOT NULL,
	"reponse" text NOT NULL,
	"support_colle" boolean NOT NULL,
	"support_retour_cours" boolean NOT NULL,
	"recopiee" boolean NOT NULL,
	"message" text NOT NULL,
	"niveau" text NOT NULL,
	"erreurs_ids" jsonb NOT NULL,
	"source" text NOT NULL,
	"ref" text NOT NULL,
	"certitude" text NOT NULL,
	"compte" boolean NOT NULL,
	"raison_non_compte" text,
	"conteste" boolean NOT NULL,
	"modele" text NOT NULL,
	"parametres" jsonb NOT NULL,
	"jetons_entree" integer NOT NULL,
	"jetons_sortie" integer NOT NULL,
	"cout_millioniemes" integer NOT NULL,
	"consigne_empreinte" text NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "corrections_user_question_serie_tentative_tour" UNIQUE("user_id","question_id","serie","tentative","tour"),
	CONSTRAINT "corrections_tentative_positive" CHECK ("corrections"."tentative" >= 1),
	CONSTRAINT "corrections_tour_positif" CHECK ("corrections"."tour" >= 1),
	CONSTRAINT "corrections_serie" CHECK ("corrections"."serie" IN ('restitution', 'consolidation', 'rappel', 'verification')),
	CONSTRAINT "corrections_confiance" CHECK ("corrections"."confiance" IN ('sur', 'hesitant', 'hasard')),
	CONSTRAINT "corrections_niveau" CHECK ("corrections"."niveau" IN ('solide', 'partiel', 'fragile', 'pas_encore')),
	CONSTRAINT "corrections_source" CHECK ("corrections"."source" IN ('support', 'deduit', 'ajoute')),
	CONSTRAINT "corrections_certitude" CHECK ("corrections"."certitude" IN ('sur', 'non_verifie')),
	CONSTRAINT "corrections_raison_non_compte" CHECK (("corrections"."compte" AND "corrections"."raison_non_compte" IS NULL) OR (NOT "corrections"."compte" AND "corrections"."raison_non_compte" IS NOT NULL AND "corrections"."raison_non_compte" IN ('relance', 'avec_support', 'recopiee', 'non_verifiee'))),
	CONSTRAINT "corrections_jetons_et_cout" CHECK ("corrections"."jetons_entree" >= 0 AND "corrections"."jetons_sortie" >= 0 AND "corrections"."cout_millioniemes" >= 0),
	CONSTRAINT "corrections_consigne_sha256" CHECK ("corrections"."consigne_empreinte" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "decisions_erreurs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"erreur_id" text NOT NULL,
	"decision" text NOT NULL,
	"source" text,
	"correction_id" uuid,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "decisions_erreurs_decision" CHECK ("decisions_erreurs"."decision" IN ('cochee', 'decochee', 'confirmee', 'rejetee')),
	CONSTRAINT "decisions_erreurs_forme" CHECK (("decisions_erreurs"."decision" IN ('cochee', 'decochee') AND "decisions_erreurs"."source" IS NOT NULL AND "decisions_erreurs"."source" IN ('amine', 'ia_confirmee') AND "decisions_erreurs"."correction_id" IS NULL) OR ("decisions_erreurs"."decision" IN ('confirmee', 'rejetee') AND "decisions_erreurs"."source" IS NULL AND "decisions_erreurs"."correction_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "evenements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"fiche_version_id" uuid NOT NULL,
	"type" text NOT NULL,
	"donnees" jsonb NOT NULL,
	"empreinte" text NOT NULL,
	"aide" smallint,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "evenements_aide_0_a_4" CHECK ("evenements"."aide" BETWEEN 0 AND 4),
	CONSTRAINT "evenements_empreinte_sha256" CHECK ("evenements"."empreinte" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "idees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"texte" text NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "idees_texte" CHECK (length(trim("idees"."texte")) BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "notes_journal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"entree" text NOT NULL,
	"texte" text NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "notes_journal_texte" CHECK (length(trim("notes_journal"."texte")) BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE TABLE "rappels_envoyes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"jour" date NOT NULL,
	"envoye_le" timestamp with time zone NOT NULL,
	CONSTRAINT "rappels_envoyes_user_jour" UNIQUE("user_id","jour")
);
--> statement-breakpoint
CREATE TABLE "revues_methode" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"texte" text,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "revues_methode_texte" CHECK ("revues_methode"."texte" IS NULL OR length(trim("revues_methode"."texte")) BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "series_questions_debut" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"jour" date NOT NULL,
	"questions" jsonb NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "series_questions_debut_user_jour" UNIQUE("user_id","jour")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"empreinte_jeton" text NOT NULL,
	"cree_le" timestamp with time zone NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"appareil" text,
	CONSTRAINT "sessions_empreinte_jeton_unique" UNIQUE("empreinte_jeton"),
	CONSTRAINT "sessions_empreinte_sha256" CHECK ("sessions"."empreinte_jeton" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sessions_expire_apres_creation" CHECK ("sessions"."expire_le" > "sessions"."cree_le")
);
--> statement-breakpoint
CREATE TABLE "sessions_revoquees" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"revoquee_le" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statuts_forces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"action" text NOT NULL,
	"statut" text,
	"raison" text,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "statuts_forces_action" CHECK ("statuts_forces"."action" IN ('forcer', 'lever')),
	CONSTRAINT "statuts_forces_forcer_a_statut_et_raison" CHECK (("statuts_forces"."action" = 'forcer' AND "statuts_forces"."statut" IS NOT NULL AND length(trim("statuts_forces"."raison")) > 0) OR ("statuts_forces"."action" = 'lever' AND "statuts_forces"."statut" IS NULL AND "statuts_forces"."raison" IS NULL)),
	CONSTRAINT "statuts_forces_statut" CHECK ("statuts_forces"."statut" IS NULL OR "statuts_forces"."statut" IN ('non_commence', 'en_cours', 'vu', 'acquis_provisoirement', 'acquis', 'maitrise', 'a_reprendre'))
);
--> statement-breakpoint
CREATE TABLE "verifications_tirees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"type" text NOT NULL,
	"tirage" jsonb NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "verifications_tirees_type" CHECK ("verifications_tirees"."type" IN ('verification', 'retest', 'entretien'))
);
--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions_erreurs" ADD CONSTRAINT "decisions_erreurs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions_erreurs" ADD CONSTRAINT "decisions_erreurs_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions_erreurs" ADD CONSTRAINT "decisions_erreurs_correction_id_corrections_id_fk" FOREIGN KEY ("correction_id") REFERENCES "public"."corrections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_fiche_version_id_fiches_versions_id_fk" FOREIGN KEY ("fiche_version_id") REFERENCES "public"."fiches_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idees" ADD CONSTRAINT "idees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_journal" ADD CONSTRAINT "notes_journal_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rappels_envoyes" ADD CONSTRAINT "rappels_envoyes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revues_methode" ADD CONSTRAINT "revues_methode_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_questions_debut" ADD CONSTRAINT "series_questions_debut_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions_revoquees" ADD CONSTRAINT "sessions_revoquees_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuts_forces" ADD CONSTRAINT "statuts_forces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuts_forces" ADD CONSTRAINT "statuts_forces_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications_tirees" ADD CONSTRAINT "verifications_tirees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications_tirees" ADD CONSTRAINT "verifications_tirees_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corrections_user_question" ON "corrections" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "decisions_erreurs_user_bloc" ON "decisions_erreurs" USING btree ("user_id","bloc_id","date_serveur");--> statement-breakpoint
CREATE INDEX "evenements_user_bloc_date" ON "evenements" USING btree ("user_id","bloc_id","date_serveur");--> statement-breakpoint
CREATE INDEX "notes_journal_user_note" ON "notes_journal" USING btree ("user_id","note_id","date_serveur");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");