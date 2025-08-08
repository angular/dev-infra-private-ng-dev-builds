import { NgDevConfig } from '../utils/config.js';
export interface CommitMessageConfig {
    maxLineLength: number;
    minBodyLength: number;
    minBodyLengthTypeExcludes?: string[];
    scopes: string[];
    disallowFixup?: boolean;
}
export declare function assertValidCommitMessageConfig<T extends NgDevConfig>(config: T & Partial<{
    commitMessage: CommitMessageConfig;
}>): asserts config is T & {
    commitMessage: CommitMessageConfig;
};
export declare enum ScopeRequirement {
    Required = 0,
    Optional = 1,
    Forbidden = 2
}
export declare enum ReleaseNotesLevel {
    Hidden = 0,
    Visible = 1
}
export interface CommitType {
    description: string;
    name: string;
    scope: ScopeRequirement;
    releaseNotesLevel: ReleaseNotesLevel;
}
export declare const COMMIT_TYPES: {
    [key: string]: CommitType;
};
