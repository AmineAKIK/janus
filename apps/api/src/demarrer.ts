import { randomUUID } from 'node:crypto'
import { verifierCleVapid } from './adaptateurs/push/webpush.ts'
import { envoyerEnveloppe } from './adaptateurs/suiviErreurs/envoyeurHttp.ts'
import { creerBase } from './base/base.ts'
import { migrer } from './base/migrer.ts'
import { poserMotDePasseApplication } from './base/roleApplication.ts'
import { ErreurConfig, lireConfig } from './config.ts'
import { horlogeSysteme } from './horloge.ts'
import { libererLesReservations } from './domaines/correction/composition.ts'
import { recalculerLesPerimes } from './recalcul.ts'
import { creerSuiviErreurs } from './plugins/suiviErreurs.ts'
import { creerServeur } from './serveur.ts'
import { demarrerLesTaches } from './taches/rappels.ts'

/** Au-delà, l'arrêt est forcé : mieux vaut un redémarrage qu'un processus qui ne finit pas. */
const DELAI_ARRET_MS = 9000

try {
  const config = lireConfig(process.env)
  verifierCleVapid({
    sujet: config.VAPID_SUJET,
    clePublique: config.VAPID_PUBLIC_KEY,
    clePrivee: config.VAPID_PRIVATE_KEY,
  })
  // Une migration qui échoue arrête le démarrage : l'ancienne version, déjà en marche, reste en place.
  await migrer(config.DATABASE_URL_PROPRIETAIRE)
  await poserMotDePasseApplication(config.DATABASE_URL_PROPRIETAIRE, config.DATABASE_URL)
  const base = creerBase(config.DATABASE_URL)
  const proprietaire = creerBase(config.DATABASE_URL_PROPRIETAIRE)
  // Si les règles du moteur ont changé depuis le dernier calcul, les statuts et échéances gardés sont refaits.
  const recalcules = await recalculerLesPerimes(base, horlogeSysteme)
  if (recalcules > 0)
    process.stdout.write(`${String(recalcules)} bloc(s) recalculé(s) au démarrage.\n`)
  await libererLesReservations(base)
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
  await app.listen({ host: '0.0.0.0', port: config.PORT })
  const taches = await demarrerLesTaches({
    proprietaire,
    envoyerLesRappels: () => app.envoyerLesRappels(),
    erreur: (message, cause) => {
      app.log.error({ err: cause }, message)
    },
    info: (message, bilan) => {
      app.log.info(bilan, message)
    },
  })
  // Arrêt dans l'ordre : plus de requêtes, les tâches en cours finissent, puis les connexions se ferment.
  let enArret = false
  const arreter = async (code: number) => {
    if (enArret) return
    enArret = true
    setTimeout(() => process.exit(1), DELAI_ARRET_MS).unref()
    try {
      await app.close()
      await taches.arreter()
    } catch (cause) {
      app.log.error({ err: cause }, 'Arrêt en erreur')
      code = 1
    }
    await Promise.allSettled([base.fermer(), proprietaire.fermer()])
    process.exit(code)
  }
  process.on('SIGTERM', () => void arreter(0))
  process.on('SIGINT', () => void arreter(0))
} catch (erreur) {
  if (erreur instanceof ErreurConfig) {
    process.stderr.write(`${erreur.message}\n`)
    process.exit(1)
  }
  throw erreur
}
