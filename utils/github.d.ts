import { AuthenticatedGitClient } from './git/authenticated-git-client.js';
export declare function getPr<PrSchema>(prSchema: PrSchema, prNumber: number, git: AuthenticatedGitClient): Promise<PrSchema | null>;
export declare function getPendingPrs<PrSchema>(prSchema: PrSchema, git: AuthenticatedGitClient): Promise<PrSchema[]>;
export declare function getPrFiles<PrFileSchema>(fileSchema: PrFileSchema, prNumber: number, git: AuthenticatedGitClient): Promise<PrFileSchema[]>;
export declare function getPrComments<PrCommentsSchema>(commentsSchema: PrCommentsSchema, prNumber: number, git: AuthenticatedGitClient): Promise<PrCommentsSchema[]>;
