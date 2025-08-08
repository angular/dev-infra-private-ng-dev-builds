export type EnvStampMode = 'snapshot' | 'release';
export declare function printEnvStamp(mode: EnvStampMode, includeVersion: boolean): Promise<void>;
