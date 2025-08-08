import { PullRequest } from '../pull-request.js';
import { MergeStrategy } from './strategy.js';
export declare class AutosquashMergeStrategy extends MergeStrategy {
    merge(pullRequest: PullRequest): Promise<void>;
}
