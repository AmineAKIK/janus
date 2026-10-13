import { z } from 'zod'

// Les briques que presque tous les schémas du contrat réutilisent. Une seule définition de chacune :
// si la règle change, elle change partout.

/** Un texte affiché ou stocké : non vide, sans espaces autour. */
export const Texte = z.string().trim().min(1)

/** L'identifiant d'une chose du manifeste, d'un message ou d'une ligne (question, étape, exercice, erreur...). */
export const Identifiant = z.string().trim().min(1)

/** Le code d'un bloc : une à trois lettres majuscules puis deux ou trois chiffres (`D01`, `ADM12`). */
export const CodeBloc = z.string().regex(/^[A-Z]{1,3}\d{2,3}$/)
