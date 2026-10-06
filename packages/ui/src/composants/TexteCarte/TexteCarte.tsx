import { classes } from '../../utilitaires/classes.ts'
import { analyser } from './analyse.ts'
import type { Segment } from './analyse.ts'
import styles from './TexteCarte.module.css'

export interface ProprietesTexteCarte {
  /** Le recto ou le verso : du texte avec paragraphes, listes numérotées, `code` et **gras**. */
  readonly texte: string
  readonly className?: string
}

function EnLigne({ segments }: { readonly segments: readonly Segment[] }) {
  return segments.map((segment, index) => {
    if (segment.type === 'code') {
      return (
        <code key={index} className={styles['code']}>
          {segment.texte}
        </code>
      )
    }
    if (segment.type === 'gras') return <strong key={index}>{segment.texte}</strong>
    return segment.texte
  })
}

/**
 * Le texte d'une carte, rendu en éléments React : jamais par `innerHTML`, donc un `<b>` ou un
 * `<script>` écrit dans le texte reste du texte.
 */
export function TexteCarte({ texte, className }: ProprietesTexteCarte) {
  return (
    <div className={classes(styles['texte'], 'texte-corps-16', className)}>
      {analyser(texte).map((bloc, index) => {
        if (bloc.type === 'bloc_de_code') {
          return (
            <pre key={index} className={styles['bloc']}>
              <code>{bloc.code}</code>
            </pre>
          )
        }
        if (bloc.type === 'liste') {
          return (
            <ol key={index} className={styles['liste']}>
              {bloc.elements.map((element, rang) => (
                <li key={rang}>
                  <EnLigne segments={element} />
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={index} className={styles['paragraphe']}>
            <EnLigne segments={bloc.segments} />
          </p>
        )
      })}
    </div>
  )
}
