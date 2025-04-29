/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { BuiltPackageWithInfo, ReleaseConfig } from '../config/index.js';
import { ReleaseNotes } from '../notes/release-notes.js';
import { NpmDistTag, PackageJson } from '../versioning/index.js';
import { ActiveReleaseTrains } from '../versioning/active-release-trains.js';
import { PnpmVersioning } from './pnpm-versioning.js';
import { Commit } from '../../utils/git/octokit-types.js';
/** Interface describing a Github repository. */
export interface GithubRepo {
    owner: string;
    name: string;
}
/** Interface describing a Github pull request. */
export interface PullRequest {
    /** Unique id for the pull request (i.e. the PR number). */
    id: number;
    /** URL that resolves to the pull request in Github. */
    url: string;
    /** Fork containing the head branch of this pull request. */
    fork: GithubRepo;
    /** Branch name in the fork that defines this pull request. */
    forkBranch: string;
}
/** Options that can be used to control the staging of a new version. */
export interface StagingOptions {
    /**
     * As part of staging, the `package.json` can be updated before the
     * new version is set.
     * @see {ReleaseAction.updateProjectVersion}
     */
    updatePkgJsonFn?: (pkgJson: PackageJson) => void;
}
/** Constructor type for instantiating a release action */
export interface ReleaseActionConstructor<T extends ReleaseAction = ReleaseAction> {
    /** Whether the release action is currently active. */
    isActive(active: ActiveReleaseTrains, config: ReleaseConfig): Promise<boolean>;
    /** Constructs a release action. */
    new (...args: [ActiveReleaseTrains, AuthenticatedGitClient, ReleaseConfig, string]): T;
}
/**
 * Abstract base class for a release action. A release action is selectable by the caretaker
 * if active, and can perform changes for releasing, such as staging a release, bumping the
 * version, cherry-picking the changelog, branching off from the main branch. etc.
 */
