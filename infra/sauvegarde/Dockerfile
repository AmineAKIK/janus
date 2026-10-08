# Les outils clients de la même version que le serveur (postgres:17), plus le binaire restic.
FROM postgres:17
COPY --from=restic/restic:0.18.0 /usr/bin/restic /usr/local/bin/restic
COPY sauvegarder.sh essai-restauration.sh lancer.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
ENTRYPOINT ["lancer.sh"]
CMD []
