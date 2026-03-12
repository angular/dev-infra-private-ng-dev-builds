import { GithubConfig, NgDevConfig } from '../../utils/config.js';
import { BuiltPackage, DevInfraReleaseConfig } from '../config/index.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { SnapshotPublishOptions } from './cli.js';
interface SnapshotPackage extends BuiltPackage {
    snapshotRepo: string;
}
interface SnapshotRepo {
    dir: string;
    url: string;
    name: string;
    containsChanges: boolean;
}
export declare class SnapshotPublisher {
    protected readonly flags: SnapshotPublishOptions;
    protected readonly git: AuthenticatedGitClient;
    protected readonly config: NgDevConfig<DevInfraReleaseConfig & {
        github: GithubConfig;
    }>;
    readonly branchName: string;
    readonly commitSha: string;
    readonly commitAuthor: string;
    readonly commitMessage: string;
    readonly snapshotCommitMessage: string;
    protected constructor(flags: SnapshotPublishOptions, git: AuthenticatedGitClient, config: NgDevConfig<DevInfraReleaseConfig & {
        github: GithubConfig;
    }>);
    static run(flags: SnapshotPublishOptions): Promise<void>;
    private run;
    getSnapshotArtifacts(): Promise<SnapshotPackage[]>;
    prepareSnapshotRepos(artifacts: SnapshotPackage[]): Promise<SnapshotRepo[]>;
    publishSnapshots(snapshots: SnapshotRepo[]): Promise<void>;
}
export {};
