import { BulleCorrection, Bouton } from '@janus/ui'
import type { CorrectionSuivie, PropositionErreur } from './useHoteFiche.ts'
import styles from './Bloc.module.css'
import { TEXTES_ERREUR_IA } from './textes.ts'

export function EncartDecisionsIa({
  code,
  erreurs,
  corrections,
  question,
  surConfirmer,
  surRejeter,
  surCompter,
  surNePasCompter,
  surChanger,
}: {
  readonly code: string
  readonly erreurs: readonly PropositionErreur[]
  readonly corrections: readonly CorrectionSuivie[]
  readonly question: (id: string) => string
  readonly surConfirmer: (proposition: PropositionErreur) => void
  readonly surRejeter: (proposition: PropositionErreur) => void
  readonly surCompter: (correction: CorrectionSuivie) => void
  readonly surNePasCompter: (correction: CorrectionSuivie) => void
  readonly surChanger: (correction: CorrectionSuivie) => void
}) {
  return (
    <section className={styles['encart']} aria-label="À vérifier">
      {erreurs.map((proposition) => (
        <div
          key={`erreur:${proposition.correction}:${proposition.erreur}`}
          className={styles['decisionIa']}
        >
          <p className={`${styles['encartTitre'] ?? ''} texte-corps-16`}>
            {TEXTES_ERREUR_IA.titre}
          </p>
          {proposition.reponse !== '' && (
            <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>
              « {proposition.reponse} »
            </p>
          )}
          <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>
            {TEXTES_ERREUR_IA.consequence(code)}
          </p>
          <div className={styles['actionsDialogue']}>
            <Bouton
              variante="secondaire"
              onClick={() => {
                surConfirmer(proposition)
              }}
            >
              {TEXTES_ERREUR_IA.confirmer}
            </Bouton>
            <Bouton
              variante="secondaire"
              onClick={() => {
                surRejeter(proposition)
              }}
            >
              {TEXTES_ERREUR_IA.rejeter}
            </Bouton>
          </div>
        </div>
      ))}
      {corrections.map((suivie) => (
        <div
          key={`correction:${suivie.correction.id}`}
          className={styles['decisionIa']}
          data-correction={suivie.correction.id}
        >
          <p className={`${styles['encartTitre'] ?? ''} texte-corps-16`}>
            {question(suivie.correction.question)}
          </p>
          <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>« {suivie.reponse} »</p>
          <BulleCorrection
            niveau={suivie.correction.niveau}
            message={suivie.correction.message}
            source={suivie.correction.source}
            nonVerifie
            enfants={
              <div className={styles['actionsDialogue']}>
                <Bouton
                  variante="secondaire"
                  onClick={() => {
                    surCompter(suivie)
                  }}
                >
                  Compter ce niveau
                </Bouton>
                <Bouton
                  variante="secondaire"
                  onClick={() => {
                    surNePasCompter(suivie)
                  }}
                >
                  Ne pas compter
                </Bouton>
                <Bouton
                  variante="secondaire"
                  onClick={() => {
                    surChanger(suivie)
                  }}
                >
                  Changer le niveau
                </Bouton>
              </div>
            }
          />
        </div>
      ))}
    </section>
  )
}
