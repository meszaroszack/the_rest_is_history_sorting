/**
 * No persistence needed: the Atlas reads three static JSON files on the client.
 * Kept as a stub so the template's server wiring stays intact.
 */
export interface IStorage {}

export class MemStorage implements IStorage {}

export const storage: IStorage = new MemStorage();
