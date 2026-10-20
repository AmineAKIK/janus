ALTER TABLE "corrections" ADD COLUMN "niveau_rendu" text;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_niveau_rendu" CHECK ("corrections"."niveau_rendu" IS NULL OR "corrections"."niveau_rendu" IN ('solide', 'partiel', 'fragile', 'pas_encore'));--> statement-breakpoint
-- Les corrections déjà écrites avec une erreur repérée : le niveau rendu se relit dans le texte brut du
-- correcteur. Sans lui (texte vide ou sans niveau lisible), la colonne reste nulle et le niveau plafonné compte.
UPDATE "corrections"
SET "niveau_rendu" = substring("brut" from '"niveau"\s*:\s*"(solide|partiel|fragile|pas_encore)"')
WHERE jsonb_array_length("erreurs_ids") > 0;
