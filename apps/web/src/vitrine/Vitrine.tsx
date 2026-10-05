import {
  EnTeteSection,
  SelecteurTaille,
  SelecteurTheme,
  appliquerTaille,
  appliquerTheme,
  lireTaille,
  lireTheme,
  type Taille,
  type Theme,
} from '@janus/ui'
import { useEffect, useState } from 'react'
import { COULEURS, ESPACEMENTS, RAYONS, STATUTS, STYLES_TEXTE } from './tokens.ts'
import { SectionBoutons } from './sections/SectionBoutons.tsx'
import { SectionChamps } from './sections/SectionChamps.tsx'
import { SectionNavigation } from './sections/SectionNavigation.tsx'
import { SectionSelections } from './sections/SectionSelections.tsx'
import styles from './Vitrine.module.css'

function enHexadecimal(couleur: string): string {
  const composantes = /\d+(\.\d+)?/g
  const [rouge, vert, bleu] = (couleur.match(composantes) ?? []).map(Number)
  if (rouge === undefined || vert === undefined || bleu === undefined) return couleur
  return `#${[rouge, vert, bleu].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/** Valeur réellement appliquée à la pastille, dans le thème courant. */
function Pastille({ variable, version }: { readonly variable: string; readonly version: number }) {
  const [valeur, setValeur] = useState('')
  useEffect(() => {
    const echantillon = document.createElement('span')
    echantillon.style.color = `var(${variable})`
    document.body.append(echantillon)
    setValeur(enHexadecimal(getComputedStyle(echantillon).color))
    echantillon.remove()
  }, [variable, version])

  return (
    <li className={styles.pastille}>
      <span className={styles.echantillon} style={{ background: `var(${variable})` }} />
      <span className="texte-petit-14">{variable}</span>
      <span className="texte-code-14">{valeur}</span>
    </li>
  )
}

export function Vitrine() {
  const [theme, setTheme] = useState<Theme>(lireTheme)
  const [taille, setTaille] = useState<Taille>(lireTaille)
  // Change quand l'apparence change, pour relire les couleurs, y compris en thème Système.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const suivi = window.matchMedia('(prefers-color-scheme: dark)')
    const relire = () => {
      setVersion((v) => v + 1)
    }
    suivi.addEventListener('change', relire)
    return () => {
      suivi.removeEventListener('change', relire)
    }
  }, [])

  return (
    <main className={styles.page}>
      <h1 className="texte-titre-28">Vitrine</h1>

      <section className={styles.section} aria-label="Réglages d’affichage">
        <EnTeteSection
          titre="Réglages d’affichage"
          description="Thème et taille du texte, gardés d’une visite à l’autre."
        />
        <SelecteurTheme
          valeur={theme}
          onChange={(valeur) => {
            appliquerTheme(valeur)
            setTheme(valeur)
            setVersion((v) => v + 1)
          }}
        />
        <SelecteurTaille
          valeur={taille}
          onChange={(valeur) => {
            appliquerTaille(valeur)
            setTaille(valeur)
          }}
        />
      </section>

      <section className={styles.section} aria-labelledby="titre-couleurs">
        <h2 id="titre-couleurs" className="texte-titre-22">
          Couleurs
        </h2>
        <ul className={styles.grille}>
          {COULEURS.map((variable) => (
            <Pastille key={variable} variable={variable} version={version} />
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="titre-statuts">
        <h2 id="titre-statuts" className="texte-titre-22">
          Statuts
        </h2>
        <ul className={styles.grille}>
          {STATUTS.map((variable) => (
            <Pastille key={variable} variable={variable} version={version} />
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="titre-espacements">
        <h2 id="titre-espacements" className="texte-titre-22">
          Espacements
        </h2>
        <ul className={styles.grille}>
          {ESPACEMENTS.map((px) => (
            <li key={px} className={styles.pastille}>
              <span className={styles.barre} style={{ width: `var(--espacement-${String(px)})` }} />
              <span className="texte-petit-14">{`--espacement-${String(px)}`}</span>
              <span className="texte-code-14">{`${String(px)} px`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="titre-rayons">
        <h2 id="titre-rayons" className="texte-titre-22">
          Rayons, ombre et focus
        </h2>
        <ul className={styles.grille}>
          {RAYONS.map((variable) => (
            <li key={variable} className={styles.pastille}>
              <span className={styles.rayon} style={{ borderRadius: `var(${variable})` }} />
              <span className="texte-petit-14">{variable}</span>
            </li>
          ))}
          <li className={styles.pastille}>
            <span className={styles.ombre} />
            <span className="texte-petit-14">--ombre-carte</span>
          </li>
          <li className={styles.pastille}>
            <button type="button" className={styles.focus}>
              Tabulation pour voir le focus
            </button>
            <span className="texte-petit-14">--focus-anneau</span>
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="titre-textes">
        <h2 id="titre-textes" className="texte-titre-22">
          Styles de texte
        </h2>
        <ul className={styles.grille}>
          {STYLES_TEXTE.map(({ classe, nom }) => (
            <li key={classe} className={styles.pastille}>
              <span className={classe}>{nom}</span>
              <span className="texte-code-14">{`.${classe}`}</span>
            </li>
          ))}
        </ul>
      </section>
      <SectionBoutons />
      <SectionChamps />
      <SectionSelections />
      <SectionNavigation />
    </main>
  )
}
