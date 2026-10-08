import { creerBase } from './base/base.ts'
import { ErreurConfig, lireConfig } from './config.ts'
import { horlogeSysteme } from './horloge.ts'
import { creerServeur } from './serveur.ts'

const PORT_PAR_DEFAUT = 3000

try {
  const config = lireConfig(process.env)
  const base = creerBase(config.DATABASE_URL)
  const proprietaire = creerBase(config.DATABASE_URL_PROPRIETAIRE)
  const app = await creerServeur({ config, horloge: horlogeSysteme, base, proprietaire })
  await app.listen({ host: '0.0.0.0', port: Number(process.env['PORT'] ?? PORT_PAR_DEFAUT) })
} catch (erreur) {
  if (erreur instanceof ErreurConfig) {
    process.stderr.write(`${erreur.message}\n`)
    process.exit(1)
  }
  throw erreur
}
