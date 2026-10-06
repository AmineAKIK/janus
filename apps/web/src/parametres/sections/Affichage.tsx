import {
  appliquerTaille,
  appliquerTheme,
  LigneReglage,
  lireTaille,
  lireTheme,
  SelecteurTaille,
  SelecteurTheme,
} from '@janus/ui'
import { useState } from 'react'
import { TEXTES_AFFICHAGE as T } from '../textes.ts'

/** Les mêmes réglages que dans la barre de l'appli : ils restent sur cet appareil. */
export function SectionAffichage() {
  const [theme, setTheme] = useState(lireTheme)
  const [taille, setTaille] = useState(lireTaille)
  return (
    <>
      <LigneReglage
        libelle={T.apparence}
        controle={
          <SelecteurTheme
            valeur={theme}
            onChange={(choix) => {
              appliquerTheme(choix)
              setTheme(choix)
            }}
          />
        }
      />
      <LigneReglage
        libelle={T.taille}
        controle={
          <SelecteurTaille
            valeur={taille}
            onChange={(choix) => {
              appliquerTaille(choix)
              setTaille(choix)
            }}
          />
        }
      />
    </>
  )
}
