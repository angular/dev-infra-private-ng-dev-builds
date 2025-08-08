import { Commit } from './parse.js';
export interface ValidateCommitMessageOptions {
    disallowSquash?: boolean;
    nonFixupCommitHeaders?: string[];
}
export interface ValidateCommitMessageResult {
    valid: boolean;
    errors: string[];
    commit: Commit;
}
export declare function validateCommitMessage(commitMsg: string | Commit, options?: ValidateCommitMessageOptions): Promise<ValidateCommitMessageResult>;
export declare function printValidationErrors(errors: string[], print?: {
    (...values: unknown[]): void;
    group(label: string, collapsed?: boolean): void;
    groupEnd(): void;
}): void;