export declare abstract class ReleaseAction {
    protected active: ActiveReleaseTrains;
    protected git: AuthenticatedGitClient;
    protected config: ReleaseConfig;
    protected projectDir: string;
    /** Whether the release action is currently active. */
    static isActive(_trains: ActiveReleaseTrains, _config: ReleaseConfig): Promise<boolean>;
    /** Gets the description for a release action. */
    abstract getDescription(): Promise<string>;
    /**
     * Performs the given release action.
     * @throws {UserAbortedReleaseActionError} When the user manually aborted the action.
     * @throws {FatalReleaseActionError} When the action has been aborted due to a fatal error.
     */
    abstract perform(): Promise<void>;
    protected pnpmVersioning: PnpmVersioning;
    constructor(active: ActiveReleaseTrains, git: AuthenticatedGitClient, config: ReleaseConfig, projectDir: string);
    /**
     * Updates the version in the project top-level `package.json` file.
     *
     * @param newVersion New SemVer version to be set in the file.
     * @param additionalUpdateFn Optional update function that runs before
     *   the version update. Can be used to update other fields.
     */
    protected updateProjectVersion(newVersion: semver.SemVer, additionalUpdateFn?: (pkgJson: PackageJson) => void): Promise<void>;
    protected getAspectLockFiles(): string[];
    /** Gets the most recent commit of a specified branch. */
    protected getLatestCommitOfBranch(branchName: string): Promise<Commit>;
    /**
     * Verifies that the given commit has passing all statuses.
     *
     * Upon error, a link to the branch containing the commit is printed,
     * allowing the caretaker to quickly inspect the GitHub commit status failures.
     */
    protected assertPassingGithubStatus(commitSha: string, branchNameForError: string): Promise<void>;
    /**
     * Prompts the user for potential release notes edits that need to be made. Once
     * confirmed, a new commit for the release point is created.
     */
    protected waitForEditsAndCreateReleaseCommit(newVersion: semver.SemVer): Promise<void>;
    /**
     * Gets an owned fork for the configured project of the authenticated user. Aborts the
     * process with an error if no fork could be found.
     */
    private _getForkOfAuthenticatedUser;
    /** Checks whether a given branch name is reserved in the specified repository. */
    private _isBranchNameReservedInRepo;
    /** Finds a non-reserved branch name in the repository with respect to a base name. */
    private _findAvailableBranchName;
    /**
     * Creates a local branch from the current Git `HEAD`. Will override
     * existing branches in case of a collision.
     */
    protected createLocalBranchFromHead(branchName: string): Promise<void>;
    /** Pushes the current Git `HEAD` to the given remote branch in the configured project. */
    protected pushHeadToRemoteBranch(branchName: string): Promise<void>;
    /**
     * Pushes the current Git `HEAD` to a fork for the configured project that is owned by
     * the authenticated user. If the specified branch name exists in the fork already, a
     * unique one will be generated based on the proposed name to avoid collisions.
     * @param proposedBranchName Proposed branch name for the fork.
     * @param trackLocalBranch Whether the fork branch should be tracked locally. i.e. whether
     *   a local branch with remote tracking should be set up.
     * @returns The fork and branch name containing the pushed changes.
     */
    private _pushHeadToFork;
    /**
     * Pushes changes to a fork for the configured project that is owned by the currently
     * authenticated user. A pull request is then created for the pushed changes on the
     * configured project that targets the specified target branch.
     * @returns An object describing the created pull request.
     */
    protected pushChangesToForkAndCreatePullRequest(targetBranch: string, proposedForkBranchName: string, title: string, body?: string): Promise<PullRequest>;
    /**
     * Prepend releases notes for a version published in a given branch to the changelog in
     * the current Git `HEAD`. This is useful for cherry-picking the changelog.
     * @returns A boolean indicating whether the release notes have been prepended.
     */
    protected prependReleaseNotesToChangelog(releaseNotes: ReleaseNotes): Promise<void>;
    /** Checks out an upstream branch with a detached head. */
    protected checkoutUpstreamBranch(branchName: string): Promise<void>;
    /** Installs all Yarn dependencies in the current branch. */
    protected installDependenciesForCurrentBranch(): Promise<void>;
    /**
     * Creates a commit for the specified files with the given message.
     * @param message Message for the created commit
     * @param files List of project-relative file paths to be committed.
     */
    protected createCommit(message: string, files: string[]): Promise<void>;
    /**
     * Builds the release output for the current branch. Assumes the node modules
     * to be already installed for the current branch.
     *
     * @returns A list of built release packages.
     */
    protected buildReleaseForCurrentBranch(): Promise<BuiltPackageWithInfo[]>;
    /**
     * Stages the specified new version for the current branch, builds the release output,
     * verifies its output and creates a pull request  that targets the given base branch.
     *
     * This method assumes the staging branch is already checked-out.
     *
     * @param newVersion New version to be staged.
     * @param compareVersionForReleaseNotes Version used for comparing with the current
     *   `HEAD` in order build the release notes.
     * @param pullRequestTargetBranch Branch the pull request should target.
     * @param opts Non-mandatory options for controlling the staging, e.g.
     *   allowing for additional `package.json` modifications.
     * @returns an object capturing actions performed as part of staging.
     */
    protected stageVersionForBranchAndCreatePullRequest(newVersion: semver.SemVer, compareVersionForReleaseNotes: semver.SemVer, pullRequestTargetBranch: string, opts?: StagingOptions): Promise<{
        releaseNotes: ReleaseNotes;
        pullRequest: PullRequest;
        builtPackagesWithInfo: BuiltPackageWithInfo[];
    }>;
    /**
     * Checks out the specified target branch, verifies its CI status and stages
     * the specified new version in order to create a pull request.
     *
     * @param newVersion New version to be staged.
     * @param compareVersionForReleaseNotes Version used for comparing with `HEAD` of
     *   the staging branch in order build the release notes.
     * @param stagingBranch Branch within the new version should be staged.
     * @param stagingOptions Non-mandatory options for controlling the staging of
     *   the new version. e.g. allowing for additional `package.json` modifications.
     * @returns an object capturing actions performed as part of staging.
     */
    protected checkoutBranchAndStageVersion(newVersion: semver.SemVer, compareVersionForReleaseNotes: semver.SemVer, stagingBranch: string, stagingOpts?: StagingOptions): Promise<{
        releaseNotes: ReleaseNotes;
        pullRequest: PullRequest;
        builtPackagesWithInfo: BuiltPackageWithInfo[];
        beforeStagingSha: string;
    }>;
    /**
     * Cherry-picks the release notes of a version that have been pushed to a given branch
     * into the `next` primary development branch. A pull request is created for this.
     * @returns a boolean indicating successful creation of the cherry-pick pull request.
     */
    protected cherryPickChangelogIntoNextBranch(releaseNotes: ReleaseNotes, stagingBranch: string): Promise<boolean>;
    /** Prompts the user for merging the pull request, and waits for it to be merged. */
    protected promptAndWaitForPullRequestMerged(pullRequest: PullRequest): Promise<void>;
    /**
     * Creates a Github release for the specified version. The release is created
     * by tagging the version bump commit, and by creating the release entry.
     *
     * Expects the version bump commit and changelog to be available in the
     * upstream remote.
     *
     * @param releaseNotes The release notes for the version being published.
     * @param versionBumpCommitSha Commit that bumped the version. The release tag
     *   will point to this commit.
     * @param isPrerelease Whether the new version is published as a pre-release.
     * @param showAsLatestOnGitHub Whether the version released will represent
     *   the "latest" version of the project. I.e. GitHub will show this version as "latest".
     */
    private _createGithubReleaseForVersion;
    /** Gets a Github URL that resolves to the release notes in the given ref. */
    private _getGithubChangelogUrlForRef;
    /**
     * Publishes the given packages to the registry and makes the releases
     * available on GitHub.
     *
     * @param builtPackagesWithInfo List of built packages that will be published.
     * @param releaseNotes The release notes for the version being published.
     * @param beforeStagingSha Commit SHA that is expected to be the most recent one after
     *   the actual version bump commit. This exists to ensure that caretakers do not land
     *   additional changes after the release output has been built locally.
     * @param publishBranch Name of the branch that contains the new version.
     * @param npmDistTag NPM dist tag where the version should be published to.
     * @param additionalOptions Additional options needed for publishing a release.
     */
    protected publish(builtPackagesWithInfo: BuiltPackageWithInfo[], releaseNotes: ReleaseNotes, beforeStagingSha: string, publishBranch: string, npmDistTag: NpmDistTag, additionalOptions: {
        showAsLatestOnGitHub: boolean;
    }): Promise<void>;
    /** Publishes the given built package to NPM with the specified NPM dist tag. */
    private _publishBuiltPackageToNpm;
    /**
     * Retreive the latest commit from the provided branch, and verify that it is the expected
     * release commit and is the direct child of the previous sha provided.
     *
     * The method will make one recursive attempt to check again before throwing an error if
     * any error occurs during this validation.
     */
    private _getAndValidateLatestCommitForPublishing;
    /** Verify the version of each generated package exact matches the specified version. */
    private _verifyPackageVersions;
}
