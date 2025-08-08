import { ReleaseConfig } from '../../../release/config/index.js';
import { ReleaseRepoWithApi } from '../../../release/versioning/index.js';
export declare function assertActiveLtsBranch(repo: ReleaseRepoWithApi, releaseConfig: ReleaseConfig, branchName: string): Promise<void>;
