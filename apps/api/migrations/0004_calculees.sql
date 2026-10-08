CREATE TABLE "abonnements_push" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"cree_le" timestamp with time zone NOT NULL,
	CONSTRAINT "abonnements_push_endpoint" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "budget_ia" (
	"user_id" uuid NOT NULL,
	"mois" text NOT NULL,
	"plafond_millioniemes" integer NOT NULL,
	"consomme_millioniemes" integer NOT NULL,
	"reserve_millioniemes" integer NOT NULL,
	CONSTRAINT "budget_ia_user_id_mois_pk" PRIMARY KEY("user_id","mois"),
	CONSTRAINT "budget_ia_mois" CHECK ("budget_ia"."mois" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "budget_ia_montants" CHECK ("budget_ia"."plafond_millioniemes" >= 0 AND "budget_ia"."consomme_millioniemes" >= 0 AND "budget_ia"."reserve_millioniemes" >= 0),
	CONSTRAINT "budget_ia_plafond" CHECK ("budget_ia"."consomme_millioniemes" + "budget_ia"."reserve_millioniemes" <= "budget_ia"."plafond_millioniemes")
);
--> statement-breakpoint
CREATE TABLE "echeances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"genre" text NOT NULL,
	"due_le" timestamp with time zone NOT NULL,
	"faite_le" timestamp with time zone,
	"version_moteur" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid,
	"type" text NOT NULL,
	"donnees" jsonb NOT NULL,
	"version_moteur" integer NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revues_fsrs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"carte_id" uuid NOT NULL,
	"due_le" timestamp with time zone NOT NULL,
	"etat" jsonb NOT NULL,
	"version_moteur" integer NOT NULL,
	CONSTRAINT "revues_fsrs_user_carte" UNIQUE("user_id","carte_id")
);
--> statement-breakpoint
CREATE TABLE "statuts_courants" (
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"statut_calcule" text NOT NULL,
	"detail" jsonb NOT NULL,
	"version_moteur" integer NOT NULL,
	"calcule_le" timestamp with time zone NOT NULL,
	CONSTRAINT "statuts_courants_user_id_bloc_id_pk" PRIMARY KEY("user_id","bloc_id")
);
--> statement-breakpoint
ALTER TABLE "abonnements_push" ADD CONSTRAINT "abonnements_push_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_ia" ADD CONSTRAINT "budget_ia_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revues_fsrs" ADD CONSTRAINT "revues_fsrs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revues_fsrs" ADD CONSTRAINT "revues_fsrs_carte_id_cartes_id_fk" FOREIGN KEY ("carte_id") REFERENCES "public"."cartes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuts_courants" ADD CONSTRAINT "statuts_courants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuts_courants" ADD CONSTRAINT "statuts_courants_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "echeances_a_faire" ON "echeances" USING btree ("user_id","due_le") WHERE "echeances"."faite_le" IS NULL;--> statement-breakpoint
CREATE INDEX "journal_user_date" ON "journal" USING btree ("user_id","date_serveur");--> statement-breakpoint
CREATE INDEX "revues_fsrs_due" ON "revues_fsrs" USING btree ("user_id","due_le");