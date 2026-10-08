-- La dernière activité d'une session se met à jour : le rôle de l'API peut modifier cette table.
GRANT SELECT, INSERT, UPDATE ON sessions_activite TO janus_app;
