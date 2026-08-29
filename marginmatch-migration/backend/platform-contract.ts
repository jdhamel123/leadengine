/**
 * Portable infrastructure contract for MarginMatch.
 * Future adapters can implement these capabilities without AppDeploy.
 */
export type PlatformRecord = Record<string, unknown>;
export interface DatabaseAdapter {
  list<T extends PlatformRecord>(collection:string, options?:PlatformRecord):Promise<{items:Array<T & {id:string}>}>;
  add<T extends PlatformRecord>(collection:string, records:T[]):Promise<string[]>;
  update<T extends PlatformRecord>(collection:string, records:Array<{id:string;record:T}>):Promise<boolean[]>;
}
export interface SecretsAdapter {
  readSecret(name:string):Promise<string>;
  listSecretNames():Promise<string[]>;
}
export interface AiAdapter {
  generate(options:PlatformRecord):Promise<{text:string}>;
  run(options:PlatformRecord):Promise<{data?:unknown}>;
}
