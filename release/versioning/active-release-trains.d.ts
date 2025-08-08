import { ReleaseTrain } from './release-trains.js';
import { ReleaseRepoWithApi } from './version-branches.js';
export declare class ActiveReleaseTrains {
    private trains;
    readonly releaseCandidate: ReleaseTrain | null;
    readonly next: ReleaseTrain;
    readonly latest: ReleaseTrain;
    readonly exceptionalMinor: ReleaseTrain | null;
    constructor(trains: {
        releaseCandidate: ReleaseTrain | null;
        exceptionalMinor: ReleaseTrain | null;
        next: ReleaseTrain;
        latest: ReleaseTrain;
    });
    isFeatureFreeze(): boolean;
    static fetch(repo: ReleaseRepoWithApi): Promise<ActiveReleaseTrains>;
}
