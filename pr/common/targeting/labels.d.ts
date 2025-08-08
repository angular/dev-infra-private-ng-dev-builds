import { ReleaseConfig } from '../../../release/config/index.js';
import { ActiveReleaseTrains } from '../../../release/versioning/index.js';
import { GithubConfig, NgDevConfig } from '../../../utils/config.js';
import { TargetLabelConfig } from './target-label.js';
import { GithubClient } from '../../../utils/git/github.js';
import { PullRequestConfig } from '../../config/index.js';
export declare function getTargetLabelConfigsForActiveReleaseTrains({ latest, releaseCandidate, next, exceptionalMinor }: ActiveReleaseTrains, api: GithubClient, config: NgDevConfig<{
    github: GithubConfig;
    pullRequest: PullRequestConfig;
    release?: ReleaseConfig;
}>): Promise<TargetLabelConfig[]>;
