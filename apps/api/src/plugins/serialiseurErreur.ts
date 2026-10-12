/**
 * Ce que le journal garde d'une erreur : son type, son message, son code PostgreSQL et les cadres
 * de la pile. Sauf pour une requête SQL en échec (`DrizzleQueryError`) : son message recopie la
 * requête et les valeurs envoyées, donc les réponses d'Amine et les empreintes de mot de passe.
 * Le journal garde alors seulement le message de la cause (celui de PostgreSQL, sans les valeurs).
 */
export function serialiserErreur(erreur: unknown) {
  if (!(erreur instanceof Error)) return { type: typeof erreur, message: '', stack: '' }
  const cause: unknown = erreur.cause
  const code = [erreur, cause].flatMap((candidat) =>
    typeof candidat === 'object' && candidat !== null && 'code' in candidat ? [candidat.code] : [],
  )[0]
  const requeteEnEchec = erreur.message.startsWith('Failed query:')
  const message = requeteEnEchec ? (cause instanceof Error ? cause.message : '') : erreur.message
  const cadres = (erreur.stack ?? '')
    .split('\n')
    .filter((ligne) => ligne.trimStart().startsWith('at '))
  return {
    type: erreur.constructor.name,
    message,
    ...(typeof code === 'string' ? { code } : {}),
    stack: cadres.join('\n'),
  }
}
