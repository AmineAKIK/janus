import { readFile } from 'node:fs/promises'
import { SchemaImport } from '../config.ts'
import { creerBase } from '../base/base.ts'
import { ErreurImport, monterImportation } from '../domaines/catalogue/composition.ts'
import { horlogeSysteme } from '../horloge.ts'

/** Le squelette des deux commandes d'import : l'environnement, la base, les erreurs d'import en sortie 1. */
export async function lancerImport(
  usage: string,
  action: (
    service: ReturnType<typeof monterImportation>,
    fichier: string,
    contenu: string,
  ) => Promise<string>,
): Promise<void> {
  const fichier = process.argv[2]
  const environnement = SchemaImport.safeParse(process.env)
  if (fichier === undefined || !environnement.success) {
    process.stderr.write(`Usage : DATABASE_URL=… FICHES_DIR=… ${usage}\n`)
    process.exitCode = 1
    return
  }
  const { DATABASE_URL: url, FICHES_DIR: dossier } = environnement.data
  const base = creerBase(url)
  try {
    const service = monterImportation(base, horlogeSysteme, dossier)
    process.stdout.write(`${await action(service, fichier, await readFile(fichier, 'utf8'))}\n`)
  } catch (erreur) {
    if (!(erreur instanceof ErreurImport)) throw erreur
    for (const probleme of erreur.problemes) process.stderr.write(`- ${probleme}\n`)
    process.exitCode = 1
  } finally {
    await base.fermer()
  }
}
