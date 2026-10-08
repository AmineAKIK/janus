CREATE TABLE "corrections_echecs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"serie" text NOT NULL,
	"tentative" integer NOT NULL,
	"tour" integer NOT NULL,
	"motif" text NOT NULL,
	"bruts" jsonb NOT NULL,
	"modele" text NOT NULL,
	"cout_millioniemes" integer NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "brut" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "echantillon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "corrections_echecs" ADD CONSTRAINT "corrections_echecs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections_echecs" ADD CONSTRAINT "corrections_echecs_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
GRANT SELECT, INSERT ON corrections_echecs TO janus_app;
