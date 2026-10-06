import { Bouton, LigneReglage } from '@janus/ui'
import { useState } from 'react'
import { TEXTES_ZONE as T } from '../textes.ts'
import { SupprimerCompte } from './SupprimerCompte.tsx'

export function SectionZone() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <LigneReglage
        libelle={T.supprimer}
        aide={T.aide}
        controle={
          <Bouton
            type="button"
            variante="danger"
            onClick={() => {
              setOuvert(true)
            }}
          >
            {T.supprimer}
          </Bouton>
        }
      />
      {ouvert && (
        <SupprimerCompte
          surFermeture={() => {
            setOuvert(false)
          }}
        />
      )}
    </>
  )
}
