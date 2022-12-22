/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ReleaseConfig } from '../../../release/config/index.js';
import { ActiveReleaseTrains } from '../../../release/versioning/index.js';
import { GithubConfig, NgDevConfig } from '../../../utils/config.js';
import { TargetLabelConfig } from './target-label.js';
import { GithubClient } from '../../../utils/git/github.js';
import { PullRequestConfig } from '../../config/index.js';
/**
 * Gets a list of target labels and their configs. The merge tooling will
 * respect match to the appropriate label config and leverage it for determining
 * into which branches a pull request should merge into.
 *
 * The target label configs are implemented according to the design document which
 * specifies versioning, branching and releasing for the Angular organization:
 * https://docs.google.com/document/d/197kVillDwx-RZtSVOBtPb4BBIAw0E9RT3q3v6DZkykU
 *
 * @param api Instance of a Github client. Used to query for the release train branches.
 * @param config Configuration for the Github remote and release packages. Used to fetch
 *   NPM version data when LTS version branches are validated.
 */
export declare function getTargetLabelConfigsForActiveReleaseTrains({ latest, releaseCandidate, next, exceptionalMinor }: ActiveReleaseTrains, api: GithubClient, config: NgDevConfig<{
    github: GithubConfig;
    pullRequest: PullRequestConfig;
    release?: ReleaseConfig;
}>): Promise<TargetLabelConfig[]>;
