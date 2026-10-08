-- Une version de fiche est figée : on en ajoute une nouvelle, on ne modifie ni n'efface jamais l'ancienne.
-- Le déclencheur protège aussi contre le rôle propriétaire ; le rôle de l'appli n'a de toute façon que INSERT.
CREATE FUNCTION interdire_modification() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'La table % est en ajout seul : % refusé.', TG_TABLE_NAME, TG_OP
		USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER fiches_versions_figees
	BEFORE UPDATE OR DELETE ON "fiches_versions"
	FOR EACH ROW EXECUTE FUNCTION interdire_modification();
