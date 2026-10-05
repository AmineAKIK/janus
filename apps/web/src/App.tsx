import styles from './App.module.css'

interface ProprietesApp {
  /** Identifiant court du commit, absent en développement local. */
  readonly commit: string | undefined
}

export function App({ commit }: ProprietesApp) {
  return (
    <main className={styles.page}>
      <h1 className={[styles.titre, 'texte-titre-28'].join(' ')}>Janus</h1>
      <p className={[styles.commit, 'texte-legende-12'].join(' ')}>{commit ?? 'local'}</p>
    </main>
  )
}
