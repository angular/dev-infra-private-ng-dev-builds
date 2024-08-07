/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AuthenticatedGitClient } from './git/authenticated-git-client.js';
/**
 * Gets the given pull request from Github using the GraphQL API endpoint.
 */
export declare function getPr<PrSchema>(prSchema: PrSchema, prNumber: number, git: AuthenticatedGitClient): Promise<PrSchema | null>;
/** Get all pending PRs from github  */
export declare function getPendingPrs<PrSchema>(prSchema: PrSchema, git: AuthenticatedGitClient): Promise<PrSchema[]>;
/** Get all files in a PR from github  */
export declare function getPrFiles<PrFileSchema>(fileSchema: PrFileSchema, prNumber: number, git: AuthenticatedGitClient): Promise<PrFileSchema[]>;
/** Get all files in a PR from github  */
export declare function getPrComments<PrCommentsSchema>(commentsSchema: PrCommentsSchema, prNumber: number, git: AuthenticatedGitClient): Promise<PrCommentsSchema[]>;
