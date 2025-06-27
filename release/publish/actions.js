/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { promises as fs, existsSync } from 'fs';
import path, { join } from 'path';
import { workspaceRelativePackageJsonPath } from '../../utils/constants.js';
import { isGithubApiError } from '../../utils/git/github.js';
import githubMacros from '../../utils/git/github-macros.js';
import { getFileContentsUrl, getListCommitsInBranchUrl, getRepositoryGitUrl, } from '../../utils/git/github-urls.js';
import { green, Log } from '../../utils/logging.js';
import { Spinner } from '../../utils/spinner.js';
import { ReleaseNotes, workspaceRelativeChangelogPath } from '../notes/release-notes.js';
import { createExperimentalSemver } from '../versioning/experimental-versions.js';
import { NpmCommand } from '../versioning/npm-command.js';
import { getReleaseTagForVersion } from '../versioning/version-tags.js';
import { FatalReleaseActionError, UserAbortedReleaseActionError } from './actions-error.js';
import { analyzeAndExtendBuiltPackagesWithInfo, assertIntegrityOfBuiltPackages, } from './built-package-info.js';
import { getCommitMessageForRelease, getReleaseNoteCherryPickCommitMessage, } from './commit-message.js';
import { githubReleaseBodyLimit } from './constants.js';
import { ExternalCommands } from './external-commands.js';
import { promptToInitiatePullRequestMerge } from './prompt-merge.js';
import { Prompt } from '../../utils/prompt.js';
import { glob } from 'fast-glob';
import { PnpmVersioning } from './pnpm-versioning.js';
import { updateRenovateConfigTargetLabels } from './actions/renovate-config-updates.js';
import { targetLabels } from '../../pr/common/labels/target.js';
/**
 * Abstract base class for a release action. A release action is selectable by the caretaker
 * if active, and can perform changes for releasing, such as staging a release, bumping the
 * version, cherry-picking the changelog, branching off from the main branch. etc.
 */
