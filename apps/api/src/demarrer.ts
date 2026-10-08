import { randomUUID } from 'node:crypto'
import { envoyerEnveloppe } from './adaptateurs/suiviErreurs/envoyeurHttp.ts'
import { creerBase } from './base/base.ts'
import { migrer } from './base/migrer.ts'
import { poserMotDePasseApplication } from './base/roleApplication.ts'
import { ErreurConfig, lireConfig } from './config.ts'
import { horlogeSysteme } from './horloge.ts'
import { creerSuiviErreurs } from './plugins/suiviErreurs.ts'
import { creerServeur } from './serveur.ts'
import { demarrerLesTaches } from './taches/rappels.ts'

const PORT_PAR_DEFAUT = 3000

try {
  const config = lireConfig(process.env)
  // Une migration qui échoue arrête le démarrage : l'ancienne version, déjà en marche, reste en place.
  await migrer(config.DATABASE_URL_PROPRIETAIRE)
  await poserMotDePasseApplication(config.DATABASE_URL_PROPRIETAIRE, config.DATABASE_URL)
  const base = creerBase(config.DATABASE_URL)
  const proprietaire = creerBase(config.DATABASE_URL_PROPRIETAIRE)
  const signalerErreur = creerSuiviErreurs({
    dsn: config.SENTRY_DSN,
    horloge: horlogeSysteme,
    envoyer: envoyerEnveloppe,
    identifiant: () => randomUUID().replaceAll('-', ''),
    echec: (cause) => {
      process.stderr.write(`Suivi d'erreurs indisponible : ${String(cause)}\n`)
    },
  })
  const app = await creerServeur({
    config,
    horloge: horlogeSysteme,
    base,
    proprietaire,
    ...(signalerErreur === undefined ? {} : { signalerErreur }),
  })
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
