-- CREATE INDEX (sans CONCURRENTLY, impossible dans la transaction d'une migration) verrouille les
-- écritures de la table le temps de la construction : mesuré à 64 ms (corrections, 75 000 lignes)
-- et ~200 ms (evenements, 410 000 lignes) pour un utilisateur à 500 000 faits.
CREATE INDEX "corrections_user_bloc_date" ON "corrections" USING btree ("user_id","bloc_id","date_serveur");--> statement-breakpoint
CREATE INDEX "corrections_user_date" ON "corrections" USING btree ("user_id","date_serveur");--> statement-breakpoint
CREATE INDEX "evenements_user_type_date" ON "evenements" USING btree ("user_id","type","date_serveur") WHERE "evenements"."type" <> 'temps.actif';