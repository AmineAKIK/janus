import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validerManifeste } from '@janus/contrats'
import { beforeAll, describe, expect, it } from 'vitest'
import { extraireManifeste } from './domaines/catalogue/adaptateur.ts'
import { CE_QUE_FAIT_LE_GABARIT, texteDeLaFiche } from './texteFiche.ts'

const GABARIT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../contenu/dwwm/gabarit/fiche.html',
)

/** La fiche du gabarit, avec une explication et un item remplis, et des réponses qui ne doivent pas fuiter. */
async function ficheRemplie(): Promise<string> {
  const html = (await readFile(GABARIT, 'utf8'))
    .replace(
      "<p>À REMPLACER : l'explication du bloc.</p>",
      [
        '<div data-ecran="Les poids">',
        '  <div role="img" aria-label="La suite 01001101"><span>128</span><span>0</span></div>',
        '  <p>Une phrase\n     coupée par le formatage.<span aria-hidden="true">✓</span></p>',
        '  <p>Un octet a <strong>8&nbsp;bits</strong> &amp; 256 valeurs.</p>',
        '  <svg viewBox="0 0 10 10"><text>8</text></svg><img src="data:," alt="Huit lampes">',
        '  <div data-widget="octet" data-cible="150"></div>',
        '  <ul><li>128</li><li>64</li></ul>',
        '  <p>Un octet : 2<sup>8</sup> = 256 valeurs.</p>',
        '  <div class="schema-bloc"><span class="boite-fixe">Les bits<small>01000001</small></span',
        '  ><span class="fleche">lus avec un codage →</span',
        '  ><span class="boite-fixe">Un sens<small>A</small></span></div>',
        '  <details><summary>Un coup de pouce</summary><p>150 − 128 = 22</p></details>',
        '</div>',
      ].join('\n'),
    )
    .replace(
      '<p data-erreur="E1">À REMPLACER : item PR1-1 (E1).</p>',
      '<p>Convertis <code>150</code> en binaire.</p><div data-widget="convertir" data-reponse="10010110" data-succes="Bravo, 10010110."></div>',
    )
  const texte = extraireManifeste(html) ?? ''
  const manifeste = JSON.parse(texte) as {
    restitution: { attendu: string }[]
    cartes: { verso: string }[]
  }
  const [r1] = manifeste.restitution
  const [k1] = manifeste.cartes
  if (r1 === undefined || k1 === undefined) throw new Error('gabarit')
  r1.attendu = 'Attendu secret de R1.'
  k1.verso = 'Verso secret de K1.'
  return html.replace(texte, () => JSON.stringify(manifeste))
}

