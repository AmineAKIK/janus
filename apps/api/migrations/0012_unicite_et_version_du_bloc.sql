-- Un code de bloc est unique dans toute l'appli (l'API désigne un bloc par son code seul), et la
-- version de fiche d'un événement appartient au bloc de cet événement.
ALTER TABLE "blocs" ADD CONSTRAINT "blocs_code" UNIQUE("code");--> statement-breakpoint
ALTER TABLE "fiches_versions" ADD CONSTRAINT "fiches_versions_bloc_id" UNIQUE("bloc_id","id");--> statement-breakpoint
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_version_du_bloc" FOREIGN KEY ("bloc_id","fiche_version_id") REFERENCES "public"."fiches_versions"("bloc_id","id") ON DELETE no action ON UPDATE no action;
