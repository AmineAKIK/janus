-- La table se reconstruit depuis les faits (recalcul au démarrage) : on la vide pour ajouter la colonne.
DELETE FROM "echeances";
--> statement-breakpoint
ALTER TABLE "echeances" ADD COLUMN "type" text NOT NULL;
