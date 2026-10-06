import type { ROUTES, SortieRoute } from '@janus/contrats'
import { Bouton } from '@janus/ui'
import { useState } from 'react'
import { texteTache } from '../aujourdhui/textesTaches.ts'
import { CorrectionAffichee, erreurEnEtantSur, niveauAffiche } from './CorrectionAffichee.tsx'
import styles from './Questions.module.css'
import {
  TEXTES_QUESTIONS as T,
  texteEtapeSuivante,
  texteQuestionsFaites,
  tronquer,
} from './textes.ts'
import type { EtatQuestion } from './useSerie.ts'

type Aujourdhui = SortieRoute<(typeof ROUTES)['GET /aujourdhui']>
type Corrigee = Extract<EtatQuestion, { phase: 'corrigee' }>

export function FinDeSerie({
  questions,
  etats,
  aujourdhui,
}: {
  readonly questions: readonly { readonly id: string; readonly question: string }[]
  readonly etats: readonly EtatQuestion[]
  readonly aujourdhui?: Aujourdhui
}) {
  const [ouverte, setOuverte] = useState<string | null>(null)
  const titreBloc = (code: string) =>
    aujourdhui?.module?.blocs.find(({ bloc }) => bloc === code)?.titre_court ?? ''
  const lignes = questions.flatMap((question, index) => {
    const etat = etats[index]
    return etat?.phase === 'corrigee' ? [{ question, etat }] : []
  })
  const suivante = aujourdhui?.taches.find(
    ({ tache, faite }) => !faite && tache.type !== 'questions_debut',
  )
  const texteSuivante =
    suivante === undefined
      ? T.etapeSuivante
      : texteEtapeSuivante(texteTache(suivante.tache, { titreBloc, etape: () => null }).titre)

  return (
    <section className={styles['fin']}>
      <h2 className="texte-sous-titre-18">{texteQuestionsFaites(lignes.length)}</h2>
      <ul className={styles['lignes']}>
        {lignes.map(
          ({ question, etat }: { question: { id: string; question: string }; etat: Corrigee }) => (
            <li key={question.id}>
              <button
                type="button"
                className={styles['ligne']}
                aria-expanded={ouverte === question.id}
                onClick={() => {
                  setOuverte(ouverte === question.id ? null : question.id)
                }}
              >
                <span className="texte-petit-14">{tronquer(question.question)}</span>
                <span className={`${styles['meta'] ?? ''} texte-legende-12`}>
                  {etat.bloc === null ? '' : `${etat.bloc} ${titreBloc(etat.bloc)}`}
                </span>
                <span className="texte-legende-12">{niveauAffiche(etat)}</span>
                {erreurEnEtantSur(etat) && (
                  <span aria-label={T.legendeSure.slice(2)} className={styles['sur']}>
                    ⚠
                  </span>
                )}
              </button>
              {ouverte === question.id && (
                <CorrectionAffichee
                  etat={etat}
                  titreBloc={titreBloc(etat.bloc ?? '')}
                  dernier={false}
                />
              )}
            </li>
          ),
        )}
      </ul>
      <p className={`${styles['meta'] ?? ''} texte-legende-12`}>{T.legendeSure}</p>
      <Bouton
        type="button"
        variante="principal"
        onClick={() => {
          window.location.hash = suivante?.lien ?? '/'
        }}
      >
        {texteSuivante}
      </Bouton>
    </section>
  )
}
