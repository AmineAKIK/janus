CREATE TABLE "notes_cartes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"carte_id" uuid NOT NULL,
	"note" text NOT NULL,
	"date_serveur" timestamp with time zone NOT NULL,
	CONSTRAINT "notes_cartes_note" CHECK ("notes_cartes"."note" IN ('a_revoir', 'difficile', 'bien', 'facile'))
);
--> statement-breakpoint
ALTER TABLE "notes_cartes" ADD CONSTRAINT "notes_cartes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes_cartes" ADD CONSTRAINT "notes_cartes_carte_id_cartes_id_fk" FOREIGN KEY ("carte_id") REFERENCES "public"."cartes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_cartes_user_date" ON "notes_cartes" USING btree ("user_id","date_serveur");--> statement-breakpoint
GRANT SELECT, INSERT ON notes_cartes TO janus_app;
