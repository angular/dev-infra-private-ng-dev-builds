import semver from 'semver';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { BuiltPackageWithInfo, ReleaseConfig } from '../config/index.js';
import { ReleaseNotes } from '../notes/release-notes.js';
import { NpmDistTag, PackageJson } from '../versioning/index.js';
import { ActiveReleaseTrains } from '../versioning/active-release-trains.js';
import { Commit } from '../../utils/git/octokit-types.js';
export interface GithubRepo {
    owner: string;
    name: string;
}
export interface PullRequest {
    id: number;
    url: string;
    fork: GithubRepo;
    forkBranch: string;
}
export interface StagingOptions {
    updatePkgJsonFn?: (pkgJson: PackageJson) => void;
}
export interface ReleaseActionConstructor<T extends ReleaseAction = ReleaseAction> {
    isActive(active: ActiveReleaseTrains, config: ReleaseConfig): Promise<boolean>;
    new (...args: [ActiveReleaseTrains, AuthenticatedGitClient, ReleaseConfig, string]): T;
}
export declare abstract class ReleaseAction {
    protected active: ActiveReleaseTrains;
    protected git: AuthenticatedGitClient;
    protected config: ReleaseConfig;
    protected projectDir: string;
    static isActive(_trains: ActiveReleaseTrains, _config: ReleaseConfig): Promise<boolean>;
    abstract getDescription(): Promise<string>;
    abstract perform(): Promise<void>;
    constructor(active: ActiveReleaseTrains, git: AuthenticatedGitClient, config: ReleaseConfig, projectDir: string);
    protected updateProjectVersion(newVersion: semver.SemVer, additionalUpdateFn?: (pkgJson: PackageJson) => void): Promise<void>;
    protected getAspectLockFiles(): string[];
    protected getLatestCommitOfBranch(branchName: string): Promise<Commit>;
    protected assertPassingGithubStatus(commitSha: string, branchNameForError: string): Promise<void>;
    protected waitForEditsAndCreateReleaseCommit(newVersion: semver.SemVer): Promise<void>;
    private _getForkOfAuthenticatedUser;
    private _isBranchNameReservedInRepo;
    private _findAvailableBranchName;
    protected createLocalBranchFromHead(branchName: string): Promise<void>;
    protected pushHeadToRemoteBranch(branchName: string): Promise<void>;
    private _pushHeadToFork;
    protected pushChangesToForkAndCreatePullRequest(targetBranch: string, proposedForkBranchName: string, title: string, body?: string): Promise<PullRequest>;
    protected prependReleaseNotesToChangelog(releaseNotes: ReleaseNotes): Promise<void>;
    protected checkoutUpstreamBranch(branchName: string): Promise<void>;
    protected installDependenciesForCurrentBranch(): Promise<void>;
    protected createCommit(message: string, files: string[]): Promise<void>;
    protected buildReleaseForCurrentBranch(): Promise<BuiltPackageWithInfo[]>;
    protected stageVersionForBranchAndCreatePullRequest(newVersion: semver.SemVer, compareVersionForReleaseNotes: semver.SemVer, pullRequestTargetBranch: string, opts?: StagingOptions): Promise<{
        releaseNotes: ReleaseNotes;
        pullRequest: PullRequest;
        builtPackagesWithInfo: BuiltPackageWithInfo[];
    }>;
    protected checkoutBranchAndStageVersion(newVersion: semver.SemVer, compareVersionForReleaseNotes: semver.SemVer, stagingBranch: string, stagingOpts?: StagingOptions): Promise<{
        releaseNotes: ReleaseNotes;
        pullRequest: PullRequest;
        builtPackagesWithInfo: BuiltPackageWithInfo[];
        beforeStagingSha: string;
    }>;
    protected cherryPickChangelogIntoNextBranch(releaseNotes: ReleaseNotes, stagingBranch: string): Promise<boolean>;
    protected promptAndWaitForPullRequestMerged(pullRequest: PullRequest): Promise<void>;
    private _createGithubReleaseForVersion;
    private _getGithubChangelogUrlForRef;
    protected publish(builtPackagesWithInfo: BuiltPackageWithInfo[], releaseNotes: ReleaseNotes, beforeStagingSha: string, publishBranch: string, npmDistTag: NpmDistTag, additionalOptions: {
        showAsLatestOnGitHub: boolean;
    }): Promise<void>;
    private _publishBuiltPackageToNpm;
    private _getAndValidateLatestCommitForPublishing;
    private _verifyPackageVersions;
}
