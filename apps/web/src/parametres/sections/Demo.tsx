import { Bouton, Interrupteur, LigneReglage } from '@janus/ui'
import { InterrupteursDemo } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import styles from '../Parametres.module.css'
import { LIBELLES_INTERRUPTEURS, TEXTES_DEMO as T } from '../textes.ts'

const NOMS = InterrupteursDemo.keyof().options

/** Le panneau de démo : le temps, la graine et les interrupteurs, par les outils que le build de démo expose. */
export function SectionDemo() {
  const client = useQueryClient()
  const outils = window.__janusDemo
  const [, redessiner] = useState(0)
  if (outils === undefined) return null
  const { maintenant, interrupteurs } = outils.lire()
  /** Les données déjà lues ne valent plus rien après un saut dans le temps ou un retour à zéro. */
  const apres = () => {
    void client.invalidateQueries()
    redessiner((valeur) => valeur + 1)
  }

  return (
    <>
      <p className="texte-corps-16">
        {T.heure} : <time dateTime={maintenant}>{maintenant.slice(0, 16).replace('T', ' ')}</time>
      </p>
      <div className={styles['actionsDemo']}>
        {T.avancer.map(({ libelle, ms }) => (
          <Bouton
            key={libelle}
            type="button"
            variante="secondaire"
            onClick={() => {
              outils.avancer(ms)
              apres()
            }}
          >
            {libelle}
          </Bouton>
        ))}
      </div>
      <div className={styles['actions']}>
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => {
            outils.reinitialiser('graine')
            apres()
          }}
        >
          {T.zero}
        </Bouton>
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => {
            outils.reinitialiser('vide')
            apres()
          }}
        >
          {T.vide}
        </Bouton>
      </div>
      <section aria-label={T.interrupteurs} className={styles['lignes']}>
        <h3 className="texte-petit-14">{T.interrupteurs}</h3>
        {NOMS.map((nom) => (
          <LigneReglage
            key={nom}
            libelle={LIBELLES_INTERRUPTEURS[nom]}
            controle={
              <Interrupteur
                coche={interrupteurs[nom]}
                onChange={(actif) => {
                  outils.interrupteur(nom, actif)
                  apres()
                }}
              />
            }
          />
        ))}
      </section>
    </>
  )
}
