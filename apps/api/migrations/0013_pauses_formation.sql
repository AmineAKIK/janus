CREATE TABLE "pauses_formation" (
	"user_id" uuid NOT NULL,
	"formation_id" uuid NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone,
	CONSTRAINT "pauses_formation_user_id_formation_id_debut_pk" PRIMARY KEY("user_id","formation_id","debut"),
	CONSTRAINT "pauses_formation_ordre" CHECK ("pauses_formation"."fin" IS NULL OR "pauses_formation"."fin" >= "pauses_formation"."debut")
);
--> statement-breakpoint
ALTER TABLE "pauses_formation" ADD CONSTRAINT "pauses_formation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pauses_formation" ADD CONSTRAINT "pauses_formation_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pauses_formation_ouverte" ON "pauses_formation" USING btree ("user_id","formation_id") WHERE "pauses_formation"."fin" IS NULL;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON pauses_formation TO janus_app;
