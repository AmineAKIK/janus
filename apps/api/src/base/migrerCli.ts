import { migrer } from './migrer.ts'

const url = process.env['DATABASE_URL_PROPRIETAIRE']
if (url === undefined) {
  process.stderr.write(
    'DATABASE_URL_PROPRIETAIRE : variable manquante (le rôle propriétaire migre).\n',
  )
  process.exit(1)
}
await migrer(url)
process.stdout.write('Migrations appliquées.\n')
