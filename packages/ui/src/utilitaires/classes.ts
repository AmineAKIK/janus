/** Assemble des noms de classe en ignorant les valeurs absentes. */
export function classes(...noms: readonly (string | false | null | undefined)[]): string {
  return noms.filter((nom) => typeof nom === 'string' && nom !== '').join(' ')
}
