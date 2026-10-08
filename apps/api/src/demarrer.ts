import { creerBase } from './base/base.ts'
import { ErreurConfig, lireConfig } from './config.ts'
import { horlogeSysteme } from './horloge.ts'
import { creerServeur } from './serveur.ts'
import { demarrerLesTaches } from './taches/rappels.ts'

const PORT_PAR_DEFAUT = 3000

try {
  const config = lireConfig(process.env)
  const base = creerBase(config.DATABASE_URL)
  const proprietaire = creerBase(config.DATABASE_URL_PROPRIETAIRE)
  const app = await creerServeur({ config, horloge: horlogeSysteme, base, proprietaire })
  await app.listen({ host: '0.0.0.0', port: Number(process.env['PORT'] ?? PORT_PAR_DEFAUT) })
  const taches = await demarrerLesTaches({
    proprietaire,
    envoyerLesRappels: () => app.envoyerLesRappels(),
    erreur: (message, cause) => {
      app.log.error({ err: cause }, message)
    },
  })
  const arreter = () => {
    void taches.arreter().then(() => app.close())
  }
  process.once('SIGTERM', arreter)
  process.once('SIGINT', arreter)
} catch (erreur) {
  if (erreur instanceof ErreurConfig) {
    process.stderr.write(`${erreur.message}\n`)
    process.exit(1)
  }
  throw erreur
}
