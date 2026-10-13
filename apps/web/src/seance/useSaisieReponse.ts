import { TAILLE_MAX_REPONSE } from '@janus/contrats'
import type { Confiance } from '@janus/contrats'
import { useState } from 'react'
import type { ChangeEvent } from 'react'

/**
 * Ce que l'élève saisit pour répondre : sa confiance, sa réponse libre et le fait qu'il a collé du
 * texte. `champ` se passe tel quel à la zone de texte de la réponse.
 */
export function useSaisieReponse(
  depart: {
    readonly confiance: Confiance
    readonly reponse: string
    readonly colle: boolean
  } | null = null,
) {
  const [confiance, setConfiance] = useState<Confiance | null>(depart?.confiance ?? null)
  const [reponse, setReponse] = useState(depart?.reponse ?? '')
  const [colle, setColle] = useState(depart?.colle ?? false)
  return {
    confiance,
    setConfiance,
    reponse,
    colle,
    vide: reponse.trim() === '',
    champ: {
      value: reponse,
      maxLength: TAILLE_MAX_REPONSE,
      onChange: (evenement: ChangeEvent<HTMLTextAreaElement>) => {
        setReponse(evenement.currentTarget.value)
      },
      onPaste: () => {
        setColle(true)
      },
    },
  }
}
