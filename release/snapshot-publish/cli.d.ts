import { CommandModule } from 'yargs';
export interface SnapshotPublishOptions {
    skipNonAffectedSnapshots: boolean;
    dryRun: boolean;
}
export declare const ReleasePublishSnapshotsCommandModule: CommandModule<{}, SnapshotPublishOptions>;
