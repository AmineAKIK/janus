/**
 * Les onglets d'une fiche n'ont pas de numéro : « l'étape 6 » ne dit rien à l'apprenant. Un texte
 * qui renvoie à une étape par son numéro (un attendu, le cours du correcteur) nomme ici l'onglet :
 * « l'étape 6 » devient « l'étape « L'ordre de calcul » », « les étapes 3 à 5 », la liste des trois
 * onglets. Un numéro sans étape au manifeste reste tel quel. De même, « l'erreur E4 » est un code de
 * conception : avec les erreurs critiques du manifeste, elle devient « l'erreur « <son libellé> » »,
 * comme le fait la fiche en mode autonome (`attenduEnMots` du gabarit).
 */
export function etapesEnMots(
  texte: string,
  etapes: readonly { readonly id: string; readonly titre: string }[],
  erreurs: readonly { readonly id: string; readonly libelle: string }[] = [],
): string {
  const titre = (n: number) => etapes.find((etape) => etape.id === `ET${String(n)}`)?.titre
  return texte
    .replace(/\bl([’'])erreur (E\d+)\b/g, (tout, apostrophe: string, code: string) => {
      const libelle = erreurs.find((erreur) => erreur.id === code)?.libelle
      return libelle === undefined ? tout : `l${apostrophe}erreur « ${libelle} »`
    })
    .replace(
      /(?<![\p{L}\p{N}])(étapes?)\s+(\d+(?:\s*(?:,|et|à)\s*\d+)*)/gu,
      (tout, mot: string, liste: string) => {
        const numeros: number[] = []
        for (const [, debut, fin] of liste.matchAll(/(\d+)(?:\s*à\s*(\d+))?/g)) {
          const a = Number(debut)
          const b = fin === undefined ? a : Number(fin)
          for (let n = a; n <= b; n++) numeros.push(n)
        }
        const noms = numeros.map(titre)
        if (noms.some((nom) => nom === undefined)) return tout
        const cites = noms.map((nom) => `« ${String(nom)} »`)
        const dernier = cites.pop() ?? ''
        return `${mot} ${cites.length === 0 ? dernier : `${cites.join(', ')} et ${dernier}`}`
      },
    )
}
