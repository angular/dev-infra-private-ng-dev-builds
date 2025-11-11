import { CommitReference, CommitNote } from 'conventional-commits-parser';
export interface Commit {
    fullText: string;
    header: string;
    originalHeader: string;
    body: string;
    footer: string;
    references: CommitReference[];
    type: string;
    scope: string;
    subject: string;
    breakingChanges: CommitNote[];
    deprecations: CommitNote[];
    isFixup: boolean;
    isSquash: boolean;
    isRevert: boolean;
}
export interface CommitFromGitLog extends Commit {
    author: string;
    hash: string;
    shortHash: string;
}
declare const commitFields: {
    hash: string;
    shortHash: string;
    author: string;
};
export type CommitFields = typeof commitFields;
export declare const commitFieldsAsFormat: (fields: CommitFields) => string;
export declare const gitLogFormatForParsing: string;
export declare const parseCommitMessage: (fullText: string) => Commit;
export declare const parseCommitFromGitLog: (fullText: Buffer) => CommitFromGitLog;
export {};
