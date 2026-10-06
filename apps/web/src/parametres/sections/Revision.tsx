import { Reglages } from '@janus/contrats'
import type { ModificationReglages } from '@janus/contrats'
import { ChampReglage } from '../ChampReglage.tsx'
import { TEXTES_REVISION as T } from '../textes.ts'

const DEFAUTS = Reglages.parse({})

interface Proprietes {
  readonly reglages: Reglages
  readonly enregistrer: (corps: ModificationReglages) => void
}

export function SectionRevision({ reglages, enregistrer }: Proprietes) {
  return (
    <>
      <ChampReglage
        cle="nouvellesCartesParJour"
        libelle={T.nouvellesCartes}
        aide={T.nouvellesCartesAide}
        valeur={reglages.nouvellesCartesParJour}
        defaut={DEFAUTS.nouvellesCartesParJour}
        enregistrer={enregistrer}
      />
      <ChampReglage
        cle="retentionVisee"
        libelle={T.retention}
        aide={T.retentionAide}
        valeur={reglages.retentionVisee}
        defaut={DEFAUTS.retentionVisee}
        decimales={2}
        enregistrer={enregistrer}
      />
      <ChampReglage
        cle="questionsDebut"
        libelle={T.questionsDebut}
        aide={T.questionsDebutAide}
        valeur={reglages.questionsDebut}
        defaut={DEFAUTS.questionsDebut}
        enregistrer={enregistrer}
      />
    </>
  )
}
