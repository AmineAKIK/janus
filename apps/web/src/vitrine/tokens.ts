/** Noms des variables CSS montrées par la vitrine. Les valeurs viennent de `tokens.css`. */
export const COULEURS = [
  '--couleur-fond',
  '--couleur-surface',
  '--couleur-surface-douce',
  '--couleur-ligne',
  '--couleur-encre',
  '--couleur-texte-secondaire',
  '--couleur-accent',
  '--couleur-accent-sur-fond',
  '--couleur-succes',
  '--couleur-alerte',
  '--couleur-erreur',
  '--couleur-focus',
  '--effet-ombre-carte',
] as const

export const STATUTS = [
  '--statut-non-commence',
  '--statut-en-cours',
  '--statut-vu',
  '--statut-acquis-provisoirement',
  '--statut-acquis',
  '--statut-maitrise',
  '--statut-a-reprendre',
] as const

export const ESPACEMENTS = [4, 8, 12, 16, 24, 32, 48] as const

export const RAYONS = ['--rayon-champ', '--rayon-carte'] as const

export const STYLES_TEXTE = [
  { classe: 'texte-titre-28', nom: 'Titre 28' },
  { classe: 'texte-titre-22', nom: 'Titre 22' },
  { classe: 'texte-sous-titre-18', nom: 'Sous-titre 18' },
  { classe: 'texte-corps-16', nom: 'Corps 16' },
  { classe: 'texte-petit-14', nom: 'Petit 14' },
  { classe: 'texte-legende-12', nom: 'Légende 12' },
  { classe: 'texte-code-14', nom: 'Code 14' },
] as const
