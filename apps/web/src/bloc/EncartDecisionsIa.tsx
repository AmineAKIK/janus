import { BulleCorrection, Bouton } from '@janus/ui'
import type { CorrectionSuivie, PropositionErreur } from './useHoteFiche.ts'
import styles from './Bloc.module.css'
import { ErreurIaProposee } from './EncartErreurIa.tsx'
import { texteTuteurDeSecours } from '../questions/textes.ts'

export function EncartDecisionsIa({
  code,
  erreurs,
  corrections,
  question,
  libelleErreur,
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
  /** Le nom d'une erreur critique, depuis le manifeste du bloc. */
  readonly libelleErreur: (id: string) => string
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
          <ErreurIaProposee
            code={code}
            libelle={libelleErreur(proposition.erreur)}
            reponse={proposition.reponse}
            surConfirmer={() => {
              surConfirmer(proposition)
            }}
            surRejeter={() => {
              surRejeter(proposition)
            }}
          />
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
          {suivie.correction.secours && (
            <p role="status" className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>
              {texteTuteurDeSecours(suivie.correction.modele)}
            </p>
          )}
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
