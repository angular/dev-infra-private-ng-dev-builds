/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullRequest } from '../pull-request.js';
import { MergeStrategy } from './strategy.js';
/**
 * Merge strategy that does not use the Github API for merging. Instead, it fetches
 * all target branches and the PR locally. The PR is then cherry-picked with autosquash
 * enabled into the target branches. The benefit is the support for fixup and squash commits.
 * A notable downside though is that Github does not show the PR as `Merged` due to non
 * fast-forward merges
 */
export declare class AutosquashMergeStrategy extends MergeStrategy {
    /**
     * Merges the specified pull request into the target branches and pushes the target
     * branches upstream. This method requires the temporary target branches to be fetched
     * already as we don't want to fetch the target branches per pull request merge. This
     * would causes unnecessary multiple fetch requests when multiple PRs are merged.
     *
     * @throws {GitCommandError} An unknown Git command error occurred that is not
     *   specific to the pull request merge.
     * @throws {FatalMergeToolError} A fatal error if the merge could not be performed.
     */
    merge(pullRequest: PullRequest): Promise<void>;
}
