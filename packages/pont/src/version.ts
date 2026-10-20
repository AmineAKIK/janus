/**
 * La version du contrat du pont : la forme des messages entre la page et l'appli. Le manifeste d'une
 * fiche la déclare dans `pont`, et la construction l'écrit en tête de `pont.js` avec l'empreinte du
 * code ; `pnpm fiches:verifier` exige que les deux se répondent. À augmenter quand un message change.
 */
export const VERSION_PONT = 2
