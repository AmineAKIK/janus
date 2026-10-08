CREATE TABLE "blocs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_id" uuid NOT NULL,
	"partie_id" uuid,
	"code" text NOT NULL,
	"titre" text NOT NULL,
	"ordre" integer NOT NULL,
	CONSTRAINT "blocs_module_code" UNIQUE("module_id","code"),
	CONSTRAINT "blocs_code_format" CHECK ("blocs"."code" ~ '^[A-Z]{1,3}[0-9]{2,3}$')
);
--> statement-breakpoint
CREATE TABLE "cartes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bloc_id" uuid NOT NULL,
	"carte_id" text NOT NULL,
	"recto" text NOT NULL,
	"verso" text NOT NULL,
	CONSTRAINT "cartes_bloc_carte" UNIQUE("bloc_id","carte_id")
);
--> statement-breakpoint
CREATE TABLE "fiches_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bloc_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"empreinte" text NOT NULL,
	"chemin" text NOT NULL,
	"manifeste" jsonb NOT NULL,
	"cree_le" timestamp with time zone NOT NULL,
	CONSTRAINT "fiches_versions_bloc_version" UNIQUE("bloc_id","version"),
	CONSTRAINT "fiches_versions_version_positive" CHECK ("fiches_versions"."version" >= 1),
	CONSTRAINT "fiches_versions_empreinte_sha256" CHECK ("fiches_versions"."empreinte" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "formations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"titre" text NOT NULL,
	CONSTRAINT "formations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"formation_id" uuid NOT NULL,
	"code" text NOT NULL,
	"titre" text NOT NULL,
	"ordre" integer NOT NULL,
	CONSTRAINT "modules_formation_code" UNIQUE("formation_id","code")
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_id" uuid NOT NULL,
	"code" text NOT NULL,
	"titre" text NOT NULL,
	"ordre" integer NOT NULL,
	CONSTRAINT "parties_module_code" UNIQUE("module_id","code")
);
--> statement-breakpoint
CREATE TABLE "taches_reservees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_id" uuid NOT NULL,
	"intitule" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etats_page" (
	"user_id" uuid NOT NULL,
	"bloc_id" uuid NOT NULL,
	"etat" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"mis_a_jour_le" timestamp with time zone NOT NULL,
	CONSTRAINT "etats_page_user_id_bloc_id_pk" PRIMARY KEY("user_id","bloc_id"),
	CONSTRAINT "etats_page_version_positive" CHECK ("etats_page"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nom_utilisateur" text NOT NULL,
	"mot_de_passe_hash" text NOT NULL,
	"reglages" jsonb NOT NULL,
	"reglages_version" integer DEFAULT 1 NOT NULL,
	"cree_le" timestamp with time zone NOT NULL,
	CONSTRAINT "users_reglages_version_positive" CHECK ("users"."reglages_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "blocs" ADD CONSTRAINT "blocs_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocs" ADD CONSTRAINT "blocs_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartes" ADD CONSTRAINT "cartes_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiches_versions" ADD CONSTRAINT "fiches_versions_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taches_reservees" ADD CONSTRAINT "taches_reservees_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etats_page" ADD CONSTRAINT "etats_page_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etats_page" ADD CONSTRAINT "etats_page_bloc_id_blocs_id_fk" FOREIGN KEY ("bloc_id") REFERENCES "public"."blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fiches_versions_bloc_empreinte" ON "fiches_versions" USING btree ("bloc_id","empreinte");--> statement-breakpoint
CREATE UNIQUE INDEX "users_nom_utilisateur" ON "users" USING btree (lower("nom_utilisateur"));