describe('texteDeLaFiche : ce que lit l’apprenant neuf', () => {
  let html: string
  let texte: string
  beforeAll(async () => {
    html = await ficheRemplie()
    const resultat = validerManifeste(JSON.parse(extraireManifeste(html) ?? 'null'))
    if (!resultat.ok) throw new Error('Le gabarit rempli doit rester valide.')
    texte = texteDeLaFiche(html, resultat.manifeste)
  })

  it('donne chaque étape dans l’ordre, les explications écran par écran, en texte simple', () => {
    // Sans template, la carte montre l'objectif puis la liste des étapes.
    expect(texte).toContain(
      '### ET1 : Carte du bloc\n\nÀ REMPLACER : ce que tu sauras faire à la fin, vérifiable en une phrase.\n- Carte du bloc\n- Explication',
    )
    expect(texte).toContain('### ET2 : Explication')
    expect(texte).toContain('#### Les poids')
    expect(texte).toContain('Un octet a 8 bits & 256 valeurs.')
    expect(texte).toContain('- 128\n- 64')
    expect(texte).toContain('Un octet : 2^8 = 256 valeurs.')
    expect(texte).toContain('Les bits (01000001)\nlus avec un codage →\nUn sens (A)')
    expect(texte).toContain('Un coup de pouce')
    expect(texte).toContain('150 − 128 = 22')
  })

  it('garde les phrases entières, même coupées par le formatage du fichier', () => {
    expect(texte).toContain('Une phrase coupée par le formatage.\n')
  })

  it('signale un outil interactif sans en donner le fonctionnement', () => {
    expect(texte).toContain('[outil interactif : octet]')
  })

  it('remplace une image par sa description, et tait ce qui est décoratif', () => {
    expect(texte).toContain('[image : La suite 01001101]')
    expect(texte).toContain('[image : sans description] [image : Huit lampes]')
    expect(texte).not.toContain('1280')
    expect(texte).not.toContain('✓')
  })

  it('pose ensuite la pratique, les questions, les tâches différées et les cartes, sans réponse', () => {
    expect(texte).toContain('- PR1-1 : Convertis 150 en binaire. [outil interactif : convertir]')
    expect(texte).toMatch(/- R1 : .+/)
    expect(texte).toMatch(/- DE1 : .+/)
    expect(texte).toMatch(/- K1 : .+/)
    for (const reponse of ['10010110', 'Bravo', 'Attendu secret', 'Verso secret', 'correcteur']) {
      expect(texte).not.toContain(reponse)
    }
  })

  it('lit la perception, le pré-test, l’aisance et l’ensemble à leur place, l’objectif replié dans la carte', () => {
    const texteManifeste = extraireManifeste(html) ?? ''
    const manifeste = JSON.parse(texteManifeste) as {
      etapes: { id: string; titre: string; type: string }[]
    }
    const [carte, explication, pratique, ...suite] = manifeste.etapes
    if (carte === undefined || explication === undefined || pratique === undefined)
      throw new Error('gabarit')
    manifeste.etapes = [
      { id: 'ET7', titre: 'Perception', type: 'perception' },
      carte,
      { id: 'ET8', titre: 'Pré-test', type: 'pretest' },
      explication,
      pratique,
      { id: 'ET10', titre: 'Aisance', type: 'aisance' },
      { id: 'ET9', titre: 'L’ensemble', type: 'ensemble' },
      ...suite,
    ]
    const page = html
      .replace(texteManifeste, () => JSON.stringify(manifeste))
      .replace(
        '</body>',
        [
          '<template data-etape="ET1"><p>Tu es ici : le premier bloc.</p></template>',
          '<template data-etape="ET7"><p>Regarde les huit lampes s’allumer.</p></template>',
          '<template data-etape="ET8"><p>Parie : combien de valeurs ?</p></template>',
          '<template data-etape="ET10"><p>Des séries chronométrées.</p></template>',
          '<template data-etape="ET9"><p>Le tout : les poids font le nombre.</p></template>',
          '</body>',
        ].join(''),
      )
    const resultat = validerManifeste(JSON.parse(extraireManifeste(page) ?? 'null'))
    if (!resultat.ok) throw new Error(resultat.problemes.map(({ message }) => message).join(' ; '))

    const lu = texteDeLaFiche(page, resultat.manifeste)

    const positions = [
      '### ET7 : Perception',
      'Regarde les huit lampes s’allumer.',
      '### ET1 : Carte du bloc',
      'Tu es ici : le premier bloc.\nReplié sous « Ce qui sera vérifié » : À REMPLACER',
      '### ET8 : Pré-test',
      'Parie : combien de valeurs ?',
      '### ET2 : Explication',
      '### ET3 : Pratique\n\nReplié sous « Ce qui sera vérifié » : À REMPLACER',
      'plus bas, dans « Ce qu’on te demande », partie Pratique.',
      '### ET10 : Aisance',
      'Des séries chronométrées.',
      '### ET9 : L’ensemble',
      'Le tout : les poids font le nombre.',
      '### ET4 : Restitution',
      'dès que tu commences, il est masqué jusqu’à ta dernière réponse, comme le reste de la fiche.',
      '### ET6 : Bilan',
      '## Ce qu’on te demande',
    ].map((titre) => lu.indexOf(titre))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('ne prend pas pour un template ce que la plomberie en dit dans un commentaire', () => {
    // La plomberie cite `<template data-etape="ET1">` : ce n'est pas la carte.
    expect(texte).not.toContain('afficherCarte')
    expect(texte).not.toContain('etapes[0].id')
  })

  it('ne montre à l’apprenant neuf ni coup de pouce, ni retour, ni variante, ni le gabarit', () => {
    expect(texte).not.toContain('## Pour le gardien de la méthode')
    expect(texte).not.toContain('## Ce que la page montre après une tentative')
  })

  it('pour le gardien, ajoute ce que la page montre après une tentative : réponse, coups de pouce, retours, variantes', () => {
    const page = html
      .replace(
        '<template data-item="PR1-2"><p data-erreur="E2">À REMPLACER : item PR1-2 (E2).</p></template>',
        [
          '<template data-item="PR1-2"><div data-widget="nombre" data-verifie data-reponse="31"',
          ' data-aide1="Combien de valeurs avec 5 bits ?" data-solution="31 : 32 valeurs, de 0 à 31."',
          ' data-si-e1="32" data-retour-e1="32, c’est le nombre de valeurs : la première est 0."',
          ' data-si-poids="16" data-retour-poids="16, c’est le poids du bit de gauche."',
          ' data-sinon="Relis les poids." data-succes="31, tous les bits à 1.">Le plus grand nombre sur 5 bits ?</div></template>',
          '<template data-item="PR1-3"><div data-widget="choix" data-reponse="b" data-justifier="Explique ton choix.">Le binaire, c’est :',
          '<ul><li data-option="a" data-erreur="E2" data-retour="Le binaire écrit des nombres.">Un langage</li>',
          '<li data-option="b">Une base</li></ul></div>',
          '<table><tr data-reponse="oui" data-question="128 tient-il dans 178 ?" data-explication="178 − 128 = 50.">',
          '<td>128</td></tr></table>',
          '<div data-widget="nombre" data-accepte="huit|8">Combien de bits ?</div>',
          '<div data-widget="schema-memoire" data-explication="Du bit au sens, par la convention.">',
          '<div data-case="Bit" data-accepte="bit|bits" data-indice="deux états.">Case 1</div>',
          '<p data-lien="qui donne" data-choix="qui donne|qui lit">Lien</p>',
          '<p data-lien="qui est lu par" data-mots="lu|lit|lire;par|avec">Lien</p></div>',
          '<div data-widget="pari" data-apres="C’est noté, sans note.">Ton pari</div>',
          '<div data-widget="nombre" data-reponse="15" data-variante-enonce="avec 3 bits ?"',
          ' data-variante-reponse="7" data-variante-aide1="Par où commencer ?" data-variante-solution="De 0 à 7."',
          ' data-variante-si-e1="8" data-variante-retour-e1="8, c’est le nombre de valeurs."',
          ' data-variante-sinon="Relis le maximum." data-variante-succes="7, juste.">Avec 4 bits ?</div>',
          '<div data-widget="convertir" data-reponse="100" data-variante="88">01100100 ?</div>',
          '<div data-widget="reprise"><ul><li data-option="r" data-avant="Avec sa règle.">Avec sa convention</li></ul></div></template>',
          '<template data-variante="PR1-3"><div data-widget="choix" data-reponse="a">Écrire 101, c’est :',
          '<ul><li data-option="a">Écrire un nombre</li></ul></div></template>',
        ].join(''),
      )
      .replace(
        '<template data-item="PR1-3"><p>À REMPLACER : énoncé de l\'item PR1-3.</p></template>',
        '',
      )
    const resultat = validerManifeste(JSON.parse(extraireManifeste(page) ?? 'null'))
    if (!resultat.ok) throw new Error('Le gabarit rempli doit rester valide.')

    const pourLApprenant = texteDeLaFiche(page, resultat.manifeste)
    const pourLeGardien = texteDeLaFiche(page, resultat.manifeste, { conception: true })

    for (const cache of [
      'Combien de valeurs avec 5 bits',
      'la première est 0',
      'Écrire 101',
      '178 − 128',
      'huit',
      'Relis les poids',
      'Explique ton choix',
      'deux états',
      'avec 3 bits',
      'Avec sa règle',
      'Du bit au sens',
    ]) {
      expect(pourLApprenant).not.toContain(cache)
    }
    expect(pourLeGardien.startsWith(pourLApprenant.trimEnd())).toBe(true)
    const conception = pourLeGardien.slice(
      pourLeGardien.indexOf('## Ce que la page montre après une tentative'),
    )
    expect(conception).toContain(
      [
        '### PR1-2',
        '',
        '- Réponse attendue : 31',
        '- Coup de pouce 1 : Combien de valeurs avec 5 bits ?',
        '- Solution : 31 : 32 valeurs, de 0 à 31.',
        '- Retour si « 32 » (E1) : 32, c’est le nombre de valeurs : la première est 0.',
        '- Retour si « 16 » : 16, c’est le poids du bit de gauche.',
        '- Retour pour toute autre réponse fausse : Relis les poids.',
        '- Réussite : 31, tous les bits à 1.',
      ].join('\n'),
    )
    expect(conception).toContain(
      [
        '### PR1-3',
        '',
        '- Réponse attendue : « Une base »',
        '- Après une bonne réponse, à justifier : Explique ton choix. Puis comparée à la solution.',
        '- Retour à l’option « Un langage » (E2) : Le binaire écrit des nombres.',
        '- Réponse attendue à « 128 tient-il dans 178 ? » : oui',
        '- Après la réponse : 178 − 128 = 50.',
        '- Réponses acceptées : « huit » ou « 8 »',
        '- Case à remplir de mémoire : « Bit »',
        '- Réponses acceptées : « bit » ou « bits »',
        '- Indice après une première vérification fausse : deux états.',
        '- Lien à choisir : « qui donne », parmi « qui donne » ou « qui lit »',
        '- Lien à écrire de mémoire : « qui est lu par »',
        '- Lien accepté s’il dit, avec ses mots : « lu » ou « lit » ou « lire », et « par » ou « avec »',
        '- Après le choix : C’est noté, sans note.',
        '- Réponse attendue : 15',
        '- Après la solution, à refaire sans regarder sur un autre cas : « avec 3 bits ? » Réponse attendue : 7',
        '- Sur l’autre cas, coup de pouce 1 : Par où commencer ?',
        '- Sur l’autre cas, solution : De 0 à 7.',
        '- Sur l’autre cas, retour si « 8 » (E1) : 8, c’est le nombre de valeurs.',
        '- Sur l’autre cas, retour pour toute autre réponse fausse : Relis le maximum.',
        '- Sur l’autre cas, réussite : 7, juste.',
        '- Réponse attendue : 100',
        '- Après la solution, à refaire sans regarder sur un autre nombre : 88',
        '- Rappel du pari du début, si l’apprenant avait choisi « Avec sa convention » : « Avec sa règle. »',
        // L'explication du schéma ne vient qu'une fois ses cases justes : elle suit tout le reste.
        '- Schéma de mémoire, une fois toutes les cases justes, si l’apprenant a ouvert l’étape détaillée d’un élément : il explique le schéma sans le regarder, puis la page montre, pour comparer : « Du bit au sens, par la convention. »',
      ].join('\n'),
    )
    expect(conception).toContain('### PR1-3, variante après une solution vue')
    expect(conception).toContain('Écrire 101, c’est :')
    expect(conception).toContain('- Réponse attendue : « Écrire un nombre »')
  })

  it('pour le gardien, dit ce que fait le gabarit, ce que déclarent les outils, les erreurs critiques et l’alignement', () => {
    const page = html
      .replace(
        '</body>',
        '<template data-conception><p>L’outil convertir repère seul les bits à l’envers.</p></template></body>',
      )
      .replace(
        '<template data-item="PR1-2"><p data-erreur="E2">À REMPLACER : item PR1-2 (E2).</p></template>',
        '<template data-item="PR1-2"><div data-widget="nombre" data-reponse="31" data-si-e1="32" data-retour-e1="Le premier est 0.">?</div></template>',
      )
    const resultat = validerManifeste(JSON.parse(extraireManifeste(page) ?? 'null'))
    if (!resultat.ok) throw new Error('Le gabarit rempli doit rester valide.')
    const gardien = texteDeLaFiche(page, resultat.manifeste, { conception: true })
    const positions = [
      '## Pour le gardien de la méthode',
      '### Ce que fait le gabarit, sur toute fiche',
      '### Ce que les outils de cette fiche font d’eux-mêmes',
      'L’outil convertir repère seul les bits à l’envers.',
      '### Les erreurs critiques',
      '### Le tableau d’alignement',
      'Notions :',
      '- N1 : À REMPLACER',
      'Hors objectif (noté pour plus tard, jamais interrogé) :',
      '## Ce que la page montre après une tentative',
    ].map((titre) => gardien.indexOf(titre))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(gardien).toMatch(
      /- E1 : .+ Questions qui la touchent : R\d.*Retour écrit pour elle dans : PR1-2\./,
    )
  })

  it('ne cite du gabarit que des libellés que la page affiche', async () => {
    const gabarit = (await readFile(GABARIT, 'utf8')).replaceAll('\\u00a0', ' ')
    const faits = CE_QUE_FAIT_LE_GABARIT.join(' ')
    for (const libelle of [
      'Écouter',
      'Ce qui sera vérifié',
      'J’ai réussi',
      'Pas réussi',
      'J’ai eu besoin d’aide',
      'Solution vue',
      'Tu as vu la solution. Refais-la sans la regarder.',
      'Revenir au cours',
      'Commencer',
      'dès que tu commences, il est masqué jusqu’à ta dernière réponse',
      'Une erreur cochée, ou repérée dans tes réponses, reste cochée : seule une réponse solide à une question qui la touche la referme.',
      'Ne compte pas · ',
      'Avec support',
      'Non vérifiée',
      'Ta confiance',
      'Sûr',
      'Hésitant',
      'Au hasard',
      'Compléter ma réponse',
      'Ce complément ne compte pas pour le statut',
      'Corrigée à la fin de la série.',
      'Cette étape s’ouvrira après ta dernière réponse',
      'Aller au bilan',
      'D’accord avec ce niveau ?',
      'Repérée dans tes réponses',
      'À reprendre',
    ]) {
      expect(faits, libelle).toContain(libelle.trim())
      expect(gabarit.replaceAll('\u00a0', ' '), libelle).toContain(libelle)
    }
  })

  it('met tout l’enseignement avant la première question', () => {
    const positions = [
      '## Ce que la fiche enseigne',
      '### ET2 : Explication',
      '## Ce qu’on te demande',
      '### Pratique',
      '### Restitution',
      '### Rappel',
      '### Tâches différées',
      '### Cartes',
    ].map((titre) => texte.indexOf(titre))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})
