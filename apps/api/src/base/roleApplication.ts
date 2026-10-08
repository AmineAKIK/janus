import pg from 'pg'

/**
 * Pose sur le rôle de l'API le mot de passe de `DATABASE_URL`, avec le rôle propriétaire. La
 * migration crée `janus_app` sans mot de passe : le déploiement le décide, dans une seule variable.
 */
export async function poserMotDePasseApplication(
  urlProprietaire: string,
  urlApplication: string,
): Promise<void> {
  const { username, password } = new URL(urlApplication)
  if (username === '' || password === '') return
  const client = new pg.Client({ connectionString: urlProprietaire })
  await client.connect()
  try {
    const role = client.escapeIdentifier(decodeURIComponent(username))
    const mot = client.escapeLiteral(decodeURIComponent(password))
    await client.query(`ALTER ROLE ${role} PASSWORD ${mot}`)
  } finally {
    await client.end()
  }
}
