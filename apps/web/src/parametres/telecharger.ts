/** Fait télécharger un texte par le navigateur, comme un clic sur un lien de téléchargement. */
export function telecharger(nom: string, contenu: string, type: string): void {
  const adresse = URL.createObjectURL(new Blob([contenu], { type }))
  const lien = document.createElement('a')
  lien.href = adresse
  lien.download = nom
  document.body.append(lien)
  lien.click()
  lien.remove()
  URL.revokeObjectURL(adresse)
}
