import styles from './App.module.css'

interface Props {
  /** Identifiant court du commit, absent en développement local. */
  readonly commit: string | undefined
}

export function App({ commit }: Props) {
  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Janus</h1>
      <p className={styles.commit}>{commit ?? 'local'}</p>
    </main>
  )
}
