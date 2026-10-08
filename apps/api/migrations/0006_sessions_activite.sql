CREATE TABLE "sessions_activite" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"derniere_activite" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "persistante" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions_activite" ADD CONSTRAINT "sessions_activite_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;