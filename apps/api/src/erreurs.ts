import type { CodeProbleme, ProblemeApi } from '@janus/contrats'

/** Une erreur métier : le gestionnaire d'erreurs est le seul à la traduire en réponse HTTP. */
export abstract class ErreurMetier extends Error {
  abstract readonly status: number
  abstract readonly code: CodeProbleme
  abstract readonly titre: string
}

export class Refus extends ErreurMetier {
  readonly status = 403
  readonly code = 'refus'
  readonly titre = 'Refusé'
}
export class Introuvable extends ErreurMetier {
  readonly status = 404
  readonly code = 'introuvable'
  readonly titre = 'Introuvable'
}
export class Conflit extends ErreurMetier {
  readonly status = 409
  readonly code = 'conflit'
  readonly titre = 'Conflit'
}
export class ContenuDifferent extends ErreurMetier {
  readonly status = 422
  readonly code = 'contenu_different'
  readonly titre = 'Contenu différent'
}
export class BudgetAtteint extends ErreurMetier {
  readonly status = 429
  readonly code = 'budget_atteint'
  readonly titre = 'Budget atteint'
}
export class PreconditionEchouee extends ErreurMetier {
  readonly status = 412
  readonly code = 'precondition_echouee'
  readonly titre = 'Précondition échouée'
}

/** Les erreurs de protocole que les middlewares lèvent eux-mêmes. */
export class ErreurProtocole extends ErreurMetier {
  readonly status: number
  readonly code: CodeProbleme
  readonly titre: string
  constructor(status: number, code: CodeProbleme, titre: string, detail: string) {
    super(detail)
    this.status = status
    this.code = code
    this.titre = titre
  }
}

/** Le corps `application/problem+json` d'une erreur. */
export function versProbleme(
  status: number,
  code: CodeProbleme,
  titre: string,
  detail: string,
): ProblemeApi {
  return { type: `urn:janus:erreur:${code}`, title: titre, status, detail, code }
}

/** Trop d'essais : la réponse dit dans combien de secondes réessayer (`retry-after`). */
export class TropDeTentatives extends ErreurMetier {
  readonly status = 429
  readonly code = 'trop_de_requetes'
  readonly titre = 'Trop d’essais'
  readonly reessayerDansS: number
  constructor(reessayerDansS: number) {
    super(`Trop d’essais : réessaie dans ${String(reessayerDansS)} secondes.`)
    this.reessayerDansS = reessayerDansS
  }
}

export class NonAuthentifie extends ErreurMetier {
  readonly status = 401
  readonly code = 'non_authentifie'
  readonly titre = 'Non authentifié'
}
