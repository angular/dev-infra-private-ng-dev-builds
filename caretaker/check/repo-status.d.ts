import { MergeMode } from '../../utils/git/repository-merge-mode.js';
import { BaseModule } from './base.js';
export declare class RepoStatusModule extends BaseModule<{
    mergeMode: MergeMode;
}> {
    retrieveData(): Promise<{
        mergeMode: MergeMode;
    }>;
    printToTerminal(): Promise<void>;
}
