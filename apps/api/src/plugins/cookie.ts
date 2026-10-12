/**
 * Le nom du cookie de session. Sous HTTPS il porte le préfixe `__Host-` : le navigateur n'accepte alors
 * ce cookie que `Secure`, sans `Domain` et avec `Path=/`, donc aucun sous-domaine ne peut en poser un
 * de son cru. Sans HTTPS (développement, tests), le préfixe serait refusé : on garde le nom court.
 */
export const nomDuCookie = (secure: boolean): string =>
  secure ? '__Host-janus_session' : 'janus_session'