export class ReleaseAction {
    /** Whether the release action is currently active. */
    static isActive(_trains, _config) {
        throw Error('Not implemented.');
    }
    constructor(active, git, config, projectDir) {
        this.active = active;
        this.git = git;
        this.config = config;
        this.projectDir = projectDir;
        this.pnpmVersioning = new PnpmVersioning();
    }
    /**
     * Updates the version in the project top-level `package.json` file.
     *
     * @param newVersion New SemVer version to be set in the file.
     * @param additionalUpdateFn Optional update function that runs before
     *   the version update. Can be used to update other fields.
     */
    async updateProjectVersion(newVersion, additionalUpdateFn) {
        const pkgJsonPath = join(this.projectDir, workspaceRelativePackageJsonPath);
        const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'));
        if (additionalUpdateFn !== undefined) {
            additionalUpdateFn(pkgJson);
        }
        pkgJson.version = newVersion.format();
        // Write the `package.json` file. Note that we add a trailing new line
        // to avoid unnecessary diff. IDEs usually add a trailing new line.
        await fs.writeFile(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
        Log.info(green(`  ✓   Updated project version to ${pkgJson.version}`));
        if (this.config.rulesJsInteropMode && existsSync(path.join(this.projectDir, '.aspect'))) {
            await ExternalCommands.invokeBazelUpdateAspectLockFiles(this.projectDir);
        }
    }
    /*
     * Get the modified Aspect lock files if `rulesJsInteropMode` is enabled.
     */
    getAspectLockFiles() {
        // TODO: Remove after `rules_js` migration is complete.
        return this.config.rulesJsInteropMode
            ? glob.sync(['.aspect/**', 'pnpm-lock.yaml'], { cwd: this.projectDir })
            : [];
    }
    /** Gets the most recent commit of a specified branch. */
    async getLatestCommitOfBranch(branchName) {
        const { data: { commit }, } = await this.git.github.repos.getBranch({ ...this.git.remoteParams, branch: branchName });
        return commit;
    }
    /**
     * Verifies that the given commit has passing all statuses.
     *
     * Upon error, a link to the branch containing the commit is printed,
     * allowing the caretaker to quickly inspect the GitHub commit status failures.
     */
    async assertPassingGithubStatus(commitSha, branchNameForError) {
        const { result } = await githubMacros.getCombinedChecksAndStatusesForRef(this.git.github, {
            ...this.git.remoteParams,
            ref: commitSha,
        });
        const branchCommitsUrl = getListCommitsInBranchUrl(this.git, branchNameForError);
        if (result === 'failing' || result === null) {
            Log.error(`  ✘   Cannot stage release. Commit "${commitSha}" does not pass all github ` +
                'status checks. Please make sure this commit passes all checks before re-running.');
            Log.error(`      Please have a look at: ${branchCommitsUrl}`);
            if (await Prompt.confirm({ message: 'Do you want to ignore the Github status and proceed?' })) {
                Log.warn('  ⚠   Upstream commit is failing CI checks, but status has been forcibly ignored.');
                return;
            }
            throw new UserAbortedReleaseActionError();
        }
        else if (result === 'pending') {
            Log.error(`  ✘   Commit "${commitSha}" still has pending github statuses that ` +
                'need to succeed before staging a release.');
            Log.error(`      Please have a look at: ${branchCommitsUrl}`);
            if (await Prompt.confirm({ message: 'Do you want to ignore the Github status and proceed?' })) {
                Log.warn('  ⚠   Upstream commit is pending CI, but status has been forcibly ignored.');
                return;
            }
            throw new UserAbortedReleaseActionError();
        }
        Log.info(green('  ✓   Upstream commit is passing all github status checks.'));
    }
    /**
     * Prompts the user for potential release notes edits that need to be made. Once
     * confirmed, a new commit for the release point is created.
     */
    async waitForEditsAndCreateReleaseCommit(newVersion) {
        Log.warn('  ⚠   Please review the changelog and ensure that the log contains only changes ' +
            'that apply to the public API surface.');
        Log.warn('      Manual changes can be made. When done, please proceed with the prompt below.');
        if (!(await Prompt.confirm({ message: 'Do you want to proceed and commit the changes?' }))) {
            throw new UserAbortedReleaseActionError();
        }
        // Commit message for the release point.
        const filesToCommit = [
            workspaceRelativePackageJsonPath,
            workspaceRelativeChangelogPath,
            ...this.getAspectLockFiles(),
        ];
        const commitMessage = getCommitMessageForRelease(newVersion);
        // Create a release staging commit including changelog and version bump.
        await this.createCommit(commitMessage, filesToCommit);
        // The caretaker may have attempted to make additional changes. These changes would
        // not be captured into the release commit. The working directory should remain clean,
        // like we assume it being clean when we start the release actions.
        if (this.git.hasUncommittedChanges()) {
            Log.error('  ✘   Unrelated changes have been made as part of the changelog editing.');
            throw new FatalReleaseActionError();
        }
        Log.info(green(`  ✓   Created release commit for: "${newVersion}".`));
    }
    /**
     * Gets an owned fork for the configured project of the authenticated user. Aborts the
     * process with an error if no fork could be found.
     */
    async _getForkOfAuthenticatedUser() {
        try {
            return this.git.getForkOfAuthenticatedUser();
        }
        catch {
            const { owner, name } = this.git.remoteConfig;
            Log.error('  ✘   Unable to find fork for currently authenticated user.');
            Log.error(`      Please ensure you created a fork of: ${owner}/${name}.`);
            throw new FatalReleaseActionError();
        }
    }
    /** Checks whether a given branch name is reserved in the specified repository. */
    async _isBranchNameReservedInRepo(repo, name) {
        try {
            await this.git.github.repos.getBranch({ owner: repo.owner, repo: repo.name, branch: name });
            return true;
        }
        catch (e) {
            // If the error has a `status` property set to `404`, then we know that the branch
            // does not exist. Otherwise, it might be an API error that we want to report/re-throw.
            if (isGithubApiError(e) && e.status === 404) {
                return false;
            }
            throw e;
        }
    }
    /** Finds a non-reserved branch name in the repository with respect to a base name. */
    async _findAvailableBranchName(repo, baseName) {
        let currentName = baseName;
        let suffixNum = 0;
        while (await this._isBranchNameReservedInRepo(repo, currentName)) {
            suffixNum++;
            currentName = `${baseName}_${suffixNum}`;
        }
        return currentName;
    }
    /**
     * Creates a local branch from the current Git `HEAD`. Will override
     * existing branches in case of a collision.
     */
    async createLocalBranchFromHead(branchName) {
        this.git.run(['checkout', '-q', '-B', branchName]);
    }
    /** Pushes the current Git `HEAD` to the given remote branch in the configured project. */
    async pushHeadToRemoteBranch(branchName) {
        // Push the local `HEAD` to the remote branch in the configured project.
        this.git.run(['push', '-q', this.git.getRepoGitUrl(), `HEAD:refs/heads/${branchName}`]);
    }
    /**
     * Pushes the current Git `HEAD` to a fork for the configured project that is owned by
     * the authenticated user. If the specified branch name exists in the fork already, a
     * unique one will be generated based on the proposed name to avoid collisions.
     * @param proposedBranchName Proposed branch name for the fork.
     * @param trackLocalBranch Whether the fork branch should be tracked locally. i.e. whether
     *   a local branch with remote tracking should be set up.
     * @returns The fork and branch name containing the pushed changes.
     */
    async _pushHeadToFork(proposedBranchName, trackLocalBranch) {
        const fork = await this._getForkOfAuthenticatedUser();
        // Compute a repository URL for pushing to the fork. Note that we want to respect
        // the SSH option from the dev-infra github configuration.
        const repoGitUrl = getRepositoryGitUrl({ ...fork, useSsh: this.git.remoteConfig.useSsh }, this.git.githubToken);
        const branchName = await this._findAvailableBranchName(fork, proposedBranchName);
        const pushArgs = [];
        // If a local branch should track the remote fork branch, create a branch matching
        // the remote branch. Later with the `git push`, the remote is set for the branch.
        if (trackLocalBranch) {
            await this.createLocalBranchFromHead(branchName);
            pushArgs.push('--set-upstream');
        }
        // Push the local `HEAD` to the remote branch in the fork.
        this.git.run(['push', '-q', repoGitUrl, `HEAD:refs/heads/${branchName}`, ...pushArgs]);
        return { fork, branchName };
    }
    /**
     * Pushes changes to a fork for the configured project that is owned by the currently
     * authenticated user. A pull request is then created for the pushed changes on the
     * configured project that targets the specified target branch.
     * @returns An object describing the created pull request.
     */
    async pushChangesToForkAndCreatePullRequest(targetBranch, proposedForkBranchName, title, body) {
        const repoSlug = `${this.git.remoteParams.owner}/${this.git.remoteParams.repo}`;
        const { fork, branchName } = await this._pushHeadToFork(proposedForkBranchName, true);
        const { data } = await this.git.github.pulls.create({
            ...this.git.remoteParams,
            head: `${fork.owner}:${branchName}`,
            base: targetBranch,
            body,
            title,
        });
        // Add labels to the newly created PR if provided in the configuration.
        if (this.config.releasePrLabels !== undefined) {
            await this.git.github.issues.addLabels({
                ...this.git.remoteParams,
                issue_number: data.number,
                labels: this.config.releasePrLabels,
            });
        }
        Log.info(green(`  ✓   Created pull request #${data.number} in ${repoSlug}.`));
        return {
            id: data.number,
            url: data.html_url,
            fork,
            forkBranch: branchName,
        };
    }
    /**
     * Prepend releases notes for a version published in a given branch to the changelog in
     * the current Git `HEAD`. This is useful for cherry-picking the changelog.
     * @returns A boolean indicating whether the release notes have been prepended.
     */
    async prependReleaseNotesToChangelog(releaseNotes) {
        await releaseNotes.prependEntryToChangelogFile();
        Log.info(green(`  ✓   Updated the changelog to capture changes for "${releaseNotes.version}".`));
    }
    /** Checks out an upstream branch with a detached head. */
    async checkoutUpstreamBranch(branchName) {
        this.git.run(['fetch', '-q', this.git.getRepoGitUrl(), branchName]);
        this.git.run(['checkout', '-q', 'FETCH_HEAD', '--detach']);
    }
    /** Installs all Yarn dependencies in the current branch. */
    async installDependenciesForCurrentBranch() {
        if (await this.pnpmVersioning.isUsingPnpm(this.projectDir)) {
            await ExternalCommands.invokePnpmInstall(this.projectDir, this.pnpmVersioning);
            return;
        }
        const nodeModulesDir = join(this.projectDir, 'node_modules');
        // Note: We delete all contents of the `node_modules` first. This is necessary
        // because Yarn could preserve extraneous/outdated nested modules that will cause
        // unexpected build failures with the NodeJS Bazel `@npm` workspace generation.
        // This is a workaround for: https://github.com/yarnpkg/yarn/issues/8146. Even though
        // we might be able to fix this with Yarn 2+, it is reasonable ensuring clean node modules.
        // TODO: Remove this when we use Yarn 2+ in all Angular repositories.
        await fs.rm(nodeModulesDir, { force: true, recursive: true, maxRetries: 3 });
        await ExternalCommands.invokeYarnInstall(this.projectDir);
    }
    /**
     * Creates a commit for the specified files with the given message.
     * @param message Message for the created commit
     * @param files List of project-relative file paths to be committed.
     */
    async createCommit(message, files) {
        // Note: `git add` would not be needed if the files are already known to
        // Git, but the specified files could also be newly created, and unknown.
        this.git.run(['add', ...files]);
        // Note: `--no-verify` skips the majority of commit hooks here, but there are hooks
        // like `prepare-commit-message` which still run. We have set the `HUSKY=0` environment
        // variable at the start of the publish command to ignore such hooks as well.
        this.git.run(['commit', '-q', '--no-verify', '-m', message, ...files]);
    }
    /**
     * Builds the release output for the current branch. Assumes the node modules
     * to be already installed for the current branch.
     *
     * @returns A list of built release packages.
     */
    async buildReleaseForCurrentBranch() {
        // Note that we do not directly call the build packages function from the release
        // config. We only want to build and publish packages that have been configured in the given
        // publish branch. e.g. consider we publish patch version and a new package has been
        // created in the `next` branch. The new package would not be part of the patch branch,
        // so we cannot build and publish it.
        const builtPackages = await ExternalCommands.invokeReleaseBuild(this.projectDir, this.pnpmVersioning);
        const releaseInfo = await ExternalCommands.invokeReleaseInfo(this.projectDir, this.pnpmVersioning);
        // Extend the built packages with their disk hash and NPM package information. This is
        // helpful later for verifying integrity and filtering out e.g. experimental packages.
        return analyzeAndExtendBuiltPackagesWithInfo(builtPackages, releaseInfo.npmPackages);
    }
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
    async stageVersionForBranchAndCreatePullRequest(newVersion, compareVersionForReleaseNotes, pullRequestTargetBranch, opts) {
        const releaseNotesCompareTag = getReleaseTagForVersion(compareVersionForReleaseNotes);
        // Fetch the compare tag so that commits for the release notes can be determined.
        // We forcibly override existing local tags that are named similar as we will fetch
        // the correct tag for release notes comparison from the upstream remote.
        this.git.run([
            'fetch',
            '--force',
            this.git.getRepoGitUrl(),
            `refs/tags/${releaseNotesCompareTag}:refs/tags/${releaseNotesCompareTag}`,
        ]);
        // Build release notes for commits from `<releaseNotesCompareTag>..HEAD`.
        const releaseNotes = await ReleaseNotes.forRange(this.git, newVersion, releaseNotesCompareTag, 'HEAD');
        await this.updateProjectVersion(newVersion, opts?.updatePkgJsonFn);
        await this.prependReleaseNotesToChangelog(releaseNotes);
        await this.waitForEditsAndCreateReleaseCommit(newVersion);
        // Install the project dependencies for the publish branch.
        await this.installDependenciesForCurrentBranch();
        const builtPackagesWithInfo = await this.buildReleaseForCurrentBranch();
        // Run release pre-checks (e.g. validating the release output).
        await ExternalCommands.invokeReleasePrecheck(this.projectDir, newVersion, builtPackagesWithInfo, this.pnpmVersioning);
        // Verify the packages built are the correct version.
        await this._verifyPackageVersions(releaseNotes.version, builtPackagesWithInfo);
        const pullRequest = await this.pushChangesToForkAndCreatePullRequest(pullRequestTargetBranch, `release-stage-${newVersion}`, `Bump version to "v${newVersion}" with changelog.`);
        Log.info(green('  ✓   Release staging pull request has been created.'));
        return { releaseNotes, pullRequest, builtPackagesWithInfo };
    }
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
    async checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, stagingBranch, stagingOpts) {
        // Keep track of the commit where we started the staging process on. This will be used
        // later to ensure that no changes, except for the version bump have landed as part
        // of the staging time window (where the caretaker could accidentally land other stuff).
        const { sha: beforeStagingSha } = await this.getLatestCommitOfBranch(stagingBranch);
        await this.assertPassingGithubStatus(beforeStagingSha, stagingBranch);
        await this.checkoutUpstreamBranch(stagingBranch);
        const stagingInfo = await this.stageVersionForBranchAndCreatePullRequest(newVersion, compareVersionForReleaseNotes, stagingBranch, stagingOpts);
        return {
            ...stagingInfo,
            beforeStagingSha,
        };
    }
    /**
     * Cherry-picks the release notes of a version that have been pushed to a given branch
     * into the `next` primary development branch. A pull request is created for this.
     * @returns a boolean indicating successful creation of the cherry-pick pull request.
     */
    async cherryPickChangelogIntoNextBranch(releaseNotes, stagingBranch) {
        const nextBranch = this.active.next.branchName;
        const commitMessage = getReleaseNoteCherryPickCommitMessage(releaseNotes.version);
        // Checkout the next branch.
        await this.checkoutUpstreamBranch(nextBranch);
        await this.prependReleaseNotesToChangelog(releaseNotes);
        const filesToCommit = [workspaceRelativeChangelogPath];
        if (releaseNotes.version.patch === 0 && !releaseNotes.version.prerelease) {
            // Switch the renovate labels for `target: rc` to `target: patch`
            const renovateConfigPath = await updateRenovateConfigTargetLabels(this.projectDir, targetLabels['TARGET_RC'].name, targetLabels['TARGET_PATCH'].name);
            if (renovateConfigPath) {
                filesToCommit.push(renovateConfigPath);
            }
        }
        await this.createCommit(commitMessage, filesToCommit);
        Log.info(green(`  ✓   Created changelog cherry-pick commit for: "${releaseNotes.version}".`));
        // Create a cherry-pick pull request that should be merged by the caretaker.
        const pullRequest = await this.pushChangesToForkAndCreatePullRequest(nextBranch, `changelog-cherry-pick-${releaseNotes.version}`, commitMessage, `Cherry-picks the changelog from the "${stagingBranch}" branch to the next ` +
            `branch (${nextBranch}).`);
        Log.info(green(`  ✓   Pull request for cherry-picking the changelog into "${nextBranch}" ` +
            'has been created.'));
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        return true;
    }
    /** Prompts the user for merging the pull request, and waits for it to be merged. */
    async promptAndWaitForPullRequestMerged(pullRequest) {
        await promptToInitiatePullRequestMerge(this.git, pullRequest);
    }
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
    async _createGithubReleaseForVersion(releaseNotes, versionBumpCommitSha, isPrerelease, showAsLatestOnGitHub) {
        const tagName = getReleaseTagForVersion(releaseNotes.version);
        await this.git.github.git.createRef({
            ...this.git.remoteParams,
            ref: `refs/tags/${tagName}`,
            sha: versionBumpCommitSha,
        });
        Log.info(green(`  ✓   Tagged v${releaseNotes.version} release upstream.`));
        let releaseBody = await releaseNotes.getGithubReleaseEntry();
        // If the release body exceeds the Github body limit, we just provide
        // a link to the changelog entry in the Github release entry.
        if (releaseBody.length > githubReleaseBodyLimit) {
            const releaseNotesUrl = await this._getGithubChangelogUrlForRef(releaseNotes, tagName);
            releaseBody =
                `Release notes are too large to be captured here. ` +
                    `[View all changes here](${releaseNotesUrl}).`;
        }
        await this.git.github.repos.createRelease({
            ...this.git.remoteParams,
            name: releaseNotes.version.toString(),
            tag_name: tagName,
            prerelease: isPrerelease,
            make_latest: showAsLatestOnGitHub ? 'true' : 'false',
            body: releaseBody,
        });
        Log.info(green(`  ✓   Created v${releaseNotes.version} release in Github.`));
    }
    /** Gets a Github URL that resolves to the release notes in the given ref. */
    async _getGithubChangelogUrlForRef(releaseNotes, ref) {
        const baseUrl = getFileContentsUrl(this.git, ref, workspaceRelativeChangelogPath);
        const urlFragment = await releaseNotes.getUrlFragmentForRelease();
        return `${baseUrl}#${urlFragment}`;
    }
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
    async publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, publishBranch, npmDistTag, additionalOptions) {
        const releaseSha = await this._getAndValidateLatestCommitForPublishing(publishBranch, releaseNotes.version, beforeStagingSha);
        // Before publishing, we want to ensure that the locally-built packages we
        // built in the staging phase have not been modified accidentally.
        await assertIntegrityOfBuiltPackages(builtPackagesWithInfo);
        // Create a Github release for the new version.
        await this._createGithubReleaseForVersion(releaseNotes, releaseSha, npmDistTag === 'next', additionalOptions.showAsLatestOnGitHub);
        // Walk through all built packages and publish them to NPM.
        for (const pkg of builtPackagesWithInfo) {
            await this._publishBuiltPackageToNpm(pkg, npmDistTag);
        }
        Log.info(green('  ✓   Published all packages successfully'));
    }
    /** Publishes the given built package to NPM with the specified NPM dist tag. */
    async _publishBuiltPackageToNpm(pkg, npmDistTag) {
        Log.debug(`Starting publish of "${pkg.name}".`);
        const spinner = new Spinner(`Publishing "${pkg.name}"`);
        try {
            await NpmCommand.publish(pkg.outputPath, npmDistTag, this.config.publishRegistry);
            spinner.complete();
            Log.info(green(`  ✓   Successfully published "${pkg.name}.`));
        }
        catch (e) {
            spinner.complete();
            Log.error(e);
            Log.error(`  ✘   An error occurred while publishing "${pkg.name}".`);
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Retreive the latest commit from the provided branch, and verify that it is the expected
     * release commit and is the direct child of the previous sha provided.
     *
     * The method will make one recursive attempt to check again before throwing an error if
     * any error occurs during this validation. This exists as an attempt to handle transient
     * timeouts from Github along with cases, where the Github API response does not keep up
     * with the timing from when we perform a merge to when we verify that the merged commit is
     * present in the upstream branch.
     */
    async _getAndValidateLatestCommitForPublishing(branch, version, previousSha) {
        let latestSha = null;
        // Support re-checking as many times as needed. Often times the GitHub API
        // is not up-to-date and we don't want to exit the release script then.
        while (latestSha === null) {
            const commit = await this.getLatestCommitOfBranch(branch);
            // Ensure the latest commit in the publish branch is the bump commit.
            if (!commit.commit.message.startsWith(getCommitMessageForRelease(version))) {
                /** The shortened sha of the commit for usage in the error message. */
                const sha = commit.sha.slice(0, 8);
                Log.error(`  ✘   Latest commit (${sha}) in "${branch}" branch is not a staging commit.`);
                Log.error('      Please make sure the staging pull request has been merged.');
                if (await Prompt.confirm({ message: `Do you want to re-try?`, default: true })) {
                    continue;
                }
                throw new FatalReleaseActionError();
            }
            // We only inspect the first parent as we enforce that no merge commits are used in our
            // repos, so all commits have exactly one parent.
            if (commit.parents[0].sha !== previousSha) {
                Log.error(`  ✘   Unexpected additional commits have landed while staging the release.`);
                Log.error('      Please revert the bump commit and retry, or cut a new version on top.');
                if (await Prompt.confirm({ message: `Do you want to re-try?`, default: true })) {
                    continue;
                }
                throw new FatalReleaseActionError();
            }
            latestSha = commit.sha;
        }
        return latestSha;
    }
    // TODO: Remove this check and run it as part of common release validation.
    /** Verify the version of each generated package exact matches the specified version. */
    async _verifyPackageVersions(version, packages) {
        // Experimental equivalent version for packages.
        const experimentalVersion = createExperimentalSemver(version);
        for (const pkg of packages) {
            const { version: packageJsonVersion } = JSON.parse(await fs.readFile(join(pkg.outputPath, 'package.json'), 'utf8'));
            const expectedVersion = pkg.experimental ? experimentalVersion : version;
            const mismatchesVersion = expectedVersion.compare(packageJsonVersion) !== 0;
            if (mismatchesVersion) {
                Log.error(`The built package version does not match for: ${pkg.name}.`);
                Log.error(`  Actual version:   ${packageJsonVersion}`);
                Log.error(`  Expected version: ${expectedVersion}`);
                throw new FatalReleaseActionError();
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsUUFBUSxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDOUMsT0FBTyxJQUFJLEVBQUUsRUFBQyxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFHaEMsT0FBTyxFQUFDLGdDQUFnQyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFMUUsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxZQUFZLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUNMLGtCQUFrQixFQUNsQix5QkFBeUIsRUFDekIsbUJBQW1CLEdBQ3BCLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEMsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFL0MsT0FBTyxFQUFDLFlBQVksRUFBRSw4QkFBOEIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBR3ZGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RSxPQUFPLEVBQUMsdUJBQXVCLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMxRixPQUFPLEVBQ0wscUNBQXFDLEVBQ3JDLDhCQUE4QixHQUMvQixNQUFNLHlCQUF5QixDQUFDO0FBQ2pDLE9BQU8sRUFDTCwwQkFBMEIsRUFDMUIscUNBQXFDLEdBQ3RD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USxFQUFFLENBQUM7WUFDM0IsTUFBTSxFQUFDLE9BQU8sRUFBRSxrQkFBa0IsRUFBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQzlDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FDdkIsQ0FBQztZQUUzQyxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3pFLE1BQU0saUJBQWlCLEdBQUcsZUFBZSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUU1RSxJQUFJLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3RCLEdBQUcsQ0FBQyxLQUFLLENBQUMsaURBQWlELEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO2dCQUN4RSxHQUFHLENBQUMsS0FBSyxDQUFDLHVCQUF1QixrQkFBa0IsRUFBRSxDQUFDLENBQUM7Z0JBQ3ZELEdBQUcsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLGVBQWUsRUFBRSxDQUFDLENBQUM7Z0JBQ3BELE1BQU0sSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1lBQ3RDLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7cHJvbWlzZXMgYXMgZnMsIGV4aXN0c1N5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoLCB7am9pbn0gZnJvbSAncGF0aCc7XG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5cbmltcG9ydCB7d29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGh9IGZyb20gJy4uLy4uL3V0aWxzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtpc0dpdGh1YkFwaUVycm9yfSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLmpzJztcbmltcG9ydCBnaXRodWJNYWNyb3MgZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi1tYWNyb3MuanMnO1xuaW1wb3J0IHtcbiAgZ2V0RmlsZUNvbnRlbnRzVXJsLFxuICBnZXRMaXN0Q29tbWl0c0luQnJhbmNoVXJsLFxuICBnZXRSZXBvc2l0b3J5R2l0VXJsLFxufSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLXVybHMuanMnO1xuaW1wb3J0IHtncmVlbiwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge0J1aWx0UGFja2FnZSwgQnVpbHRQYWNrYWdlV2l0aEluZm8sIFJlbGVhc2VDb25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge1JlbGVhc2VOb3Rlcywgd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRofSBmcm9tICcuLi9ub3Rlcy9yZWxlYXNlLW5vdGVzLmpzJztcbmltcG9ydCB7TnBtRGlzdFRhZywgUGFja2FnZUpzb259IGZyb20gJy4uL3ZlcnNpb25pbmcvaW5kZXguanMnO1xuaW1wb3J0IHtBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi92ZXJzaW9uaW5nL2FjdGl2ZS1yZWxlYXNlLXRyYWlucy5qcyc7XG5pbXBvcnQge2NyZWF0ZUV4cGVyaW1lbnRhbFNlbXZlcn0gZnJvbSAnLi4vdmVyc2lvbmluZy9leHBlcmltZW50YWwtdmVyc2lvbnMuanMnO1xuaW1wb3J0IHtOcG1Db21tYW5kfSBmcm9tICcuLi92ZXJzaW9uaW5nL25wbS1jb21tYW5kLmpzJztcbmltcG9ydCB7Z2V0UmVsZWFzZVRhZ0ZvclZlcnNpb259IGZyb20gJy4uL3ZlcnNpb25pbmcvdmVyc2lvbi10YWdzLmpzJztcbmltcG9ydCB7RmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IsIFVzZXJBYm9ydGVkUmVsZWFzZUFjdGlvbkVycm9yfSBmcm9tICcuL2FjdGlvbnMtZXJyb3IuanMnO1xuaW1wb3J0IHtcbiAgYW5hbHl6ZUFuZEV4dGVuZEJ1aWx0UGFja2FnZXNXaXRoSW5mbyxcbiAgYXNzZXJ0SW50ZWdyaXR5T2ZCdWlsdFBhY2thZ2VzLFxufSBmcm9tICcuL2J1aWx0LXBhY2thZ2UtaW5mby5qcyc7XG5pbXBvcnQge1xuICBnZXRDb21taXRNZXNzYWdlRm9yUmVsZWFzZSxcbiAgZ2V0UmVsZWFzZU5vdGVDaGVycnlQaWNrQ29tbWl0TWVzc2FnZSxcbn0gZnJvbSAnLi9jb21taXQtbWVzc2FnZS5qcyc7XG5pbXBvcnQge2dpdGh1YlJlbGVhc2VCb2R5TGltaXR9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7RXh0ZXJuYWxDb21tYW5kc30gZnJvbSAnLi9leHRlcm5hbC1jb21tYW5kcy5qcyc7XG5pbXBvcnQge3Byb21wdFRvSW5pdGlhdGVQdWxsUmVxdWVzdE1lcmdlfSBmcm9tICcuL3Byb21wdC1tZXJnZS5qcyc7XG5pbXBvcnQge1Byb21wdH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbXB0LmpzJztcbmltcG9ydCB7Z2xvYn0gZnJvbSAnZmFzdC1nbG9iJztcbmltcG9ydCB7UG5wbVZlcnNpb25pbmd9IGZyb20gJy4vcG5wbS12ZXJzaW9uaW5nLmpzJztcbmltcG9ydCB7Q29tbWl0fSBmcm9tICcuLi8uLi91dGlscy9naXQvb2N0b2tpdC10eXBlcy5qcyc7XG5pbXBvcnQge3VwZGF0ZVJlbm92YXRlQ29uZmlnVGFyZ2V0TGFiZWxzfSBmcm9tICcuL2FjdGlvbnMvcmVub3ZhdGUtY29uZmlnLXVwZGF0ZXMuanMnO1xuaW1wb3J0IHt0YXJnZXRMYWJlbHN9IGZyb20gJy4uLy4uL3ByL2NvbW1vbi9sYWJlbHMvdGFyZ2V0LmpzJztcblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIGEgR2l0aHViIHJlcG9zaXRvcnkuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YlJlcG8ge1xuICBvd25lcjogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyBhIEdpdGh1YiBwdWxsIHJlcXVlc3QuICovXG5leHBvcnQgaW50ZXJmYWNlIFB1bGxSZXF1ZXN0IHtcbiAgLyoqIFVuaXF1ZSBpZCBmb3IgdGhlIHB1bGwgcmVxdWVzdCAoaS5lLiB0aGUgUFIgbnVtYmVyKS4gKi9cbiAgaWQ6IG51bWJlcjtcbiAgLyoqIFVSTCB0aGF0IHJlc29sdmVzIHRvIHRoZSBwdWxsIHJlcXVlc3QgaW4gR2l0aHViLiAqL1xuICB1cmw6IHN0cmluZztcbiAgLyoqIEZvcmsgY29udGFpbmluZyB0aGUgaGVhZCBicmFuY2ggb2YgdGhpcyBwdWxsIHJlcXVlc3QuICovXG4gIGZvcms6IEdpdGh1YlJlcG87XG4gIC8qKiBCcmFuY2ggbmFtZSBpbiB0aGUgZm9yayB0aGF0IGRlZmluZXMgdGhpcyBwdWxsIHJlcXVlc3QuICovXG4gIGZvcmtCcmFuY2g6IHN0cmluZztcbn1cblxuLyoqIE9wdGlvbnMgdGhhdCBjYW4gYmUgdXNlZCB0byBjb250cm9sIHRoZSBzdGFnaW5nIG9mIGEgbmV3IHZlcnNpb24uICovXG5leHBvcnQgaW50ZXJmYWNlIFN0YWdpbmdPcHRpb25zIHtcbiAgLyoqXG4gICAqIEFzIHBhcnQgb2Ygc3RhZ2luZywgdGhlIGBwYWNrYWdlLmpzb25gIGNhbiBiZSB1cGRhdGVkIGJlZm9yZSB0aGVcbiAgICogbmV3IHZlcnNpb24gaXMgc2V0LlxuICAgKiBAc2VlIHtSZWxlYXNlQWN0aW9uLnVwZGF0ZVByb2plY3RWZXJzaW9ufVxuICAgKi9cbiAgdXBkYXRlUGtnSnNvbkZuPzogKHBrZ0pzb246IFBhY2thZ2VKc29uKSA9PiB2b2lkO1xufVxuXG4vKiogQ29uc3RydWN0b3IgdHlwZSBmb3IgaW5zdGFudGlhdGluZyBhIHJlbGVhc2UgYWN0aW9uICovXG5leHBvcnQgaW50ZXJmYWNlIFJlbGVhc2VBY3Rpb25Db25zdHJ1Y3RvcjxUIGV4dGVuZHMgUmVsZWFzZUFjdGlvbiA9IFJlbGVhc2VBY3Rpb24+IHtcbiAgLyoqIFdoZXRoZXIgdGhlIHJlbGVhc2UgYWN0aW9uIGlzIGN1cnJlbnRseSBhY3RpdmUuICovXG4gIGlzQWN0aXZlKGFjdGl2ZTogQWN0aXZlUmVsZWFzZVRyYWlucywgY29uZmlnOiBSZWxlYXNlQ29uZmlnKTogUHJvbWlzZTxib29sZWFuPjtcbiAgLyoqIENvbnN0cnVjdHMgYSByZWxlYXNlIGFjdGlvbi4gKi9cbiAgbmV3ICguLi5hcmdzOiBbQWN0aXZlUmVsZWFzZVRyYWlucywgQXV0aGVudGljYXRlZEdpdENsaWVudCwgUmVsZWFzZUNvbmZpZywgc3RyaW5nXSk6IFQ7XG59XG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgYSByZWxlYXNlIGFjdGlvbi4gQSByZWxlYXNlIGFjdGlvbiBpcyBzZWxlY3RhYmxlIGJ5IHRoZSBjYXJldGFrZXJcbiAqIGlmIGFjdGl2ZSwgYW5kIGNhbiBwZXJmb3JtIGNoYW5nZXMgZm9yIHJlbGVhc2luZywgc3VjaCBhcyBzdGFnaW5nIGEgcmVsZWFzZSwgYnVtcGluZyB0aGVcbiAqIHZlcnNpb24sIGNoZXJyeS1waWNraW5nIHRoZSBjaGFuZ2Vsb2csIGJyYW5jaGluZyBvZmYgZnJvbSB0aGUgbWFpbiBicmFuY2guIGV0Yy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFJlbGVhc2VBY3Rpb24ge1xuICAvKiogV2hldGhlciB0aGUgcmVsZWFzZSBhY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZS4gKi9cbiAgc3RhdGljIGlzQWN0aXZlKF90cmFpbnM6IEFjdGl2ZVJlbGVhc2VUcmFpbnMsIF9jb25maWc6IFJlbGVhc2VDb25maWcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0aHJvdyBFcnJvcignTm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIGRlc2NyaXB0aW9uIGZvciBhIHJlbGVhc2UgYWN0aW9uLiAqL1xuICBhYnN0cmFjdCBnZXREZXNjcmlwdGlvbigpOiBQcm9taXNlPHN0cmluZz47XG4gIC8qKlxuICAgKiBQZXJmb3JtcyB0aGUgZ2l2ZW4gcmVsZWFzZSBhY3Rpb24uXG4gICAqIEB0aHJvd3Mge1VzZXJBYm9ydGVkUmVsZWFzZUFjdGlvbkVycm9yfSBXaGVuIHRoZSB1c2VyIG1hbnVhbGx5IGFib3J0ZWQgdGhlIGFjdGlvbi5cbiAgICogQHRocm93cyB7RmF0YWxSZWxlYXNlQWN0aW9uRXJyb3J9IFdoZW4gdGhlIGFjdGlvbiBoYXMgYmVlbiBhYm9ydGVkIGR1ZSB0byBhIGZhdGFsIGVycm9yLlxuICAgKi9cbiAgYWJzdHJhY3QgcGVyZm9ybSgpOiBQcm9taXNlPHZvaWQ+O1xuXG4gIHByb3RlY3RlZCBwbnBtVmVyc2lvbmluZyA9IG5ldyBQbnBtVmVyc2lvbmluZygpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMsXG4gICAgcHJvdGVjdGVkIGdpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCxcbiAgICBwcm90ZWN0ZWQgY29uZmlnOiBSZWxlYXNlQ29uZmlnLFxuICAgIHByb3RlY3RlZCBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICkge31cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgdmVyc2lvbiBpbiB0aGUgcHJvamVjdCB0b3AtbGV2ZWwgYHBhY2thZ2UuanNvbmAgZmlsZS5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IFNlbVZlciB2ZXJzaW9uIHRvIGJlIHNldCBpbiB0aGUgZmlsZS5cbiAgICogQHBhcmFtIGFkZGl0aW9uYWxVcGRhdGVGbiBPcHRpb25hbCB1cGRhdGUgZnVuY3Rpb24gdGhhdCBydW5zIGJlZm9yZVxuICAgKiAgIHRoZSB2ZXJzaW9uIHVwZGF0ZS4gQ2FuIGJlIHVzZWQgdG8gdXBkYXRlIG90aGVyIGZpZWxkcy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyB1cGRhdGVQcm9qZWN0VmVyc2lvbihcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGFkZGl0aW9uYWxVcGRhdGVGbj86IChwa2dKc29uOiBQYWNrYWdlSnNvbikgPT4gdm9pZCxcbiAgKSB7XG4gICAgY29uc3QgcGtnSnNvblBhdGggPSBqb2luKHRoaXMucHJvamVjdERpciwgd29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGgpO1xuICAgIGNvbnN0IHBrZ0pzb24gPSBKU09OLnBhcnNlKGF3YWl0IGZzLnJlYWRGaWxlKHBrZ0pzb25QYXRoLCAndXRmOCcpKSBhcyB7XG4gICAgICB2ZXJzaW9uOiBzdHJpbmc7XG4gICAgICBba2V5OiBzdHJpbmddOiBhbnk7XG4gICAgfTtcbiAgICBpZiAoYWRkaXRpb25hbFVwZGF0ZUZuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFkZGl0aW9uYWxVcGRhdGVGbihwa2dKc29uKTtcbiAgICB9XG4gICAgcGtnSnNvbi52ZXJzaW9uID0gbmV3VmVyc2lvbi5mb3JtYXQoKTtcbiAgICAvLyBXcml0ZSB0aGUgYHBhY2thZ2UuanNvbmAgZmlsZS4gTm90ZSB0aGF0IHdlIGFkZCBhIHRyYWlsaW5nIG5ldyBsaW5lXG4gICAgLy8gdG8gYXZvaWQgdW5uZWNlc3NhcnkgZGlmZi4gSURFcyB1c3VhbGx5IGFkZCBhIHRyYWlsaW5nIG5ldyBsaW5lLlxuICAgIGF3YWl0IGZzLndyaXRlRmlsZShwa2dKc29uUGF0aCwgYCR7SlNPTi5zdHJpbmdpZnkocGtnSnNvbiwgbnVsbCwgMil9XFxuYCk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVXBkYXRlZCBwcm9qZWN0IHZlcnNpb24gdG8gJHtwa2dKc29uLnZlcnNpb259YCkpO1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLnJ1bGVzSnNJbnRlcm9wTW9kZSAmJiBleGlzdHNTeW5jKHBhdGguam9pbih0aGlzLnByb2plY3REaXIsICcuYXNwZWN0JykpKSB7XG4gICAgICBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZUJhemVsVXBkYXRlQXNwZWN0TG9ja0ZpbGVzKHRoaXMucHJvamVjdERpcik7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogR2V0IHRoZSBtb2RpZmllZCBBc3BlY3QgbG9jayBmaWxlcyBpZiBgcnVsZXNKc0ludGVyb3BNb2RlYCBpcyBlbmFibGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldEFzcGVjdExvY2tGaWxlcygpOiBzdHJpbmdbXSB7XG4gICAgLy8gVE9ETzogUmVtb3ZlIGFmdGVyIGBydWxlc19qc2AgbWlncmF0aW9uIGlzIGNvbXBsZXRlLlxuICAgIHJldHVybiB0aGlzLmNvbmZpZy5ydWxlc0pzSW50ZXJvcE1vZGVcbiAgICAgID8gZ2xvYi5zeW5jKFsnLmFzcGVjdC8qKicsICdwbnBtLWxvY2sueWFtbCddLCB7Y3dkOiB0aGlzLnByb2plY3REaXJ9KVxuICAgICAgOiBbXTtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBtb3N0IHJlY2VudCBjb21taXQgb2YgYSBzcGVjaWZpZWQgYnJhbmNoLiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgZ2V0TGF0ZXN0Q29tbWl0T2ZCcmFuY2goYnJhbmNoTmFtZTogc3RyaW5nKTogUHJvbWlzZTxDb21taXQ+IHtcbiAgICBjb25zdCB7XG4gICAgICBkYXRhOiB7Y29tbWl0fSxcbiAgICB9ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnJlcG9zLmdldEJyYW5jaCh7Li4udGhpcy5naXQucmVtb3RlUGFyYW1zLCBicmFuY2g6IGJyYW5jaE5hbWV9KTtcbiAgICByZXR1cm4gY29tbWl0O1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlIGdpdmVuIGNvbW1pdCBoYXMgcGFzc2luZyBhbGwgc3RhdHVzZXMuXG4gICAqXG4gICAqIFVwb24gZXJyb3IsIGEgbGluayB0byB0aGUgYnJhbmNoIGNvbnRhaW5pbmcgdGhlIGNvbW1pdCBpcyBwcmludGVkLFxuICAgKiBhbGxvd2luZyB0aGUgY2FyZXRha2VyIHRvIHF1aWNrbHkgaW5zcGVjdCB0aGUgR2l0SHViIGNvbW1pdCBzdGF0dXMgZmFpbHVyZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgYXNzZXJ0UGFzc2luZ0dpdGh1YlN0YXR1cyhjb21taXRTaGE6IHN0cmluZywgYnJhbmNoTmFtZUZvckVycm9yOiBzdHJpbmcpIHtcbiAgICBjb25zdCB7cmVzdWx0fSA9IGF3YWl0IGdpdGh1Yk1hY3Jvcy5nZXRDb21iaW5lZENoZWNrc0FuZFN0YXR1c2VzRm9yUmVmKHRoaXMuZ2l0LmdpdGh1Yiwge1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgcmVmOiBjb21taXRTaGEsXG4gICAgfSk7XG4gICAgY29uc3QgYnJhbmNoQ29tbWl0c1VybCA9IGdldExpc3RDb21taXRzSW5CcmFuY2hVcmwodGhpcy5naXQsIGJyYW5jaE5hbWVGb3JFcnJvcik7XG5cbiAgICBpZiAocmVzdWx0ID09PSAnZmFpbGluZycgfHwgcmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBMb2cuZXJyb3IoXG4gICAgICAgIGAgIOKcmCAgIENhbm5vdCBzdGFnZSByZWxlYXNlLiBDb21taXQgXCIke2NvbW1pdFNoYX1cIiBkb2VzIG5vdCBwYXNzIGFsbCBnaXRodWIgYCArXG4gICAgICAgICAgJ3N0YXR1cyBjaGVja3MuIFBsZWFzZSBtYWtlIHN1cmUgdGhpcyBjb21taXQgcGFzc2VzIGFsbCBjaGVja3MgYmVmb3JlIHJlLXJ1bm5pbmcuJyxcbiAgICAgICk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIFBsZWFzZSBoYXZlIGEgbG9vayBhdDogJHticmFuY2hDb21taXRzVXJsfWApO1xuXG4gICAgICBpZiAoYXdhaXQgUHJvbXB0LmNvbmZpcm0oe21lc3NhZ2U6ICdEbyB5b3Ugd2FudCB0byBpZ25vcmUgdGhlIEdpdGh1YiBzdGF0dXMgYW5kIHByb2NlZWQ/J30pKSB7XG4gICAgICAgIExvZy53YXJuKFxuICAgICAgICAgICcgIOKaoCAgIFVwc3RyZWFtIGNvbW1pdCBpcyBmYWlsaW5nIENJIGNoZWNrcywgYnV0IHN0YXR1cyBoYXMgYmVlbiBmb3JjaWJseSBpZ25vcmVkLicsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH0gZWxzZSBpZiAocmVzdWx0ID09PSAncGVuZGluZycpIHtcbiAgICAgIExvZy5lcnJvcihcbiAgICAgICAgYCAg4pyYICAgQ29tbWl0IFwiJHtjb21taXRTaGF9XCIgc3RpbGwgaGFzIHBlbmRpbmcgZ2l0aHViIHN0YXR1c2VzIHRoYXQgYCArXG4gICAgICAgICAgJ25lZWQgdG8gc3VjY2VlZCBiZWZvcmUgc3RhZ2luZyBhIHJlbGVhc2UuJyxcbiAgICAgICk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIFBsZWFzZSBoYXZlIGEgbG9vayBhdDogJHticmFuY2hDb21taXRzVXJsfWApO1xuICAgICAgaWYgKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gaWdub3JlIHRoZSBHaXRodWIgc3RhdHVzIGFuZCBwcm9jZWVkPyd9KSkge1xuICAgICAgICBMb2cud2FybignICDimqAgICBVcHN0cmVhbSBjb21taXQgaXMgcGVuZGluZyBDSSwgYnV0IHN0YXR1cyBoYXMgYmVlbiBmb3JjaWJseSBpZ25vcmVkLicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBVcHN0cmVhbSBjb21taXQgaXMgcGFzc2luZyBhbGwgZ2l0aHViIHN0YXR1cyBjaGVja3MuJykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb21wdHMgdGhlIHVzZXIgZm9yIHBvdGVudGlhbCByZWxlYXNlIG5vdGVzIGVkaXRzIHRoYXQgbmVlZCB0byBiZSBtYWRlLiBPbmNlXG4gICAqIGNvbmZpcm1lZCwgYSBuZXcgY29tbWl0IGZvciB0aGUgcmVsZWFzZSBwb2ludCBpcyBjcmVhdGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHdhaXRGb3JFZGl0c0FuZENyZWF0ZVJlbGVhc2VDb21taXQobmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcikge1xuICAgIExvZy53YXJuKFxuICAgICAgJyAg4pqgICAgUGxlYXNlIHJldmlldyB0aGUgY2hhbmdlbG9nIGFuZCBlbnN1cmUgdGhhdCB0aGUgbG9nIGNvbnRhaW5zIG9ubHkgY2hhbmdlcyAnICtcbiAgICAgICAgJ3RoYXQgYXBwbHkgdG8gdGhlIHB1YmxpYyBBUEkgc3VyZmFjZS4nLFxuICAgICk7XG4gICAgTG9nLndhcm4oJyAgICAgIE1hbnVhbCBjaGFuZ2VzIGNhbiBiZSBtYWRlLiBXaGVuIGRvbmUsIHBsZWFzZSBwcm9jZWVkIHdpdGggdGhlIHByb21wdCBiZWxvdy4nKTtcblxuICAgIGlmICghKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gcHJvY2VlZCBhbmQgY29tbWl0IHRoZSBjaGFuZ2VzPyd9KSkpIHtcbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cblxuICAgIC8vIENvbW1pdCBtZXNzYWdlIGZvciB0aGUgcmVsZWFzZSBwb2ludC5cbiAgICBjb25zdCBmaWxlc1RvQ29tbWl0ID0gW1xuICAgICAgd29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGgsXG4gICAgICB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGgsXG4gICAgICAuLi50aGlzLmdldEFzcGVjdExvY2tGaWxlcygpLFxuICAgIF07XG5cbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gZ2V0Q29tbWl0TWVzc2FnZUZvclJlbGVhc2UobmV3VmVyc2lvbik7XG5cbiAgICAvLyBDcmVhdGUgYSByZWxlYXNlIHN0YWdpbmcgY29tbWl0IGluY2x1ZGluZyBjaGFuZ2Vsb2cgYW5kIHZlcnNpb24gYnVtcC5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbW1pdChjb21taXRNZXNzYWdlLCBmaWxlc1RvQ29tbWl0KTtcblxuICAgIC8vIFRoZSBjYXJldGFrZXIgbWF5IGhhdmUgYXR0ZW1wdGVkIHRvIG1ha2UgYWRkaXRpb25hbCBjaGFuZ2VzLiBUaGVzZSBjaGFuZ2VzIHdvdWxkXG4gICAgLy8gbm90IGJlIGNhcHR1cmVkIGludG8gdGhlIHJlbGVhc2UgY29tbWl0LiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgc2hvdWxkIHJlbWFpbiBjbGVhbixcbiAgICAvLyBsaWtlIHdlIGFzc3VtZSBpdCBiZWluZyBjbGVhbiB3aGVuIHdlIHN0YXJ0IHRoZSByZWxlYXNlIGFjdGlvbnMuXG4gICAgaWYgKHRoaXMuZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVW5yZWxhdGVkIGNoYW5nZXMgaGF2ZSBiZWVuIG1hZGUgYXMgcGFydCBvZiB0aGUgY2hhbmdlbG9nIGVkaXRpbmcuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBDcmVhdGVkIHJlbGVhc2UgY29tbWl0IGZvcjogXCIke25ld1ZlcnNpb259XCIuYCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYW4gb3duZWQgZm9yayBmb3IgdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCBvZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyLiBBYm9ydHMgdGhlXG4gICAqIHByb2Nlc3Mgd2l0aCBhbiBlcnJvciBpZiBubyBmb3JrIGNvdWxkIGJlIGZvdW5kLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfZ2V0Rm9ya09mQXV0aGVudGljYXRlZFVzZXIoKTogUHJvbWlzZTxHaXRodWJSZXBvPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLmdpdC5nZXRGb3JrT2ZBdXRoZW50aWNhdGVkVXNlcigpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3Qge293bmVyLCBuYW1lfSA9IHRoaXMuZ2l0LnJlbW90ZUNvbmZpZztcbiAgICAgIExvZy5lcnJvcignICDinJggICBVbmFibGUgdG8gZmluZCBmb3JrIGZvciBjdXJyZW50bHkgYXV0aGVudGljYXRlZCB1c2VyLicpO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgZW5zdXJlIHlvdSBjcmVhdGVkIGEgZm9yayBvZjogJHtvd25lcn0vJHtuYW1lfS5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBDaGVja3Mgd2hldGhlciBhIGdpdmVuIGJyYW5jaCBuYW1lIGlzIHJlc2VydmVkIGluIHRoZSBzcGVjaWZpZWQgcmVwb3NpdG9yeS4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfaXNCcmFuY2hOYW1lUmVzZXJ2ZWRJblJlcG8ocmVwbzogR2l0aHViUmVwbywgbmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5yZXBvcy5nZXRCcmFuY2goe293bmVyOiByZXBvLm93bmVyLCByZXBvOiByZXBvLm5hbWUsIGJyYW5jaDogbmFtZX0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gSWYgdGhlIGVycm9yIGhhcyBhIGBzdGF0dXNgIHByb3BlcnR5IHNldCB0byBgNDA0YCwgdGhlbiB3ZSBrbm93IHRoYXQgdGhlIGJyYW5jaFxuICAgICAgLy8gZG9lcyBub3QgZXhpc3QuIE90aGVyd2lzZSwgaXQgbWlnaHQgYmUgYW4gQVBJIGVycm9yIHRoYXQgd2Ugd2FudCB0byByZXBvcnQvcmUtdGhyb3cuXG4gICAgICBpZiAoaXNHaXRodWJBcGlFcnJvcihlKSAmJiBlLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgLyoqIEZpbmRzIGEgbm9uLXJlc2VydmVkIGJyYW5jaCBuYW1lIGluIHRoZSByZXBvc2l0b3J5IHdpdGggcmVzcGVjdCB0byBhIGJhc2UgbmFtZS4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfZmluZEF2YWlsYWJsZUJyYW5jaE5hbWUocmVwbzogR2l0aHViUmVwbywgYmFzZU5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgbGV0IGN1cnJlbnROYW1lID0gYmFzZU5hbWU7XG4gICAgbGV0IHN1ZmZpeE51bSA9IDA7XG4gICAgd2hpbGUgKGF3YWl0IHRoaXMuX2lzQnJhbmNoTmFtZVJlc2VydmVkSW5SZXBvKHJlcG8sIGN1cnJlbnROYW1lKSkge1xuICAgICAgc3VmZml4TnVtKys7XG4gICAgICBjdXJyZW50TmFtZSA9IGAke2Jhc2VOYW1lfV8ke3N1ZmZpeE51bX1gO1xuICAgIH1cbiAgICByZXR1cm4gY3VycmVudE5hbWU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGxvY2FsIGJyYW5jaCBmcm9tIHRoZSBjdXJyZW50IEdpdCBgSEVBRGAuIFdpbGwgb3ZlcnJpZGVcbiAgICogZXhpc3RpbmcgYnJhbmNoZXMgaW4gY2FzZSBvZiBhIGNvbGxpc2lvbi5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBjcmVhdGVMb2NhbEJyYW5jaEZyb21IZWFkKGJyYW5jaE5hbWU6IHN0cmluZykge1xuICAgIHRoaXMuZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgJy1CJywgYnJhbmNoTmFtZV0pO1xuICB9XG5cbiAgLyoqIFB1c2hlcyB0aGUgY3VycmVudCBHaXQgYEhFQURgIHRvIHRoZSBnaXZlbiByZW1vdGUgYnJhbmNoIGluIHRoZSBjb25maWd1cmVkIHByb2plY3QuICovXG4gIHByb3RlY3RlZCBhc3luYyBwdXNoSGVhZFRvUmVtb3RlQnJhbmNoKGJyYW5jaE5hbWU6IHN0cmluZykge1xuICAgIC8vIFB1c2ggdGhlIGxvY2FsIGBIRUFEYCB0byB0aGUgcmVtb3RlIGJyYW5jaCBpbiB0aGUgY29uZmlndXJlZCBwcm9qZWN0LlxuICAgIHRoaXMuZ2l0LnJ1bihbJ3B1c2gnLCAnLXEnLCB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksIGBIRUFEOnJlZnMvaGVhZHMvJHticmFuY2hOYW1lfWBdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdXNoZXMgdGhlIGN1cnJlbnQgR2l0IGBIRUFEYCB0byBhIGZvcmsgZm9yIHRoZSBjb25maWd1cmVkIHByb2plY3QgdGhhdCBpcyBvd25lZCBieVxuICAgKiB0aGUgYXV0aGVudGljYXRlZCB1c2VyLiBJZiB0aGUgc3BlY2lmaWVkIGJyYW5jaCBuYW1lIGV4aXN0cyBpbiB0aGUgZm9yayBhbHJlYWR5LCBhXG4gICAqIHVuaXF1ZSBvbmUgd2lsbCBiZSBnZW5lcmF0ZWQgYmFzZWQgb24gdGhlIHByb3Bvc2VkIG5hbWUgdG8gYXZvaWQgY29sbGlzaW9ucy5cbiAgICogQHBhcmFtIHByb3Bvc2VkQnJhbmNoTmFtZSBQcm9wb3NlZCBicmFuY2ggbmFtZSBmb3IgdGhlIGZvcmsuXG4gICAqIEBwYXJhbSB0cmFja0xvY2FsQnJhbmNoIFdoZXRoZXIgdGhlIGZvcmsgYnJhbmNoIHNob3VsZCBiZSB0cmFja2VkIGxvY2FsbHkuIGkuZS4gd2hldGhlclxuICAgKiAgIGEgbG9jYWwgYnJhbmNoIHdpdGggcmVtb3RlIHRyYWNraW5nIHNob3VsZCBiZSBzZXQgdXAuXG4gICAqIEByZXR1cm5zIFRoZSBmb3JrIGFuZCBicmFuY2ggbmFtZSBjb250YWluaW5nIHRoZSBwdXNoZWQgY2hhbmdlcy5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX3B1c2hIZWFkVG9Gb3JrKFxuICAgIHByb3Bvc2VkQnJhbmNoTmFtZTogc3RyaW5nLFxuICAgIHRyYWNrTG9jYWxCcmFuY2g6IGJvb2xlYW4sXG4gICk6IFByb21pc2U8e2Zvcms6IEdpdGh1YlJlcG87IGJyYW5jaE5hbWU6IHN0cmluZ30+IHtcbiAgICBjb25zdCBmb3JrID0gYXdhaXQgdGhpcy5fZ2V0Rm9ya09mQXV0aGVudGljYXRlZFVzZXIoKTtcbiAgICAvLyBDb21wdXRlIGEgcmVwb3NpdG9yeSBVUkwgZm9yIHB1c2hpbmcgdG8gdGhlIGZvcmsuIE5vdGUgdGhhdCB3ZSB3YW50IHRvIHJlc3BlY3RcbiAgICAvLyB0aGUgU1NIIG9wdGlvbiBmcm9tIHRoZSBkZXYtaW5mcmEgZ2l0aHViIGNvbmZpZ3VyYXRpb24uXG4gICAgY29uc3QgcmVwb0dpdFVybCA9IGdldFJlcG9zaXRvcnlHaXRVcmwoXG4gICAgICB7Li4uZm9yaywgdXNlU3NoOiB0aGlzLmdpdC5yZW1vdGVDb25maWcudXNlU3NofSxcbiAgICAgIHRoaXMuZ2l0LmdpdGh1YlRva2VuLFxuICAgICk7XG4gICAgY29uc3QgYnJhbmNoTmFtZSA9IGF3YWl0IHRoaXMuX2ZpbmRBdmFpbGFibGVCcmFuY2hOYW1lKGZvcmssIHByb3Bvc2VkQnJhbmNoTmFtZSk7XG4gICAgY29uc3QgcHVzaEFyZ3M6IHN0cmluZ1tdID0gW107XG4gICAgLy8gSWYgYSBsb2NhbCBicmFuY2ggc2hvdWxkIHRyYWNrIHRoZSByZW1vdGUgZm9yayBicmFuY2gsIGNyZWF0ZSBhIGJyYW5jaCBtYXRjaGluZ1xuICAgIC8vIHRoZSByZW1vdGUgYnJhbmNoLiBMYXRlciB3aXRoIHRoZSBgZ2l0IHB1c2hgLCB0aGUgcmVtb3RlIGlzIHNldCBmb3IgdGhlIGJyYW5jaC5cbiAgICBpZiAodHJhY2tMb2NhbEJyYW5jaCkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVMb2NhbEJyYW5jaEZyb21IZWFkKGJyYW5jaE5hbWUpO1xuICAgICAgcHVzaEFyZ3MucHVzaCgnLS1zZXQtdXBzdHJlYW0nKTtcbiAgICB9XG4gICAgLy8gUHVzaCB0aGUgbG9jYWwgYEhFQURgIHRvIHRoZSByZW1vdGUgYnJhbmNoIGluIHRoZSBmb3JrLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ3B1c2gnLCAnLXEnLCByZXBvR2l0VXJsLCBgSEVBRDpyZWZzL2hlYWRzLyR7YnJhbmNoTmFtZX1gLCAuLi5wdXNoQXJnc10pO1xuICAgIHJldHVybiB7Zm9yaywgYnJhbmNoTmFtZX07XG4gIH1cblxuICAvKipcbiAgICogUHVzaGVzIGNoYW5nZXMgdG8gYSBmb3JrIGZvciB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgaXMgb3duZWQgYnkgdGhlIGN1cnJlbnRseVxuICAgKiBhdXRoZW50aWNhdGVkIHVzZXIuIEEgcHVsbCByZXF1ZXN0IGlzIHRoZW4gY3JlYXRlZCBmb3IgdGhlIHB1c2hlZCBjaGFuZ2VzIG9uIHRoZVxuICAgKiBjb25maWd1cmVkIHByb2plY3QgdGhhdCB0YXJnZXRzIHRoZSBzcGVjaWZpZWQgdGFyZ2V0IGJyYW5jaC5cbiAgICogQHJldHVybnMgQW4gb2JqZWN0IGRlc2NyaWJpbmcgdGhlIGNyZWF0ZWQgcHVsbCByZXF1ZXN0LlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHB1c2hDaGFuZ2VzVG9Gb3JrQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgdGFyZ2V0QnJhbmNoOiBzdHJpbmcsXG4gICAgcHJvcG9zZWRGb3JrQnJhbmNoTmFtZTogc3RyaW5nLFxuICAgIHRpdGxlOiBzdHJpbmcsXG4gICAgYm9keT86IHN0cmluZyxcbiAgKTogUHJvbWlzZTxQdWxsUmVxdWVzdD4ge1xuICAgIGNvbnN0IHJlcG9TbHVnID0gYCR7dGhpcy5naXQucmVtb3RlUGFyYW1zLm93bmVyfS8ke3RoaXMuZ2l0LnJlbW90ZVBhcmFtcy5yZXBvfWA7XG4gICAgY29uc3Qge2ZvcmssIGJyYW5jaE5hbWV9ID0gYXdhaXQgdGhpcy5fcHVzaEhlYWRUb0ZvcmsocHJvcG9zZWRGb3JrQnJhbmNoTmFtZSwgdHJ1ZSk7XG4gICAgY29uc3Qge2RhdGF9ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnB1bGxzLmNyZWF0ZSh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBoZWFkOiBgJHtmb3JrLm93bmVyfToke2JyYW5jaE5hbWV9YCxcbiAgICAgIGJhc2U6IHRhcmdldEJyYW5jaCxcbiAgICAgIGJvZHksXG4gICAgICB0aXRsZSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBsYWJlbHMgdG8gdGhlIG5ld2x5IGNyZWF0ZWQgUFIgaWYgcHJvdmlkZWQgaW4gdGhlIGNvbmZpZ3VyYXRpb24uXG4gICAgaWYgKHRoaXMuY29uZmlnLnJlbGVhc2VQckxhYmVscyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIuaXNzdWVzLmFkZExhYmVscyh7XG4gICAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgICAgaXNzdWVfbnVtYmVyOiBkYXRhLm51bWJlcixcbiAgICAgICAgbGFiZWxzOiB0aGlzLmNvbmZpZy5yZWxlYXNlUHJMYWJlbHMsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBDcmVhdGVkIHB1bGwgcmVxdWVzdCAjJHtkYXRhLm51bWJlcn0gaW4gJHtyZXBvU2x1Z30uYCkpO1xuICAgIHJldHVybiB7XG4gICAgICBpZDogZGF0YS5udW1iZXIsXG4gICAgICB1cmw6IGRhdGEuaHRtbF91cmwsXG4gICAgICBmb3JrLFxuICAgICAgZm9ya0JyYW5jaDogYnJhbmNoTmFtZSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBlbmQgcmVsZWFzZXMgbm90ZXMgZm9yIGEgdmVyc2lvbiBwdWJsaXNoZWQgaW4gYSBnaXZlbiBicmFuY2ggdG8gdGhlIGNoYW5nZWxvZyBpblxuICAgKiB0aGUgY3VycmVudCBHaXQgYEhFQURgLiBUaGlzIGlzIHVzZWZ1bCBmb3IgY2hlcnJ5LXBpY2tpbmcgdGhlIGNoYW5nZWxvZy5cbiAgICogQHJldHVybnMgQSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0aGUgcmVsZWFzZSBub3RlcyBoYXZlIGJlZW4gcHJlcGVuZGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHByZXBlbmRSZWxlYXNlTm90ZXNUb0NoYW5nZWxvZyhyZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3Rlcyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHJlbGVhc2VOb3Rlcy5wcmVwZW5kRW50cnlUb0NoYW5nZWxvZ0ZpbGUoKTtcbiAgICBMb2cuaW5mbyhcbiAgICAgIGdyZWVuKGAgIOKckyAgIFVwZGF0ZWQgdGhlIGNoYW5nZWxvZyB0byBjYXB0dXJlIGNoYW5nZXMgZm9yIFwiJHtyZWxlYXNlTm90ZXMudmVyc2lvbn1cIi5gKSxcbiAgICApO1xuICB9XG5cbiAgLyoqIENoZWNrcyBvdXQgYW4gdXBzdHJlYW0gYnJhbmNoIHdpdGggYSBkZXRhY2hlZCBoZWFkLiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY2hlY2tvdXRVcHN0cmVhbUJyYW5jaChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmdpdC5ydW4oWydmZXRjaCcsICctcScsIHRoaXMuZ2l0LmdldFJlcG9HaXRVcmwoKSwgYnJhbmNoTmFtZV0pO1xuICAgIHRoaXMuZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgJ0ZFVENIX0hFQUQnLCAnLS1kZXRhY2gnXSk7XG4gIH1cblxuICAvKiogSW5zdGFsbHMgYWxsIFlhcm4gZGVwZW5kZW5jaWVzIGluIHRoZSBjdXJyZW50IGJyYW5jaC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGluc3RhbGxEZXBlbmRlbmNpZXNGb3JDdXJyZW50QnJhbmNoKCkge1xuICAgIGlmIChhd2FpdCB0aGlzLnBucG1WZXJzaW9uaW5nLmlzVXNpbmdQbnBtKHRoaXMucHJvamVjdERpcikpIHtcbiAgICAgIGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlUG5wbUluc3RhbGwodGhpcy5wcm9qZWN0RGlyLCB0aGlzLnBucG1WZXJzaW9uaW5nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlTW9kdWxlc0RpciA9IGpvaW4odGhpcy5wcm9qZWN0RGlyLCAnbm9kZV9tb2R1bGVzJyk7XG4gICAgLy8gTm90ZTogV2UgZGVsZXRlIGFsbCBjb250ZW50cyBvZiB0aGUgYG5vZGVfbW9kdWxlc2AgZmlyc3QuIFRoaXMgaXMgbmVjZXNzYXJ5XG4gICAgLy8gYmVjYXVzZSBZYXJuIGNvdWxkIHByZXNlcnZlIGV4dHJhbmVvdXMvb3V0ZGF0ZWQgbmVzdGVkIG1vZHVsZXMgdGhhdCB3aWxsIGNhdXNlXG4gICAgLy8gdW5leHBlY3RlZCBidWlsZCBmYWlsdXJlcyB3aXRoIHRoZSBOb2RlSlMgQmF6ZWwgYEBucG1gIHdvcmtzcGFjZSBnZW5lcmF0aW9uLlxuICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvcjogaHR0cHM6Ly9naXRodWIuY29tL3lhcm5wa2cveWFybi9pc3N1ZXMvODE0Ni4gRXZlbiB0aG91Z2hcbiAgICAvLyB3ZSBtaWdodCBiZSBhYmxlIHRvIGZpeCB0aGlzIHdpdGggWWFybiAyKywgaXQgaXMgcmVhc29uYWJsZSBlbnN1cmluZyBjbGVhbiBub2RlIG1vZHVsZXMuXG4gICAgLy8gVE9ETzogUmVtb3ZlIHRoaXMgd2hlbiB3ZSB1c2UgWWFybiAyKyBpbiBhbGwgQW5ndWxhciByZXBvc2l0b3JpZXMuXG4gICAgYXdhaXQgZnMucm0obm9kZU1vZHVsZXNEaXIsIHtmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzfSk7XG4gICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VZYXJuSW5zdGFsbCh0aGlzLnByb2plY3REaXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBjb21taXQgZm9yIHRoZSBzcGVjaWZpZWQgZmlsZXMgd2l0aCB0aGUgZ2l2ZW4gbWVzc2FnZS5cbiAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSBmb3IgdGhlIGNyZWF0ZWQgY29tbWl0XG4gICAqIEBwYXJhbSBmaWxlcyBMaXN0IG9mIHByb2plY3QtcmVsYXRpdmUgZmlsZSBwYXRocyB0byBiZSBjb21taXR0ZWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY3JlYXRlQ29tbWl0KG1lc3NhZ2U6IHN0cmluZywgZmlsZXM6IHN0cmluZ1tdKSB7XG4gICAgLy8gTm90ZTogYGdpdCBhZGRgIHdvdWxkIG5vdCBiZSBuZWVkZWQgaWYgdGhlIGZpbGVzIGFyZSBhbHJlYWR5IGtub3duIHRvXG4gICAgLy8gR2l0LCBidXQgdGhlIHNwZWNpZmllZCBmaWxlcyBjb3VsZCBhbHNvIGJlIG5ld2x5IGNyZWF0ZWQsIGFuZCB1bmtub3duLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ2FkZCcsIC4uLmZpbGVzXSk7XG4gICAgLy8gTm90ZTogYC0tbm8tdmVyaWZ5YCBza2lwcyB0aGUgbWFqb3JpdHkgb2YgY29tbWl0IGhvb2tzIGhlcmUsIGJ1dCB0aGVyZSBhcmUgaG9va3NcbiAgICAvLyBsaWtlIGBwcmVwYXJlLWNvbW1pdC1tZXNzYWdlYCB3aGljaCBzdGlsbCBydW4uIFdlIGhhdmUgc2V0IHRoZSBgSFVTS1k9MGAgZW52aXJvbm1lbnRcbiAgICAvLyB2YXJpYWJsZSBhdCB0aGUgc3RhcnQgb2YgdGhlIHB1Ymxpc2ggY29tbWFuZCB0byBpZ25vcmUgc3VjaCBob29rcyBhcyB3ZWxsLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ2NvbW1pdCcsICctcScsICctLW5vLXZlcmlmeScsICctbScsIG1lc3NhZ2UsIC4uLmZpbGVzXSk7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCBmb3IgdGhlIGN1cnJlbnQgYnJhbmNoLiBBc3N1bWVzIHRoZSBub2RlIG1vZHVsZXNcbiAgICogdG8gYmUgYWxyZWFkeSBpbnN0YWxsZWQgZm9yIHRoZSBjdXJyZW50IGJyYW5jaC5cbiAgICpcbiAgICogQHJldHVybnMgQSBsaXN0IG9mIGJ1aWx0IHJlbGVhc2UgcGFja2FnZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgYnVpbGRSZWxlYXNlRm9yQ3VycmVudEJyYW5jaCgpOiBQcm9taXNlPEJ1aWx0UGFja2FnZVdpdGhJbmZvW10+IHtcbiAgICAvLyBOb3RlIHRoYXQgd2UgZG8gbm90IGRpcmVjdGx5IGNhbGwgdGhlIGJ1aWxkIHBhY2thZ2VzIGZ1bmN0aW9uIGZyb20gdGhlIHJlbGVhc2VcbiAgICAvLyBjb25maWcuIFdlIG9ubHkgd2FudCB0byBidWlsZCBhbmQgcHVibGlzaCBwYWNrYWdlcyB0aGF0IGhhdmUgYmVlbiBjb25maWd1cmVkIGluIHRoZSBnaXZlblxuICAgIC8vIHB1Ymxpc2ggYnJhbmNoLiBlLmcuIGNvbnNpZGVyIHdlIHB1Ymxpc2ggcGF0Y2ggdmVyc2lvbiBhbmQgYSBuZXcgcGFja2FnZSBoYXMgYmVlblxuICAgIC8vIGNyZWF0ZWQgaW4gdGhlIGBuZXh0YCBicmFuY2guIFRoZSBuZXcgcGFja2FnZSB3b3VsZCBub3QgYmUgcGFydCBvZiB0aGUgcGF0Y2ggYnJhbmNoLFxuICAgIC8vIHNvIHdlIGNhbm5vdCBidWlsZCBhbmQgcHVibGlzaCBpdC5cbiAgICBjb25zdCBidWlsdFBhY2thZ2VzID0gYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlQnVpbGQoXG4gICAgICB0aGlzLnByb2plY3REaXIsXG4gICAgICB0aGlzLnBucG1WZXJzaW9uaW5nLFxuICAgICk7XG4gICAgY29uc3QgcmVsZWFzZUluZm8gPSBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZVJlbGVhc2VJbmZvKFxuICAgICAgdGhpcy5wcm9qZWN0RGlyLFxuICAgICAgdGhpcy5wbnBtVmVyc2lvbmluZyxcbiAgICApO1xuXG4gICAgLy8gRXh0ZW5kIHRoZSBidWlsdCBwYWNrYWdlcyB3aXRoIHRoZWlyIGRpc2sgaGFzaCBhbmQgTlBNIHBhY2thZ2UgaW5mb3JtYXRpb24uIFRoaXMgaXNcbiAgICAvLyBoZWxwZnVsIGxhdGVyIGZvciB2ZXJpZnlpbmcgaW50ZWdyaXR5IGFuZCBmaWx0ZXJpbmcgb3V0IGUuZy4gZXhwZXJpbWVudGFsIHBhY2thZ2VzLlxuICAgIHJldHVybiBhbmFseXplQW5kRXh0ZW5kQnVpbHRQYWNrYWdlc1dpdGhJbmZvKGJ1aWx0UGFja2FnZXMsIHJlbGVhc2VJbmZvLm5wbVBhY2thZ2VzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFnZXMgdGhlIHNwZWNpZmllZCBuZXcgdmVyc2lvbiBmb3IgdGhlIGN1cnJlbnQgYnJhbmNoLCBidWlsZHMgdGhlIHJlbGVhc2Ugb3V0cHV0LFxuICAgKiB2ZXJpZmllcyBpdHMgb3V0cHV0IGFuZCBjcmVhdGVzIGEgcHVsbCByZXF1ZXN0ICB0aGF0IHRhcmdldHMgdGhlIGdpdmVuIGJhc2UgYnJhbmNoLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoZSBzdGFnaW5nIGJyYW5jaCBpcyBhbHJlYWR5IGNoZWNrZWQtb3V0LlxuICAgKlxuICAgKiBAcGFyYW0gbmV3VmVyc2lvbiBOZXcgdmVyc2lvbiB0byBiZSBzdGFnZWQuXG4gICAqIEBwYXJhbSBjb21wYXJlVmVyc2lvbkZvclJlbGVhc2VOb3RlcyBWZXJzaW9uIHVzZWQgZm9yIGNvbXBhcmluZyB3aXRoIHRoZSBjdXJyZW50XG4gICAqICAgYEhFQURgIGluIG9yZGVyIGJ1aWxkIHRoZSByZWxlYXNlIG5vdGVzLlxuICAgKiBAcGFyYW0gcHVsbFJlcXVlc3RUYXJnZXRCcmFuY2ggQnJhbmNoIHRoZSBwdWxsIHJlcXVlc3Qgc2hvdWxkIHRhcmdldC5cbiAgICogQHBhcmFtIG9wdHMgTm9uLW1hbmRhdG9yeSBvcHRpb25zIGZvciBjb250cm9sbGluZyB0aGUgc3RhZ2luZywgZS5nLlxuICAgKiAgIGFsbG93aW5nIGZvciBhZGRpdGlvbmFsIGBwYWNrYWdlLmpzb25gIG1vZGlmaWNhdGlvbnMuXG4gICAqIEByZXR1cm5zIGFuIG9iamVjdCBjYXB0dXJpbmcgYWN0aW9ucyBwZXJmb3JtZWQgYXMgcGFydCBvZiBzdGFnaW5nLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHN0YWdlVmVyc2lvbkZvckJyYW5jaEFuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgIG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXM6IHNlbXZlci5TZW1WZXIsXG4gICAgcHVsbFJlcXVlc3RUYXJnZXRCcmFuY2g6IHN0cmluZyxcbiAgICBvcHRzPzogU3RhZ2luZ09wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzO1xuICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdDtcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW107XG4gIH0+IHtcbiAgICBjb25zdCByZWxlYXNlTm90ZXNDb21wYXJlVGFnID0gZ2V0UmVsZWFzZVRhZ0ZvclZlcnNpb24oY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMpO1xuXG4gICAgLy8gRmV0Y2ggdGhlIGNvbXBhcmUgdGFnIHNvIHRoYXQgY29tbWl0cyBmb3IgdGhlIHJlbGVhc2Ugbm90ZXMgY2FuIGJlIGRldGVybWluZWQuXG4gICAgLy8gV2UgZm9yY2libHkgb3ZlcnJpZGUgZXhpc3RpbmcgbG9jYWwgdGFncyB0aGF0IGFyZSBuYW1lZCBzaW1pbGFyIGFzIHdlIHdpbGwgZmV0Y2hcbiAgICAvLyB0aGUgY29ycmVjdCB0YWcgZm9yIHJlbGVhc2Ugbm90ZXMgY29tcGFyaXNvbiBmcm9tIHRoZSB1cHN0cmVhbSByZW1vdGUuXG4gICAgdGhpcy5naXQucnVuKFtcbiAgICAgICdmZXRjaCcsXG4gICAgICAnLS1mb3JjZScsXG4gICAgICB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksXG4gICAgICBgcmVmcy90YWdzLyR7cmVsZWFzZU5vdGVzQ29tcGFyZVRhZ306cmVmcy90YWdzLyR7cmVsZWFzZU5vdGVzQ29tcGFyZVRhZ31gLFxuICAgIF0pO1xuXG4gICAgLy8gQnVpbGQgcmVsZWFzZSBub3RlcyBmb3IgY29tbWl0cyBmcm9tIGA8cmVsZWFzZU5vdGVzQ29tcGFyZVRhZz4uLkhFQURgLlxuICAgIGNvbnN0IHJlbGVhc2VOb3RlcyA9IGF3YWl0IFJlbGVhc2VOb3Rlcy5mb3JSYW5nZShcbiAgICAgIHRoaXMuZ2l0LFxuICAgICAgbmV3VmVyc2lvbixcbiAgICAgIHJlbGVhc2VOb3Rlc0NvbXBhcmVUYWcsXG4gICAgICAnSEVBRCcsXG4gICAgKTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdFZlcnNpb24obmV3VmVyc2lvbiwgb3B0cz8udXBkYXRlUGtnSnNvbkZuKTtcbiAgICBhd2FpdCB0aGlzLnByZXBlbmRSZWxlYXNlTm90ZXNUb0NoYW5nZWxvZyhyZWxlYXNlTm90ZXMpO1xuICAgIGF3YWl0IHRoaXMud2FpdEZvckVkaXRzQW5kQ3JlYXRlUmVsZWFzZUNvbW1pdChuZXdWZXJzaW9uKTtcblxuICAgIC8vIEluc3RhbGwgdGhlIHByb2plY3QgZGVwZW5kZW5jaWVzIGZvciB0aGUgcHVibGlzaCBicmFuY2guXG4gICAgYXdhaXQgdGhpcy5pbnN0YWxsRGVwZW5kZW5jaWVzRm9yQ3VycmVudEJyYW5jaCgpO1xuXG4gICAgY29uc3QgYnVpbHRQYWNrYWdlc1dpdGhJbmZvID0gYXdhaXQgdGhpcy5idWlsZFJlbGVhc2VGb3JDdXJyZW50QnJhbmNoKCk7XG5cbiAgICAvLyBSdW4gcmVsZWFzZSBwcmUtY2hlY2tzIChlLmcuIHZhbGlkYXRpbmcgdGhlIHJlbGVhc2Ugb3V0cHV0KS5cbiAgICBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZVJlbGVhc2VQcmVjaGVjayhcbiAgICAgIHRoaXMucHJvamVjdERpcixcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgICBidWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gICAgICB0aGlzLnBucG1WZXJzaW9uaW5nLFxuICAgICk7XG5cbiAgICAvLyBWZXJpZnkgdGhlIHBhY2thZ2VzIGJ1aWx0IGFyZSB0aGUgY29ycmVjdCB2ZXJzaW9uLlxuICAgIGF3YWl0IHRoaXMuX3ZlcmlmeVBhY2thZ2VWZXJzaW9ucyhyZWxlYXNlTm90ZXMudmVyc2lvbiwgYnVpbHRQYWNrYWdlc1dpdGhJbmZvKTtcblxuICAgIGNvbnN0IHB1bGxSZXF1ZXN0ID0gYXdhaXQgdGhpcy5wdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgcHVsbFJlcXVlc3RUYXJnZXRCcmFuY2gsXG4gICAgICBgcmVsZWFzZS1zdGFnZS0ke25ld1ZlcnNpb259YCxcbiAgICAgIGBCdW1wIHZlcnNpb24gdG8gXCJ2JHtuZXdWZXJzaW9ufVwiIHdpdGggY2hhbmdlbG9nLmAsXG4gICAgKTtcblxuICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIFJlbGVhc2Ugc3RhZ2luZyBwdWxsIHJlcXVlc3QgaGFzIGJlZW4gY3JlYXRlZC4nKSk7XG5cbiAgICByZXR1cm4ge3JlbGVhc2VOb3RlcywgcHVsbFJlcXVlc3QsIGJ1aWx0UGFja2FnZXNXaXRoSW5mb307XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIG91dCB0aGUgc3BlY2lmaWVkIHRhcmdldCBicmFuY2gsIHZlcmlmaWVzIGl0cyBDSSBzdGF0dXMgYW5kIHN0YWdlc1xuICAgKiB0aGUgc3BlY2lmaWVkIG5ldyB2ZXJzaW9uIGluIG9yZGVyIHRvIGNyZWF0ZSBhIHB1bGwgcmVxdWVzdC5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IHZlcnNpb24gdG8gYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgVmVyc2lvbiB1c2VkIGZvciBjb21wYXJpbmcgd2l0aCBgSEVBRGAgb2ZcbiAgICogICB0aGUgc3RhZ2luZyBicmFuY2ggaW4gb3JkZXIgYnVpbGQgdGhlIHJlbGVhc2Ugbm90ZXMuXG4gICAqIEBwYXJhbSBzdGFnaW5nQnJhbmNoIEJyYW5jaCB3aXRoaW4gdGhlIG5ldyB2ZXJzaW9uIHNob3VsZCBiZSBzdGFnZWQuXG4gICAqIEBwYXJhbSBzdGFnaW5nT3B0aW9ucyBOb24tbWFuZGF0b3J5IG9wdGlvbnMgZm9yIGNvbnRyb2xsaW5nIHRoZSBzdGFnaW5nIG9mXG4gICAqICAgdGhlIG5ldyB2ZXJzaW9uLiBlLmcuIGFsbG93aW5nIGZvciBhZGRpdGlvbmFsIGBwYWNrYWdlLmpzb25gIG1vZGlmaWNhdGlvbnMuXG4gICAqIEByZXR1cm5zIGFuIG9iamVjdCBjYXB0dXJpbmcgYWN0aW9ucyBwZXJmb3JtZWQgYXMgcGFydCBvZiBzdGFnaW5nLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNoZWNrb3V0QnJhbmNoQW5kU3RhZ2VWZXJzaW9uKFxuICAgIG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXM6IHNlbXZlci5TZW1WZXIsXG4gICAgc3RhZ2luZ0JyYW5jaDogc3RyaW5nLFxuICAgIHN0YWdpbmdPcHRzPzogU3RhZ2luZ09wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzO1xuICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdDtcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW107XG4gICAgYmVmb3JlU3RhZ2luZ1NoYTogc3RyaW5nO1xuICB9PiB7XG4gICAgLy8gS2VlcCB0cmFjayBvZiB0aGUgY29tbWl0IHdoZXJlIHdlIHN0YXJ0ZWQgdGhlIHN0YWdpbmcgcHJvY2VzcyBvbi4gVGhpcyB3aWxsIGJlIHVzZWRcbiAgICAvLyBsYXRlciB0byBlbnN1cmUgdGhhdCBubyBjaGFuZ2VzLCBleGNlcHQgZm9yIHRoZSB2ZXJzaW9uIGJ1bXAgaGF2ZSBsYW5kZWQgYXMgcGFydFxuICAgIC8vIG9mIHRoZSBzdGFnaW5nIHRpbWUgd2luZG93ICh3aGVyZSB0aGUgY2FyZXRha2VyIGNvdWxkIGFjY2lkZW50YWxseSBsYW5kIG90aGVyIHN0dWZmKS5cbiAgICBjb25zdCB7c2hhOiBiZWZvcmVTdGFnaW5nU2hhfSA9IGF3YWl0IHRoaXMuZ2V0TGF0ZXN0Q29tbWl0T2ZCcmFuY2goc3RhZ2luZ0JyYW5jaCk7XG5cbiAgICBhd2FpdCB0aGlzLmFzc2VydFBhc3NpbmdHaXRodWJTdGF0dXMoYmVmb3JlU3RhZ2luZ1NoYSwgc3RhZ2luZ0JyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy5jaGVja291dFVwc3RyZWFtQnJhbmNoKHN0YWdpbmdCcmFuY2gpO1xuXG4gICAgY29uc3Qgc3RhZ2luZ0luZm8gPSBhd2FpdCB0aGlzLnN0YWdlVmVyc2lvbkZvckJyYW5jaEFuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgbmV3VmVyc2lvbixcbiAgICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzLFxuICAgICAgc3RhZ2luZ0JyYW5jaCxcbiAgICAgIHN0YWdpbmdPcHRzLFxuICAgICk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uc3RhZ2luZ0luZm8sXG4gICAgICBiZWZvcmVTdGFnaW5nU2hhLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ2hlcnJ5LXBpY2tzIHRoZSByZWxlYXNlIG5vdGVzIG9mIGEgdmVyc2lvbiB0aGF0IGhhdmUgYmVlbiBwdXNoZWQgdG8gYSBnaXZlbiBicmFuY2hcbiAgICogaW50byB0aGUgYG5leHRgIHByaW1hcnkgZGV2ZWxvcG1lbnQgYnJhbmNoLiBBIHB1bGwgcmVxdWVzdCBpcyBjcmVhdGVkIGZvciB0aGlzLlxuICAgKiBAcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzZnVsIGNyZWF0aW9uIG9mIHRoZSBjaGVycnktcGljayBwdWxsIHJlcXVlc3QuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY2hlcnJ5UGlja0NoYW5nZWxvZ0ludG9OZXh0QnJhbmNoKFxuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzLFxuICAgIHN0YWdpbmdCcmFuY2g6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgbmV4dEJyYW5jaCA9IHRoaXMuYWN0aXZlLm5leHQuYnJhbmNoTmFtZTtcbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gZ2V0UmVsZWFzZU5vdGVDaGVycnlQaWNrQ29tbWl0TWVzc2FnZShyZWxlYXNlTm90ZXMudmVyc2lvbik7XG5cbiAgICAvLyBDaGVja291dCB0aGUgbmV4dCBicmFuY2guXG4gICAgYXdhaXQgdGhpcy5jaGVja291dFVwc3RyZWFtQnJhbmNoKG5leHRCcmFuY2gpO1xuXG4gICAgYXdhaXQgdGhpcy5wcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzKTtcblxuICAgIGNvbnN0IGZpbGVzVG9Db21taXQ6IHN0cmluZ1tdID0gW3dvcmtzcGFjZVJlbGF0aXZlQ2hhbmdlbG9nUGF0aF07XG4gICAgaWYgKHJlbGVhc2VOb3Rlcy52ZXJzaW9uLnBhdGNoID09PSAwICYmICFyZWxlYXNlTm90ZXMudmVyc2lvbi5wcmVyZWxlYXNlKSB7XG4gICAgICAvLyBTd2l0Y2ggdGhlIHJlbm92YXRlIGxhYmVscyBmb3IgYHRhcmdldDogcmNgIHRvIGB0YXJnZXQ6IHBhdGNoYFxuICAgICAgY29uc3QgcmVub3ZhdGVDb25maWdQYXRoID0gYXdhaXQgdXBkYXRlUmVub3ZhdGVDb25maWdUYXJnZXRMYWJlbHMoXG4gICAgICAgIHRoaXMucHJvamVjdERpcixcbiAgICAgICAgdGFyZ2V0TGFiZWxzWydUQVJHRVRfUkMnXS5uYW1lLFxuICAgICAgICB0YXJnZXRMYWJlbHNbJ1RBUkdFVF9QQVRDSCddLm5hbWUsXG4gICAgICApO1xuXG4gICAgICBpZiAocmVub3ZhdGVDb25maWdQYXRoKSB7XG4gICAgICAgIGZpbGVzVG9Db21taXQucHVzaChyZW5vdmF0ZUNvbmZpZ1BhdGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlQ29tbWl0KGNvbW1pdE1lc3NhZ2UsIGZpbGVzVG9Db21taXQpO1xuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIENyZWF0ZWQgY2hhbmdlbG9nIGNoZXJyeS1waWNrIGNvbW1pdCBmb3I6IFwiJHtyZWxlYXNlTm90ZXMudmVyc2lvbn1cIi5gKSk7XG5cbiAgICAvLyBDcmVhdGUgYSBjaGVycnktcGljayBwdWxsIHJlcXVlc3QgdGhhdCBzaG91bGQgYmUgbWVyZ2VkIGJ5IHRoZSBjYXJldGFrZXIuXG4gICAgY29uc3QgcHVsbFJlcXVlc3QgPSBhd2FpdCB0aGlzLnB1c2hDaGFuZ2VzVG9Gb3JrQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgICBuZXh0QnJhbmNoLFxuICAgICAgYGNoYW5nZWxvZy1jaGVycnktcGljay0ke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufWAsXG4gICAgICBjb21taXRNZXNzYWdlLFxuICAgICAgYENoZXJyeS1waWNrcyB0aGUgY2hhbmdlbG9nIGZyb20gdGhlIFwiJHtzdGFnaW5nQnJhbmNofVwiIGJyYW5jaCB0byB0aGUgbmV4dCBgICtcbiAgICAgICAgYGJyYW5jaCAoJHtuZXh0QnJhbmNofSkuYCxcbiAgICApO1xuXG4gICAgTG9nLmluZm8oXG4gICAgICBncmVlbihcbiAgICAgICAgYCAg4pyTICAgUHVsbCByZXF1ZXN0IGZvciBjaGVycnktcGlja2luZyB0aGUgY2hhbmdlbG9nIGludG8gXCIke25leHRCcmFuY2h9XCIgYCArXG4gICAgICAgICAgJ2hhcyBiZWVuIGNyZWF0ZWQuJyxcbiAgICAgICksXG4gICAgKTtcblxuICAgIGF3YWl0IHRoaXMucHJvbXB0QW5kV2FpdEZvclB1bGxSZXF1ZXN0TWVyZ2VkKHB1bGxSZXF1ZXN0KTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqIFByb21wdHMgdGhlIHVzZXIgZm9yIG1lcmdpbmcgdGhlIHB1bGwgcmVxdWVzdCwgYW5kIHdhaXRzIGZvciBpdCB0byBiZSBtZXJnZWQuICovXG4gIHByb3RlY3RlZCBhc3luYyBwcm9tcHRBbmRXYWl0Rm9yUHVsbFJlcXVlc3RNZXJnZWQocHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgcHJvbXB0VG9Jbml0aWF0ZVB1bGxSZXF1ZXN0TWVyZ2UodGhpcy5naXQsIHB1bGxSZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgR2l0aHViIHJlbGVhc2UgZm9yIHRoZSBzcGVjaWZpZWQgdmVyc2lvbi4gVGhlIHJlbGVhc2UgaXMgY3JlYXRlZFxuICAgKiBieSB0YWdnaW5nIHRoZSB2ZXJzaW9uIGJ1bXAgY29tbWl0LCBhbmQgYnkgY3JlYXRpbmcgdGhlIHJlbGVhc2UgZW50cnkuXG4gICAqXG4gICAqIEV4cGVjdHMgdGhlIHZlcnNpb24gYnVtcCBjb21taXQgYW5kIGNoYW5nZWxvZyB0byBiZSBhdmFpbGFibGUgaW4gdGhlXG4gICAqIHVwc3RyZWFtIHJlbW90ZS5cbiAgICpcbiAgICogQHBhcmFtIHJlbGVhc2VOb3RlcyBUaGUgcmVsZWFzZSBub3RlcyBmb3IgdGhlIHZlcnNpb24gYmVpbmcgcHVibGlzaGVkLlxuICAgKiBAcGFyYW0gdmVyc2lvbkJ1bXBDb21taXRTaGEgQ29tbWl0IHRoYXQgYnVtcGVkIHRoZSB2ZXJzaW9uLiBUaGUgcmVsZWFzZSB0YWdcbiAgICogICB3aWxsIHBvaW50IHRvIHRoaXMgY29tbWl0LlxuICAgKiBAcGFyYW0gaXNQcmVyZWxlYXNlIFdoZXRoZXIgdGhlIG5ldyB2ZXJzaW9uIGlzIHB1Ymxpc2hlZCBhcyBhIHByZS1yZWxlYXNlLlxuICAgKiBAcGFyYW0gc2hvd0FzTGF0ZXN0T25HaXRIdWIgV2hldGhlciB0aGUgdmVyc2lvbiByZWxlYXNlZCB3aWxsIHJlcHJlc2VudFxuICAgKiAgIHRoZSBcImxhdGVzdFwiIHZlcnNpb24gb2YgdGhlIHByb2plY3QuIEkuZS4gR2l0SHViIHdpbGwgc2hvdyB0aGlzIHZlcnNpb24gYXMgXCJsYXRlc3RcIi5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX2NyZWF0ZUdpdGh1YlJlbGVhc2VGb3JWZXJzaW9uKFxuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzLFxuICAgIHZlcnNpb25CdW1wQ29tbWl0U2hhOiBzdHJpbmcsXG4gICAgaXNQcmVyZWxlYXNlOiBib29sZWFuLFxuICAgIHNob3dBc0xhdGVzdE9uR2l0SHViOiBib29sZWFuLFxuICApIHtcbiAgICBjb25zdCB0YWdOYW1lID0gZ2V0UmVsZWFzZVRhZ0ZvclZlcnNpb24ocmVsZWFzZU5vdGVzLnZlcnNpb24pO1xuICAgIGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5naXQuY3JlYXRlUmVmKHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIHJlZjogYHJlZnMvdGFncy8ke3RhZ05hbWV9YCxcbiAgICAgIHNoYTogdmVyc2lvbkJ1bXBDb21taXRTaGEsXG4gICAgfSk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVGFnZ2VkIHYke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufSByZWxlYXNlIHVwc3RyZWFtLmApKTtcblxuICAgIGxldCByZWxlYXNlQm9keSA9IGF3YWl0IHJlbGVhc2VOb3Rlcy5nZXRHaXRodWJSZWxlYXNlRW50cnkoKTtcblxuICAgIC8vIElmIHRoZSByZWxlYXNlIGJvZHkgZXhjZWVkcyB0aGUgR2l0aHViIGJvZHkgbGltaXQsIHdlIGp1c3QgcHJvdmlkZVxuICAgIC8vIGEgbGluayB0byB0aGUgY2hhbmdlbG9nIGVudHJ5IGluIHRoZSBHaXRodWIgcmVsZWFzZSBlbnRyeS5cbiAgICBpZiAocmVsZWFzZUJvZHkubGVuZ3RoID4gZ2l0aHViUmVsZWFzZUJvZHlMaW1pdCkge1xuICAgICAgY29uc3QgcmVsZWFzZU5vdGVzVXJsID0gYXdhaXQgdGhpcy5fZ2V0R2l0aHViQ2hhbmdlbG9nVXJsRm9yUmVmKHJlbGVhc2VOb3RlcywgdGFnTmFtZSk7XG4gICAgICByZWxlYXNlQm9keSA9XG4gICAgICAgIGBSZWxlYXNlIG5vdGVzIGFyZSB0b28gbGFyZ2UgdG8gYmUgY2FwdHVyZWQgaGVyZS4gYCArXG4gICAgICAgIGBbVmlldyBhbGwgY2hhbmdlcyBoZXJlXSgke3JlbGVhc2VOb3Rlc1VybH0pLmA7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLnJlcG9zLmNyZWF0ZVJlbGVhc2Uoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgbmFtZTogcmVsZWFzZU5vdGVzLnZlcnNpb24udG9TdHJpbmcoKSxcbiAgICAgIHRhZ19uYW1lOiB0YWdOYW1lLFxuICAgICAgcHJlcmVsZWFzZTogaXNQcmVyZWxlYXNlLFxuICAgICAgbWFrZV9sYXRlc3Q6IHNob3dBc0xhdGVzdE9uR2l0SHViID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgIGJvZHk6IHJlbGVhc2VCb2R5LFxuICAgIH0pO1xuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIENyZWF0ZWQgdiR7cmVsZWFzZU5vdGVzLnZlcnNpb259IHJlbGVhc2UgaW4gR2l0aHViLmApKTtcbiAgfVxuXG4gIC8qKiBHZXRzIGEgR2l0aHViIFVSTCB0aGF0IHJlc29sdmVzIHRvIHRoZSByZWxlYXNlIG5vdGVzIGluIHRoZSBnaXZlbiByZWYuICovXG4gIHByaXZhdGUgYXN5bmMgX2dldEdpdGh1YkNoYW5nZWxvZ1VybEZvclJlZihyZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcywgcmVmOiBzdHJpbmcpIHtcbiAgICBjb25zdCBiYXNlVXJsID0gZ2V0RmlsZUNvbnRlbnRzVXJsKHRoaXMuZ2l0LCByZWYsIHdvcmtzcGFjZVJlbGF0aXZlQ2hhbmdlbG9nUGF0aCk7XG4gICAgY29uc3QgdXJsRnJhZ21lbnQgPSBhd2FpdCByZWxlYXNlTm90ZXMuZ2V0VXJsRnJhZ21lbnRGb3JSZWxlYXNlKCk7XG4gICAgcmV0dXJuIGAke2Jhc2VVcmx9IyR7dXJsRnJhZ21lbnR9YDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdWJsaXNoZXMgdGhlIGdpdmVuIHBhY2thZ2VzIHRvIHRoZSByZWdpc3RyeSBhbmQgbWFrZXMgdGhlIHJlbGVhc2VzXG4gICAqIGF2YWlsYWJsZSBvbiBHaXRIdWIuXG4gICAqXG4gICAqIEBwYXJhbSBidWlsdFBhY2thZ2VzV2l0aEluZm8gTGlzdCBvZiBidWlsdCBwYWNrYWdlcyB0aGF0IHdpbGwgYmUgcHVibGlzaGVkLlxuICAgKiBAcGFyYW0gcmVsZWFzZU5vdGVzIFRoZSByZWxlYXNlIG5vdGVzIGZvciB0aGUgdmVyc2lvbiBiZWluZyBwdWJsaXNoZWQuXG4gICAqIEBwYXJhbSBiZWZvcmVTdGFnaW5nU2hhIENvbW1pdCBTSEEgdGhhdCBpcyBleHBlY3RlZCB0byBiZSB0aGUgbW9zdCByZWNlbnQgb25lIGFmdGVyXG4gICAqICAgdGhlIGFjdHVhbCB2ZXJzaW9uIGJ1bXAgY29tbWl0LiBUaGlzIGV4aXN0cyB0byBlbnN1cmUgdGhhdCBjYXJldGFrZXJzIGRvIG5vdCBsYW5kXG4gICAqICAgYWRkaXRpb25hbCBjaGFuZ2VzIGFmdGVyIHRoZSByZWxlYXNlIG91dHB1dCBoYXMgYmVlbiBidWlsdCBsb2NhbGx5LlxuICAgKiBAcGFyYW0gcHVibGlzaEJyYW5jaCBOYW1lIG9mIHRoZSBicmFuY2ggdGhhdCBjb250YWlucyB0aGUgbmV3IHZlcnNpb24uXG4gICAqIEBwYXJhbSBucG1EaXN0VGFnIE5QTSBkaXN0IHRhZyB3aGVyZSB0aGUgdmVyc2lvbiBzaG91bGQgYmUgcHVibGlzaGVkIHRvLlxuICAgKiBAcGFyYW0gYWRkaXRpb25hbE9wdGlvbnMgQWRkaXRpb25hbCBvcHRpb25zIG5lZWRlZCBmb3IgcHVibGlzaGluZyBhIHJlbGVhc2UuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgcHVibGlzaChcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW10sXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgYmVmb3JlU3RhZ2luZ1NoYTogc3RyaW5nLFxuICAgIHB1Ymxpc2hCcmFuY2g6IHN0cmluZyxcbiAgICBucG1EaXN0VGFnOiBOcG1EaXN0VGFnLFxuICAgIGFkZGl0aW9uYWxPcHRpb25zOiB7c2hvd0FzTGF0ZXN0T25HaXRIdWI6IGJvb2xlYW59LFxuICApIHtcbiAgICBjb25zdCByZWxlYXNlU2hhID0gYXdhaXQgdGhpcy5fZ2V0QW5kVmFsaWRhdGVMYXRlc3RDb21taXRGb3JQdWJsaXNoaW5nKFxuICAgICAgcHVibGlzaEJyYW5jaCxcbiAgICAgIHJlbGVhc2VOb3Rlcy52ZXJzaW9uLFxuICAgICAgYmVmb3JlU3RhZ2luZ1NoYSxcbiAgICApO1xuXG4gICAgLy8gQmVmb3JlIHB1Ymxpc2hpbmcsIHdlIHdhbnQgdG8gZW5zdXJlIHRoYXQgdGhlIGxvY2FsbHktYnVpbHQgcGFja2FnZXMgd2VcbiAgICAvLyBidWlsdCBpbiB0aGUgc3RhZ2luZyBwaGFzZSBoYXZlIG5vdCBiZWVuIG1vZGlmaWVkIGFjY2lkZW50YWxseS5cbiAgICBhd2FpdCBhc3NlcnRJbnRlZ3JpdHlPZkJ1aWx0UGFja2FnZXMoYnVpbHRQYWNrYWdlc1dpdGhJbmZvKTtcblxuICAgIC8vIENyZWF0ZSBhIEdpdGh1YiByZWxlYXNlIGZvciB0aGUgbmV3IHZlcnNpb24uXG4gICAgYXdhaXQgdGhpcy5fY3JlYXRlR2l0aHViUmVsZWFzZUZvclZlcnNpb24oXG4gICAgICByZWxlYXNlTm90ZXMsXG4gICAgICByZWxlYXNlU2hhLFxuICAgICAgbnBtRGlzdFRhZyA9PT0gJ25leHQnLFxuICAgICAgYWRkaXRpb25hbE9wdGlvbnMuc2hvd0FzTGF0ZXN0T25HaXRIdWIsXG4gICAgKTtcblxuICAgIC8vIFdhbGsgdGhyb3VnaCBhbGwgYnVpbHQgcGFja2FnZXMgYW5kIHB1Ymxpc2ggdGhlbSB0byBOUE0uXG4gICAgZm9yIChjb25zdCBwa2cgb2YgYnVpbHRQYWNrYWdlc1dpdGhJbmZvKSB7XG4gICAgICBhd2FpdCB0aGlzLl9wdWJsaXNoQnVpbHRQYWNrYWdlVG9OcG0ocGtnLCBucG1EaXN0VGFnKTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBQdWJsaXNoZWQgYWxsIHBhY2thZ2VzIHN1Y2Nlc3NmdWxseScpKTtcbiAgfVxuXG4gIC8qKiBQdWJsaXNoZXMgdGhlIGdpdmVuIGJ1aWx0IHBhY2thZ2UgdG8gTlBNIHdpdGggdGhlIHNwZWNpZmllZCBOUE0gZGlzdCB0YWcuICovXG4gIHByaXZhdGUgYXN5bmMgX3B1Ymxpc2hCdWlsdFBhY2thZ2VUb05wbShwa2c6IEJ1aWx0UGFja2FnZSwgbnBtRGlzdFRhZzogTnBtRGlzdFRhZykge1xuICAgIExvZy5kZWJ1ZyhgU3RhcnRpbmcgcHVibGlzaCBvZiBcIiR7cGtnLm5hbWV9XCIuYCk7XG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKGBQdWJsaXNoaW5nIFwiJHtwa2cubmFtZX1cImApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IE5wbUNvbW1hbmQucHVibGlzaChwa2cub3V0cHV0UGF0aCwgbnBtRGlzdFRhZywgdGhpcy5jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFN1Y2Nlc3NmdWxseSBwdWJsaXNoZWQgXCIke3BrZy5uYW1lfS5gKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHB1Ymxpc2hpbmcgXCIke3BrZy5uYW1lfVwiLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHJlaXZlIHRoZSBsYXRlc3QgY29tbWl0IGZyb20gdGhlIHByb3ZpZGVkIGJyYW5jaCwgYW5kIHZlcmlmeSB0aGF0IGl0IGlzIHRoZSBleHBlY3RlZFxuICAgKiByZWxlYXNlIGNvbW1pdCBhbmQgaXMgdGhlIGRpcmVjdCBjaGlsZCBvZiB0aGUgcHJldmlvdXMgc2hhIHByb3ZpZGVkLlxuICAgKlxuICAgKiBUaGUgbWV0aG9kIHdpbGwgbWFrZSBvbmUgcmVjdXJzaXZlIGF0dGVtcHQgdG8gY2hlY2sgYWdhaW4gYmVmb3JlIHRocm93aW5nIGFuIGVycm9yIGlmXG4gICAqIGFueSBlcnJvciBvY2N1cnMgZHVyaW5nIHRoaXMgdmFsaWRhdGlvbi4gVGhpcyBleGlzdHMgYXMgYW4gYXR0ZW1wdCB0byBoYW5kbGUgdHJhbnNpZW50XG4gICAqIHRpbWVvdXRzIGZyb20gR2l0aHViIGFsb25nIHdpdGggY2FzZXMsIHdoZXJlIHRoZSBHaXRodWIgQVBJIHJlc3BvbnNlIGRvZXMgbm90IGtlZXAgdXBcbiAgICogd2l0aCB0aGUgdGltaW5nIGZyb20gd2hlbiB3ZSBwZXJmb3JtIGEgbWVyZ2UgdG8gd2hlbiB3ZSB2ZXJpZnkgdGhhdCB0aGUgbWVyZ2VkIGNvbW1pdCBpc1xuICAgKiBwcmVzZW50IGluIHRoZSB1cHN0cmVhbSBicmFuY2guXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9nZXRBbmRWYWxpZGF0ZUxhdGVzdENvbW1pdEZvclB1Ymxpc2hpbmcoXG4gICAgYnJhbmNoOiBzdHJpbmcsXG4gICAgdmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBwcmV2aW91c1NoYTogc3RyaW5nLFxuICApOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGxldCBsYXRlc3RTaGE6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgLy8gU3VwcG9ydCByZS1jaGVja2luZyBhcyBtYW55IHRpbWVzIGFzIG5lZWRlZC4gT2Z0ZW4gdGltZXMgdGhlIEdpdEh1YiBBUElcbiAgICAvLyBpcyBub3QgdXAtdG8tZGF0ZSBhbmQgd2UgZG9uJ3Qgd2FudCB0byBleGl0IHRoZSByZWxlYXNlIHNjcmlwdCB0aGVuLlxuICAgIHdoaWxlIChsYXRlc3RTaGEgPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGNvbW1pdCA9IGF3YWl0IHRoaXMuZ2V0TGF0ZXN0Q29tbWl0T2ZCcmFuY2goYnJhbmNoKTtcblxuICAgICAgLy8gRW5zdXJlIHRoZSBsYXRlc3QgY29tbWl0IGluIHRoZSBwdWJsaXNoIGJyYW5jaCBpcyB0aGUgYnVtcCBjb21taXQuXG4gICAgICBpZiAoIWNvbW1pdC5jb21taXQubWVzc2FnZS5zdGFydHNXaXRoKGdldENvbW1pdE1lc3NhZ2VGb3JSZWxlYXNlKHZlcnNpb24pKSkge1xuICAgICAgICAvKiogVGhlIHNob3J0ZW5lZCBzaGEgb2YgdGhlIGNvbW1pdCBmb3IgdXNhZ2UgaW4gdGhlIGVycm9yIG1lc3NhZ2UuICovXG4gICAgICAgIGNvbnN0IHNoYSA9IGNvbW1pdC5zaGEuc2xpY2UoMCwgOCk7XG4gICAgICAgIExvZy5lcnJvcihgICDinJggICBMYXRlc3QgY29tbWl0ICgke3NoYX0pIGluIFwiJHticmFuY2h9XCIgYnJhbmNoIGlzIG5vdCBhIHN0YWdpbmcgY29tbWl0LmApO1xuICAgICAgICBMb2cuZXJyb3IoJyAgICAgIFBsZWFzZSBtYWtlIHN1cmUgdGhlIHN0YWdpbmcgcHVsbCByZXF1ZXN0IGhhcyBiZWVuIG1lcmdlZC4nKTtcblxuICAgICAgICBpZiAoYXdhaXQgUHJvbXB0LmNvbmZpcm0oe21lc3NhZ2U6IGBEbyB5b3Ugd2FudCB0byByZS10cnk/YCwgZGVmYXVsdDogdHJ1ZX0pKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIG9ubHkgaW5zcGVjdCB0aGUgZmlyc3QgcGFyZW50IGFzIHdlIGVuZm9yY2UgdGhhdCBubyBtZXJnZSBjb21taXRzIGFyZSB1c2VkIGluIG91clxuICAgICAgLy8gcmVwb3MsIHNvIGFsbCBjb21taXRzIGhhdmUgZXhhY3RseSBvbmUgcGFyZW50LlxuICAgICAgaWYgKGNvbW1pdC5wYXJlbnRzWzBdLnNoYSAhPT0gcHJldmlvdXNTaGEpIHtcbiAgICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIFVuZXhwZWN0ZWQgYWRkaXRpb25hbCBjb21taXRzIGhhdmUgbGFuZGVkIHdoaWxlIHN0YWdpbmcgdGhlIHJlbGVhc2UuYCk7XG4gICAgICAgIExvZy5lcnJvcignICAgICAgUGxlYXNlIHJldmVydCB0aGUgYnVtcCBjb21taXQgYW5kIHJldHJ5LCBvciBjdXQgYSBuZXcgdmVyc2lvbiBvbiB0b3AuJyk7XG5cbiAgICAgICAgaWYgKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiBgRG8geW91IHdhbnQgdG8gcmUtdHJ5P2AsIGRlZmF1bHQ6IHRydWV9KSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgICAgfVxuXG4gICAgICBsYXRlc3RTaGEgPSBjb21taXQuc2hhO1xuICAgIH1cblxuICAgIHJldHVybiBsYXRlc3RTaGE7XG4gIH1cblxuICAvLyBUT0RPOiBSZW1vdmUgdGhpcyBjaGVjayBhbmQgcnVuIGl0IGFzIHBhcnQgb2YgY29tbW9uIHJlbGVhc2UgdmFsaWRhdGlvbi5cbiAgLyoqIFZlcmlmeSB0aGUgdmVyc2lvbiBvZiBlYWNoIGdlbmVyYXRlZCBwYWNrYWdlIGV4YWN0IG1hdGNoZXMgdGhlIHNwZWNpZmllZCB2ZXJzaW9uLiAqL1xuICBwcml2YXRlIGFzeW5jIF92ZXJpZnlQYWNrYWdlVmVyc2lvbnModmVyc2lvbjogc2VtdmVyLlNlbVZlciwgcGFja2FnZXM6IEJ1aWx0UGFja2FnZVdpdGhJbmZvW10pIHtcbiAgICAvLyBFeHBlcmltZW50YWwgZXF1aXZhbGVudCB2ZXJzaW9uIGZvciBwYWNrYWdlcy5cbiAgICBjb25zdCBleHBlcmltZW50YWxWZXJzaW9uID0gY3JlYXRlRXhwZXJpbWVudGFsU2VtdmVyKHZlcnNpb24pO1xuXG4gICAgZm9yIChjb25zdCBwa2cgb2YgcGFja2FnZXMpIHtcbiAgICAgIGNvbnN0IHt2ZXJzaW9uOiBwYWNrYWdlSnNvblZlcnNpb259ID0gSlNPTi5wYXJzZShcbiAgICAgICAgYXdhaXQgZnMucmVhZEZpbGUoam9pbihwa2cub3V0cHV0UGF0aCwgJ3BhY2thZ2UuanNvbicpLCAndXRmOCcpLFxuICAgICAgKSBhcyB7dmVyc2lvbjogc3RyaW5nOyBba2V5OiBzdHJpbmddOiBhbnl9O1xuXG4gICAgICBjb25zdCBleHBlY3RlZFZlcnNpb24gPSBwa2cuZXhwZXJpbWVudGFsID8gZXhwZXJpbWVudGFsVmVyc2lvbiA6IHZlcnNpb247XG4gICAgICBjb25zdCBtaXNtYXRjaGVzVmVyc2lvbiA9IGV4cGVjdGVkVmVyc2lvbi5jb21wYXJlKHBhY2thZ2VKc29uVmVyc2lvbikgIT09IDA7XG5cbiAgICAgIGlmIChtaXNtYXRjaGVzVmVyc2lvbikge1xuICAgICAgICBMb2cuZXJyb3IoYFRoZSBidWlsdCBwYWNrYWdlIHZlcnNpb24gZG9lcyBub3QgbWF0Y2ggZm9yOiAke3BrZy5uYW1lfS5gKTtcbiAgICAgICAgTG9nLmVycm9yKGAgIEFjdHVhbCB2ZXJzaW9uOiAgICR7cGFja2FnZUpzb25WZXJzaW9ufWApO1xuICAgICAgICBMb2cuZXJyb3IoYCAgRXhwZWN0ZWQgdmVyc2lvbjogJHtleHBlY3RlZFZlcnNpb259YCk7XG4gICAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19