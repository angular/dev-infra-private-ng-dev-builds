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
        const commitMessage = getCommitMessageForRelease(newVersion);
        const filesToCommit = [
            workspaceRelativePackageJsonPath,
            workspaceRelativeChangelogPath,
            ...this.getAspectLockFiles(),
        ];
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
        // Create a changelog cherry-pick commit.
        await this.createCommit(commitMessage, [workspaceRelativeChangelogPath]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsUUFBUSxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDOUMsT0FBTyxJQUFJLEVBQUUsRUFBQyxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFHaEMsT0FBTyxFQUFDLGdDQUFnQyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFMUUsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxZQUFZLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUNMLGtCQUFrQixFQUNsQix5QkFBeUIsRUFDekIsbUJBQW1CLEdBQ3BCLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEMsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFL0MsT0FBTyxFQUFDLFlBQVksRUFBRSw4QkFBOEIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBR3ZGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RSxPQUFPLEVBQUMsdUJBQXVCLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMxRixPQUFPLEVBQ0wscUNBQXFDLEVBQ3JDLDhCQUE4QixHQUMvQixNQUFNLHlCQUF5QixDQUFDO0FBQ2pDLE9BQU8sRUFDTCwwQkFBMEIsRUFDMUIscUNBQXFDLEdBQ3RDLE1BQU0scUJBQXFCLENBQUM7QUFDN0IsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDeEQsT0FBTyxFQUFDLGdDQUFnQyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDbkUsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxJQUFJLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDL0IsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBdUNwRDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFnQixhQUFhO0lBQ2pDLHNEQUFzRDtJQUN0RCxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQTRCLEVBQUUsT0FBc0I7UUFDbEUsTUFBTSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBYUQsWUFDWSxNQUEyQixFQUMzQixHQUEyQixFQUMzQixNQUFxQixFQUNyQixVQUFrQjtRQUhsQixXQUFNLEdBQU4sTUFBTSxDQUFxQjtRQUMzQixRQUFHLEdBQUgsR0FBRyxDQUF3QjtRQUMzQixXQUFNLEdBQU4sTUFBTSxDQUFlO1FBQ3JCLGVBQVUsR0FBVixVQUFVLENBQVE7UUFOcEIsbUJBQWMsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO0lBTzdDLENBQUM7SUFFSjs7Ozs7O09BTUc7SUFDTyxLQUFLLENBQUMsb0JBQW9CLENBQ2xDLFVBQXlCLEVBQ3pCLGtCQUFtRDtRQUVuRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FHaEUsQ0FBQztRQUNGLElBQUksa0JBQWtCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDckMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUNELE9BQU8sQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3RDLHNFQUFzRTtRQUN0RSxtRUFBbUU7UUFDbkUsTUFBTSxFQUFFLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsb0NBQW9DLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFdkUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGtCQUFrQixJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3hGLE1BQU0sZ0JBQWdCLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzNFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDTyxrQkFBa0I7UUFDMUIsdURBQXVEO1FBQ3ZELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0I7WUFDbkMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxZQUFZLEVBQUUsZ0JBQWdCLENBQUMsRUFBRSxFQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFDLENBQUM7WUFDckUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUNULENBQUM7SUFFRCx5REFBeUQ7SUFDL0MsS0FBSyxDQUFDLHVCQUF1QixDQUFDLFVBQWtCO1FBQ3hELE1BQU0sRUFDSixJQUFJLEVBQUUsRUFBQyxNQUFNLEVBQUMsR0FDZixHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBQyxDQUFDLENBQUM7UUFDMUYsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ08sS0FBSyxDQUFDLHlCQUF5QixDQUFDLFNBQWlCLEVBQUUsa0JBQTBCO1FBQ3JGLE1BQU0sRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLFlBQVksQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUN0RixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWTtZQUN4QixHQUFHLEVBQUUsU0FBUztTQUNmLENBQUMsQ0FBQztRQUNILE1BQU0sZ0JBQWdCLEdBQUcseUJBQXlCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBRWpGLElBQUksTUFBTSxLQUFLLFNBQVMsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDNUMsR0FBRyxDQUFDLEtBQUssQ0FDUCx1Q0FBdUMsU0FBUyw2QkFBNkI7Z0JBQzNFLGtGQUFrRixDQUNyRixDQUFDO1lBQ0YsR0FBRyxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1lBRTlELElBQUksTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUMsT0FBTyxFQUFFLHNEQUFzRCxFQUFDLENBQUMsRUFBRSxDQUFDO2dCQUM1RixHQUFHLENBQUMsSUFBSSxDQUNOLG1GQUFtRixDQUNwRixDQUFDO2dCQUNGLE9BQU87WUFDVCxDQUFDO1lBQ0QsTUFBTSxJQUFJLDZCQUE2QixFQUFFLENBQUM7UUFDNUMsQ0FBQzthQUFNLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLEdBQUcsQ0FBQyxLQUFLLENBQ1AsaUJBQWlCLFNBQVMsMkNBQTJDO2dCQUNuRSwyQ0FBMkMsQ0FDOUMsQ0FBQztZQUNGLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztZQUM5RCxJQUFJLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFDLE9BQU8sRUFBRSxzREFBc0QsRUFBQyxDQUFDLEVBQUUsQ0FBQztnQkFDNUYsR0FBRyxDQUFDLElBQUksQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDO2dCQUN2RixPQUFPO1lBQ1QsQ0FBQztZQUNELE1BQU0sSUFBSSw2QkFBNkIsRUFBRSxDQUFDO1FBQzVDLENBQUM7UUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyw0REFBNEQsQ0FBQyxDQUFDLENBQUM7SUFDaEYsQ0FBQztJQUVEOzs7T0FHRztJQUNPLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxVQUF5QjtRQUMxRSxHQUFHLENBQUMsSUFBSSxDQUNOLGtGQUFrRjtZQUNoRix1Q0FBdUMsQ0FDMUMsQ0FBQztRQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0ZBQW9GLENBQUMsQ0FBQztRQUUvRixJQUFJLENBQUMsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBQyxPQUFPLEVBQUUsZ0RBQWdELEVBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUN6RixNQUFNLElBQUksNkJBQTZCLEVBQUUsQ0FBQztRQUM1QyxDQUFDO1FBRUQsd0NBQXdDO1FBQ3hDLE1BQU0sYUFBYSxHQUFHLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdELE1BQU0sYUFBYSxHQUFHO1lBQ3BCLGdDQUFnQztZQUNoQyw4QkFBOEI7WUFDOUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7U0FDN0IsQ0FBQztRQUVGLHdFQUF3RTtRQUN4RSxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBRXRELG1GQUFtRjtRQUNuRixzRkFBc0Y7UUFDdEYsbUVBQW1FO1FBQ25FLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUM7WUFDckMsR0FBRyxDQUFDLEtBQUssQ0FBQywwRUFBMEUsQ0FBQyxDQUFDO1lBQ3RGLE1BQU0sSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1FBQ3RDLENBQUM7UUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFRDs7O09BR0c7SUFDSyxLQUFLLENBQUMsMkJBQTJCO1FBQ3ZDLElBQUksQ0FBQztZQUNILE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBQy9DLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxNQUFNLEVBQUMsS0FBSyxFQUFFLElBQUksRUFBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO1lBQzVDLEdBQUcsQ0FBQyxLQUFLLENBQUMsNkRBQTZELENBQUMsQ0FBQztZQUN6RSxHQUFHLENBQUMsS0FBSyxDQUFDLDhDQUE4QyxLQUFLLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztZQUMxRSxNQUFNLElBQUksdUJBQXVCLEVBQUUsQ0FBQztRQUN0QyxDQUFDO0lBQ0gsQ0FBQztJQUVELGtGQUFrRjtJQUMxRSxLQUFLLENBQUMsMkJBQTJCLENBQUMsSUFBZ0IsRUFBRSxJQUFZO1FBQ3RFLElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO1lBQzFGLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDWCxrRkFBa0Y7WUFDbEYsdUZBQXVGO1lBQ3ZGLElBQUksZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQztnQkFDNUMsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1lBQ0QsTUFBTSxDQUFDLENBQUM7UUFDVixDQUFDO0lBQ0gsQ0FBQztJQUVELHNGQUFzRjtJQUM5RSxLQUFLLENBQUMsd0JBQXdCLENBQUMsSUFBZ0IsRUFBRSxRQUFnQjtRQUN2RSxJQUFJLFdBQVcsR0FBRyxRQUFRLENBQUM7UUFDM0IsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLE9BQU8sTUFBTSxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDakUsU0FBUyxFQUFFLENBQUM7WUFDWixXQUFXLEdBQUcsR0FBRyxRQUFRLElBQUksU0FBUyxFQUFFLENBQUM7UUFDM0MsQ0FBQztRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFRDs7O09BR0c7SUFDTyxLQUFLLENBQUMseUJBQXlCLENBQUMsVUFBa0I7UUFDMUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCwwRkFBMEY7SUFDaEYsS0FBSyxDQUFDLHNCQUFzQixDQUFDLFVBQWtCO1FBQ3ZELHdFQUF3RTtRQUN4RSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsRUFBRSxtQkFBbUIsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzFGLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNLLEtBQUssQ0FBQyxlQUFlLENBQzNCLGtCQUEwQixFQUMxQixnQkFBeUI7UUFFekIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUN0RCxpRkFBaUY7UUFDakYsMERBQTBEO1FBQzFELE1BQU0sVUFBVSxHQUFHLG1CQUFtQixDQUNwQyxFQUFDLEdBQUcsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUMsRUFDL0MsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQ3JCLENBQUM7UUFDRixNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNqRixNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7UUFDOUIsa0ZBQWtGO1FBQ2xGLGtGQUFrRjtRQUNsRixJQUFJLGdCQUFnQixFQUFFLENBQUM7WUFDckIsTUFBTSxJQUFJLENBQUMseUJBQXlCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDakQsUUFBUSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFDRCwwREFBMEQ7UUFDMUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsVUFBVSxFQUFFLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLE9BQU8sRUFBQyxJQUFJLEVBQUUsVUFBVSxFQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ08sS0FBSyxDQUFDLHFDQUFxQyxDQUNuRCxZQUFvQixFQUNwQixzQkFBOEIsRUFDOUIsS0FBYSxFQUNiLElBQWE7UUFFYixNQUFNLFFBQVEsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNoRixNQUFNLEVBQUMsSUFBSSxFQUFFLFVBQVUsRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwRixNQUFNLEVBQUMsSUFBSSxFQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO1lBQ2hELEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZO1lBQ3hCLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLElBQUksVUFBVSxFQUFFO1lBQ25DLElBQUksRUFBRSxZQUFZO1lBQ2xCLElBQUk7WUFDSixLQUFLO1NBQ04sQ0FBQyxDQUFDO1FBRUgsdUVBQXVFO1FBQ3ZFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDOUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO2dCQUNyQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWTtnQkFDeEIsWUFBWSxFQUFFLElBQUksQ0FBQyxNQUFNO2dCQUN6QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlO2FBQ3BDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQywrQkFBK0IsSUFBSSxDQUFDLE1BQU0sT0FBTyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDOUUsT0FBTztZQUNMLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNmLEdBQUcsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUNsQixJQUFJO1lBQ0osVUFBVSxFQUFFLFVBQVU7U0FDdkIsQ0FBQztJQUNKLENBQUM7SUFFRDs7OztPQUlHO0lBQ08sS0FBSyxDQUFDLDhCQUE4QixDQUFDLFlBQTBCO1FBQ3ZFLE1BQU0sWUFBWSxDQUFDLDJCQUEyQixFQUFFLENBQUM7UUFDakQsR0FBRyxDQUFDLElBQUksQ0FDTixLQUFLLENBQUMsdURBQXVELFlBQVksQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUN2RixDQUFDO0lBQ0osQ0FBQztJQUVELDBEQUEwRDtJQUNoRCxLQUFLLENBQUMsc0JBQXNCLENBQUMsVUFBa0I7UUFDdkQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNwRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVELDREQUE0RDtJQUNsRCxLQUFLLENBQUMsbUNBQW1DO1FBQ2pELElBQUksTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUMzRCxNQUFNLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQy9FLE9BQU87UUFDVCxDQUFDO1FBRUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDN0QsOEVBQThFO1FBQzlFLGlGQUFpRjtRQUNqRiwrRUFBK0U7UUFDL0UscUZBQXFGO1FBQ3JGLDJGQUEyRjtRQUMzRixxRUFBcUU7UUFDckUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLGNBQWMsRUFBRSxFQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFDLENBQUMsQ0FBQztRQUMzRSxNQUFNLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNPLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBZSxFQUFFLEtBQWU7UUFDM0Qsd0VBQXdFO1FBQ3hFLHlFQUF5RTtRQUN6RSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDaEMsbUZBQW1GO1FBQ25GLHVGQUF1RjtRQUN2Riw2RUFBNkU7UUFDN0UsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDTyxLQUFLLENBQUMsNEJBQTRCO1FBQzFDLGlGQUFpRjtRQUNqRiw0RkFBNEY7UUFDNUYsb0ZBQW9GO1FBQ3BGLHVGQUF1RjtRQUN2RixxQ0FBcUM7UUFDckMsTUFBTSxhQUFhLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FDN0QsSUFBSSxDQUFDLFVBQVUsRUFDZixJQUFJLENBQUMsY0FBYyxDQUNwQixDQUFDO1FBQ0YsTUFBTSxXQUFXLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FDMUQsSUFBSSxDQUFDLFVBQVUsRUFDZixJQUFJLENBQUMsY0FBYyxDQUNwQixDQUFDO1FBRUYsc0ZBQXNGO1FBQ3RGLHNGQUFzRjtRQUN0RixPQUFPLHFDQUFxQyxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdkYsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7O09BYUc7SUFDTyxLQUFLLENBQUMseUNBQXlDLENBQ3ZELFVBQXlCLEVBQ3pCLDZCQUE0QyxFQUM1Qyx1QkFBK0IsRUFDL0IsSUFBcUI7UUFNckIsTUFBTSxzQkFBc0IsR0FBRyx1QkFBdUIsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO1FBRXRGLGlGQUFpRjtRQUNqRixtRkFBbUY7UUFDbkYseUVBQXlFO1FBQ3pFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1lBQ1gsT0FBTztZQUNQLFNBQVM7WUFDVCxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRTtZQUN4QixhQUFhLHNCQUFzQixjQUFjLHNCQUFzQixFQUFFO1NBQzFFLENBQUMsQ0FBQztRQUVILHlFQUF5RTtRQUN6RSxNQUFNLFlBQVksR0FBRyxNQUFNLFlBQVksQ0FBQyxRQUFRLENBQzlDLElBQUksQ0FBQyxHQUFHLEVBQ1IsVUFBVSxFQUNWLHNCQUFzQixFQUN0QixNQUFNLENBQ1AsQ0FBQztRQUVGLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDbkUsTUFBTSxJQUFJLENBQUMsOEJBQThCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEQsTUFBTSxJQUFJLENBQUMsa0NBQWtDLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFMUQsMkRBQTJEO1FBQzNELE1BQU0sSUFBSSxDQUFDLG1DQUFtQyxFQUFFLENBQUM7UUFFakQsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO1FBRXhFLCtEQUErRDtRQUMvRCxNQUFNLGdCQUFnQixDQUFDLHFCQUFxQixDQUMxQyxJQUFJLENBQUMsVUFBVSxFQUNmLFVBQVUsRUFDVixxQkFBcUIsRUFDckIsSUFBSSxDQUFDLGNBQWMsQ0FDcEIsQ0FBQztRQUVGLHFEQUFxRDtRQUNyRCxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLHFCQUFxQixDQUFDLENBQUM7UUFFL0UsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMscUNBQXFDLENBQ2xFLHVCQUF1QixFQUN2QixpQkFBaUIsVUFBVSxFQUFFLEVBQzdCLHFCQUFxQixVQUFVLG1CQUFtQixDQUNuRCxDQUFDO1FBRUYsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQyxDQUFDO1FBRXhFLE9BQU8sRUFBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLHFCQUFxQixFQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVEOzs7Ozs7Ozs7OztPQVdHO0lBQ08sS0FBSyxDQUFDLDZCQUE2QixDQUMzQyxVQUF5QixFQUN6Qiw2QkFBNEMsRUFDNUMsYUFBcUIsRUFDckIsV0FBNEI7UUFPNUIsc0ZBQXNGO1FBQ3RGLG1GQUFtRjtRQUNuRix3RkFBd0Y7UUFDeEYsTUFBTSxFQUFDLEdBQUcsRUFBRSxnQkFBZ0IsRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRWxGLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixDQUFDLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRWpELE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLHlDQUF5QyxDQUN0RSxVQUFVLEVBQ1YsNkJBQTZCLEVBQzdCLGFBQWEsRUFDYixXQUFXLENBQ1osQ0FBQztRQUVGLE9BQU87WUFDTCxHQUFHLFdBQVc7WUFDZCxnQkFBZ0I7U0FDakIsQ0FBQztJQUNKLENBQUM7SUFFRDs7OztPQUlHO0lBQ08sS0FBSyxDQUFDLGlDQUFpQyxDQUMvQyxZQUEwQixFQUMxQixhQUFxQjtRQUVyQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDL0MsTUFBTSxhQUFhLEdBQUcscUNBQXFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRWxGLDRCQUE0QjtRQUM1QixNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU5QyxNQUFNLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV4RCx5Q0FBeUM7UUFDekMsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztRQUN6RSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxvREFBb0QsWUFBWSxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztRQUU5Riw0RUFBNEU7UUFDNUUsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMscUNBQXFDLENBQ2xFLFVBQVUsRUFDVix5QkFBeUIsWUFBWSxDQUFDLE9BQU8sRUFBRSxFQUMvQyxhQUFhLEVBQ2Isd0NBQXdDLGFBQWEsdUJBQXVCO1lBQzFFLFdBQVcsVUFBVSxJQUFJLENBQzVCLENBQUM7UUFFRixHQUFHLENBQUMsSUFBSSxDQUNOLEtBQUssQ0FDSCw2REFBNkQsVUFBVSxJQUFJO1lBQ3pFLG1CQUFtQixDQUN0QixDQUNGLENBQUM7UUFFRixNQUFNLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUxRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxvRkFBb0Y7SUFDMUUsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLFdBQXdCO1FBQ3hFLE1BQU0sZ0NBQWdDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNLLEtBQUssQ0FBQyw4QkFBOEIsQ0FDMUMsWUFBMEIsRUFDMUIsb0JBQTRCLEVBQzVCLFlBQXFCLEVBQ3JCLG9CQUE2QjtRQUU3QixNQUFNLE9BQU8sR0FBRyx1QkFBdUIsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUQsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQ2xDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZO1lBQ3hCLEdBQUcsRUFBRSxhQUFhLE9BQU8sRUFBRTtZQUMzQixHQUFHLEVBQUUsb0JBQW9CO1NBQzFCLENBQUMsQ0FBQztRQUNILEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixZQUFZLENBQUMsT0FBTyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFFM0UsSUFBSSxXQUFXLEdBQUcsTUFBTSxZQUFZLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUU3RCxxRUFBcUU7UUFDckUsNkRBQTZEO1FBQzdELElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxzQkFBc0IsRUFBRSxDQUFDO1lBQ2hELE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN2RixXQUFXO2dCQUNULG1EQUFtRDtvQkFDbkQsMkJBQTJCLGVBQWUsSUFBSSxDQUFDO1FBQ25ELENBQUM7UUFFRCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUM7WUFDeEMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVk7WUFDeEIsSUFBSSxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFO1lBQ3JDLFFBQVEsRUFBRSxPQUFPO1lBQ2pCLFVBQVUsRUFBRSxZQUFZO1lBQ3hCLFdBQVcsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO1lBQ3BELElBQUksRUFBRSxXQUFXO1NBQ2xCLENBQUMsQ0FBQztRQUNILEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixZQUFZLENBQUMsT0FBTyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUVELDZFQUE2RTtJQUNyRSxLQUFLLENBQUMsNEJBQTRCLENBQUMsWUFBMEIsRUFBRSxHQUFXO1FBQ2hGLE1BQU0sT0FBTyxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLDhCQUE4QixDQUFDLENBQUM7UUFDbEYsTUFBTSxXQUFXLEdBQUcsTUFBTSxZQUFZLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNsRSxPQUFPLEdBQUcsT0FBTyxJQUFJLFdBQVcsRUFBRSxDQUFDO0lBQ3JDLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7O09BWUc7SUFDTyxLQUFLLENBQUMsT0FBTyxDQUNyQixxQkFBNkMsRUFDN0MsWUFBMEIsRUFDMUIsZ0JBQXdCLEVBQ3hCLGFBQXFCLEVBQ3JCLFVBQXNCLEVBQ3RCLGlCQUFrRDtRQUVsRCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyx3Q0FBd0MsQ0FDcEUsYUFBYSxFQUNiLFlBQVksQ0FBQyxPQUFPLEVBQ3BCLGdCQUFnQixDQUNqQixDQUFDO1FBRUYsMEVBQTBFO1FBQzFFLGtFQUFrRTtRQUNsRSxNQUFNLDhCQUE4QixDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFFNUQsK0NBQStDO1FBQy9DLE1BQU0sSUFBSSxDQUFDLDhCQUE4QixDQUN2QyxZQUFZLEVBQ1osVUFBVSxFQUNWLFVBQVUsS0FBSyxNQUFNLEVBQ3JCLGlCQUFpQixDQUFDLG9CQUFvQixDQUN2QyxDQUFDO1FBRUYsMkRBQTJEO1FBQzNELEtBQUssTUFBTSxHQUFHLElBQUkscUJBQXFCLEVBQUUsQ0FBQztZQUN4QyxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUVELEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLDJDQUEyQyxDQUFDLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRUQsZ0ZBQWdGO0lBQ3hFLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxHQUFpQixFQUFFLFVBQXNCO1FBQy9FLEdBQUcsQ0FBQyxLQUFLLENBQUMsd0JBQXdCLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDO1FBQ2hELE1BQU0sT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDLGVBQWUsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7UUFFeEQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDbEYsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25CLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1gsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25CLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDYixHQUFHLENBQUMsS0FBSyxDQUFDLDZDQUE2QyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQztZQUNyRSxNQUFNLElBQUksdUJBQXVCLEVBQUUsQ0FBQztRQUN0QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7Ozs7T0FTRztJQUNLLEtBQUssQ0FBQyx3Q0FBd0MsQ0FDcEQsTUFBYyxFQUNkLE9BQXNCLEVBQ3RCLFdBQW1CO1FBRW5CLElBQUksU0FBUyxHQUFrQixJQUFJLENBQUM7UUFFcEMsMEVBQTBFO1FBQzFFLHVFQUF1RTtRQUN2RSxPQUFPLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUMxQixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUUxRCxxRUFBcUU7WUFDckUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzNFLHNFQUFzRTtnQkFDdEUsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxHQUFHLENBQUMsS0FBSyxDQUFDLHdCQUF3QixHQUFHLFNBQVMsTUFBTSxtQ0FBbUMsQ0FBQyxDQUFDO2dCQUN6RixHQUFHLENBQUMsS0FBSyxDQUFDLGtFQUFrRSxDQUFDLENBQUM7Z0JBRTlFLElBQUksTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUMsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQzdFLFNBQVM7Z0JBQ1gsQ0FBQztnQkFDRCxNQUFNLElBQUksdUJBQXVCLEVBQUUsQ0FBQztZQUN0QyxDQUFDO1lBRUQsdUZBQXVGO1lBQ3ZGLGlEQUFpRDtZQUNqRCxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLFdBQVcsRUFBRSxDQUFDO2dCQUMxQyxHQUFHLENBQUMsS0FBSyxDQUFDLDRFQUE0RSxDQUFDLENBQUM7Z0JBQ3hGLEdBQUcsQ0FBQyxLQUFLLENBQUMsNkVBQTZFLENBQUMsQ0FBQztnQkFFekYsSUFBSSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBQyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBQyxDQUFDLEVBQUUsQ0FBQztvQkFDN0UsU0FBUztnQkFDWCxDQUFDO2dCQUNELE1BQU0sSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1lBQ3RDLENBQUM7WUFFRCxTQUFTLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztRQUN6QixDQUFDO1FBRUQsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVELDJFQUEyRTtJQUMzRSx3RkFBd0Y7SUFDaEYsS0FBSyxDQUFDLHNCQUFzQixDQUFDLE9BQXNCLEVBQUUsUUFBZ0M7UUFDM0YsZ0RBQWdEO1FBQ2hELE1BQU0sbUJBQW1CLEdBQUcsd0JBQXdCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFOUQsS0FBSyxNQUFNLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMzQixNQUFNLEVBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FDOUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLGNBQWMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUN2QixDQUFDO1lBRTNDLE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDekUsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRTVFLElBQUksaUJBQWlCLEVBQUUsQ0FBQztnQkFDdEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxpREFBaUQsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7Z0JBQ3hFLEdBQUcsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLGtCQUFrQixFQUFFLENBQUMsQ0FBQztnQkFDdkQsR0FBRyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsZUFBZSxFQUFFLENBQUMsQ0FBQztnQkFDcEQsTUFBTSxJQUFJLHVCQUF1QixFQUFFLENBQUM7WUFDdEMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtwcm9taXNlcyBhcyBmcywgZXhpc3RzU3luY30gZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGgsIHtqb2lufSBmcm9tICdwYXRoJztcbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcblxuaW1wb3J0IHt3b3Jrc3BhY2VSZWxhdGl2ZVBhY2thZ2VKc29uUGF0aH0gZnJvbSAnLi4vLi4vdXRpbHMvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge2lzR2l0aHViQXBpRXJyb3J9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWIuanMnO1xuaW1wb3J0IGdpdGh1Yk1hY3JvcyBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLW1hY3Jvcy5qcyc7XG5pbXBvcnQge1xuICBnZXRGaWxlQ29udGVudHNVcmwsXG4gIGdldExpc3RDb21taXRzSW5CcmFuY2hVcmwsXG4gIGdldFJlcG9zaXRvcnlHaXRVcmwsXG59IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWItdXJscy5qcyc7XG5pbXBvcnQge2dyZWVuLCBMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7QnVpbHRQYWNrYWdlLCBCdWlsdFBhY2thZ2VXaXRoSW5mbywgUmVsZWFzZUNvbmZpZ30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7UmVsZWFzZU5vdGVzLCB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGh9IGZyb20gJy4uL25vdGVzL3JlbGVhc2Utbm90ZXMuanMnO1xuaW1wb3J0IHtOcG1EaXN0VGFnLCBQYWNrYWdlSnNvbn0gZnJvbSAnLi4vdmVyc2lvbmluZy9pbmRleC5qcyc7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7Y3JlYXRlRXhwZXJpbWVudGFsU2VtdmVyfSBmcm9tICcuLi92ZXJzaW9uaW5nL2V4cGVyaW1lbnRhbC12ZXJzaW9ucy5qcyc7XG5pbXBvcnQge05wbUNvbW1hbmR9IGZyb20gJy4uL3ZlcnNpb25pbmcvbnBtLWNvbW1hbmQuanMnO1xuaW1wb3J0IHtnZXRSZWxlYXNlVGFnRm9yVmVyc2lvbn0gZnJvbSAnLi4vdmVyc2lvbmluZy92ZXJzaW9uLXRhZ3MuanMnO1xuaW1wb3J0IHtGYXRhbFJlbGVhc2VBY3Rpb25FcnJvciwgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3J9IGZyb20gJy4vYWN0aW9ucy1lcnJvci5qcyc7XG5pbXBvcnQge1xuICBhbmFseXplQW5kRXh0ZW5kQnVpbHRQYWNrYWdlc1dpdGhJbmZvLFxuICBhc3NlcnRJbnRlZ3JpdHlPZkJ1aWx0UGFja2FnZXMsXG59IGZyb20gJy4vYnVpbHQtcGFja2FnZS1pbmZvLmpzJztcbmltcG9ydCB7XG4gIGdldENvbW1pdE1lc3NhZ2VGb3JSZWxlYXNlLFxuICBnZXRSZWxlYXNlTm90ZUNoZXJyeVBpY2tDb21taXRNZXNzYWdlLFxufSBmcm9tICcuL2NvbW1pdC1tZXNzYWdlLmpzJztcbmltcG9ydCB7Z2l0aHViUmVsZWFzZUJvZHlMaW1pdH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHtFeHRlcm5hbENvbW1hbmRzfSBmcm9tICcuL2V4dGVybmFsLWNvbW1hbmRzLmpzJztcbmltcG9ydCB7cHJvbXB0VG9Jbml0aWF0ZVB1bGxSZXF1ZXN0TWVyZ2V9IGZyb20gJy4vcHJvbXB0LW1lcmdlLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtnbG9ifSBmcm9tICdmYXN0LWdsb2InO1xuaW1wb3J0IHtQbnBtVmVyc2lvbmluZ30gZnJvbSAnLi9wbnBtLXZlcnNpb25pbmcuanMnO1xuaW1wb3J0IHtDb21taXR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9vY3Rva2l0LXR5cGVzLmpzJztcblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIGEgR2l0aHViIHJlcG9zaXRvcnkuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YlJlcG8ge1xuICBvd25lcjogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyBhIEdpdGh1YiBwdWxsIHJlcXVlc3QuICovXG5leHBvcnQgaW50ZXJmYWNlIFB1bGxSZXF1ZXN0IHtcbiAgLyoqIFVuaXF1ZSBpZCBmb3IgdGhlIHB1bGwgcmVxdWVzdCAoaS5lLiB0aGUgUFIgbnVtYmVyKS4gKi9cbiAgaWQ6IG51bWJlcjtcbiAgLyoqIFVSTCB0aGF0IHJlc29sdmVzIHRvIHRoZSBwdWxsIHJlcXVlc3QgaW4gR2l0aHViLiAqL1xuICB1cmw6IHN0cmluZztcbiAgLyoqIEZvcmsgY29udGFpbmluZyB0aGUgaGVhZCBicmFuY2ggb2YgdGhpcyBwdWxsIHJlcXVlc3QuICovXG4gIGZvcms6IEdpdGh1YlJlcG87XG4gIC8qKiBCcmFuY2ggbmFtZSBpbiB0aGUgZm9yayB0aGF0IGRlZmluZXMgdGhpcyBwdWxsIHJlcXVlc3QuICovXG4gIGZvcmtCcmFuY2g6IHN0cmluZztcbn1cblxuLyoqIE9wdGlvbnMgdGhhdCBjYW4gYmUgdXNlZCB0byBjb250cm9sIHRoZSBzdGFnaW5nIG9mIGEgbmV3IHZlcnNpb24uICovXG5leHBvcnQgaW50ZXJmYWNlIFN0YWdpbmdPcHRpb25zIHtcbiAgLyoqXG4gICAqIEFzIHBhcnQgb2Ygc3RhZ2luZywgdGhlIGBwYWNrYWdlLmpzb25gIGNhbiBiZSB1cGRhdGVkIGJlZm9yZSB0aGVcbiAgICogbmV3IHZlcnNpb24gaXMgc2V0LlxuICAgKiBAc2VlIHtSZWxlYXNlQWN0aW9uLnVwZGF0ZVByb2plY3RWZXJzaW9ufVxuICAgKi9cbiAgdXBkYXRlUGtnSnNvbkZuPzogKHBrZ0pzb246IFBhY2thZ2VKc29uKSA9PiB2b2lkO1xufVxuXG4vKiogQ29uc3RydWN0b3IgdHlwZSBmb3IgaW5zdGFudGlhdGluZyBhIHJlbGVhc2UgYWN0aW9uICovXG5leHBvcnQgaW50ZXJmYWNlIFJlbGVhc2VBY3Rpb25Db25zdHJ1Y3RvcjxUIGV4dGVuZHMgUmVsZWFzZUFjdGlvbiA9IFJlbGVhc2VBY3Rpb24+IHtcbiAgLyoqIFdoZXRoZXIgdGhlIHJlbGVhc2UgYWN0aW9uIGlzIGN1cnJlbnRseSBhY3RpdmUuICovXG4gIGlzQWN0aXZlKGFjdGl2ZTogQWN0aXZlUmVsZWFzZVRyYWlucywgY29uZmlnOiBSZWxlYXNlQ29uZmlnKTogUHJvbWlzZTxib29sZWFuPjtcbiAgLyoqIENvbnN0cnVjdHMgYSByZWxlYXNlIGFjdGlvbi4gKi9cbiAgbmV3ICguLi5hcmdzOiBbQWN0aXZlUmVsZWFzZVRyYWlucywgQXV0aGVudGljYXRlZEdpdENsaWVudCwgUmVsZWFzZUNvbmZpZywgc3RyaW5nXSk6IFQ7XG59XG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgYSByZWxlYXNlIGFjdGlvbi4gQSByZWxlYXNlIGFjdGlvbiBpcyBzZWxlY3RhYmxlIGJ5IHRoZSBjYXJldGFrZXJcbiAqIGlmIGFjdGl2ZSwgYW5kIGNhbiBwZXJmb3JtIGNoYW5nZXMgZm9yIHJlbGVhc2luZywgc3VjaCBhcyBzdGFnaW5nIGEgcmVsZWFzZSwgYnVtcGluZyB0aGVcbiAqIHZlcnNpb24sIGNoZXJyeS1waWNraW5nIHRoZSBjaGFuZ2Vsb2csIGJyYW5jaGluZyBvZmYgZnJvbSB0aGUgbWFpbiBicmFuY2guIGV0Yy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFJlbGVhc2VBY3Rpb24ge1xuICAvKiogV2hldGhlciB0aGUgcmVsZWFzZSBhY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZS4gKi9cbiAgc3RhdGljIGlzQWN0aXZlKF90cmFpbnM6IEFjdGl2ZVJlbGVhc2VUcmFpbnMsIF9jb25maWc6IFJlbGVhc2VDb25maWcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0aHJvdyBFcnJvcignTm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIGRlc2NyaXB0aW9uIGZvciBhIHJlbGVhc2UgYWN0aW9uLiAqL1xuICBhYnN0cmFjdCBnZXREZXNjcmlwdGlvbigpOiBQcm9taXNlPHN0cmluZz47XG4gIC8qKlxuICAgKiBQZXJmb3JtcyB0aGUgZ2l2ZW4gcmVsZWFzZSBhY3Rpb24uXG4gICAqIEB0aHJvd3Mge1VzZXJBYm9ydGVkUmVsZWFzZUFjdGlvbkVycm9yfSBXaGVuIHRoZSB1c2VyIG1hbnVhbGx5IGFib3J0ZWQgdGhlIGFjdGlvbi5cbiAgICogQHRocm93cyB7RmF0YWxSZWxlYXNlQWN0aW9uRXJyb3J9IFdoZW4gdGhlIGFjdGlvbiBoYXMgYmVlbiBhYm9ydGVkIGR1ZSB0byBhIGZhdGFsIGVycm9yLlxuICAgKi9cbiAgYWJzdHJhY3QgcGVyZm9ybSgpOiBQcm9taXNlPHZvaWQ+O1xuXG4gIHByb3RlY3RlZCBwbnBtVmVyc2lvbmluZyA9IG5ldyBQbnBtVmVyc2lvbmluZygpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMsXG4gICAgcHJvdGVjdGVkIGdpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCxcbiAgICBwcm90ZWN0ZWQgY29uZmlnOiBSZWxlYXNlQ29uZmlnLFxuICAgIHByb3RlY3RlZCBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICkge31cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgdmVyc2lvbiBpbiB0aGUgcHJvamVjdCB0b3AtbGV2ZWwgYHBhY2thZ2UuanNvbmAgZmlsZS5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IFNlbVZlciB2ZXJzaW9uIHRvIGJlIHNldCBpbiB0aGUgZmlsZS5cbiAgICogQHBhcmFtIGFkZGl0aW9uYWxVcGRhdGVGbiBPcHRpb25hbCB1cGRhdGUgZnVuY3Rpb24gdGhhdCBydW5zIGJlZm9yZVxuICAgKiAgIHRoZSB2ZXJzaW9uIHVwZGF0ZS4gQ2FuIGJlIHVzZWQgdG8gdXBkYXRlIG90aGVyIGZpZWxkcy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyB1cGRhdGVQcm9qZWN0VmVyc2lvbihcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGFkZGl0aW9uYWxVcGRhdGVGbj86IChwa2dKc29uOiBQYWNrYWdlSnNvbikgPT4gdm9pZCxcbiAgKSB7XG4gICAgY29uc3QgcGtnSnNvblBhdGggPSBqb2luKHRoaXMucHJvamVjdERpciwgd29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGgpO1xuICAgIGNvbnN0IHBrZ0pzb24gPSBKU09OLnBhcnNlKGF3YWl0IGZzLnJlYWRGaWxlKHBrZ0pzb25QYXRoLCAndXRmOCcpKSBhcyB7XG4gICAgICB2ZXJzaW9uOiBzdHJpbmc7XG4gICAgICBba2V5OiBzdHJpbmddOiBhbnk7XG4gICAgfTtcbiAgICBpZiAoYWRkaXRpb25hbFVwZGF0ZUZuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFkZGl0aW9uYWxVcGRhdGVGbihwa2dKc29uKTtcbiAgICB9XG4gICAgcGtnSnNvbi52ZXJzaW9uID0gbmV3VmVyc2lvbi5mb3JtYXQoKTtcbiAgICAvLyBXcml0ZSB0aGUgYHBhY2thZ2UuanNvbmAgZmlsZS4gTm90ZSB0aGF0IHdlIGFkZCBhIHRyYWlsaW5nIG5ldyBsaW5lXG4gICAgLy8gdG8gYXZvaWQgdW5uZWNlc3NhcnkgZGlmZi4gSURFcyB1c3VhbGx5IGFkZCBhIHRyYWlsaW5nIG5ldyBsaW5lLlxuICAgIGF3YWl0IGZzLndyaXRlRmlsZShwa2dKc29uUGF0aCwgYCR7SlNPTi5zdHJpbmdpZnkocGtnSnNvbiwgbnVsbCwgMil9XFxuYCk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVXBkYXRlZCBwcm9qZWN0IHZlcnNpb24gdG8gJHtwa2dKc29uLnZlcnNpb259YCkpO1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLnJ1bGVzSnNJbnRlcm9wTW9kZSAmJiBleGlzdHNTeW5jKHBhdGguam9pbih0aGlzLnByb2plY3REaXIsICcuYXNwZWN0JykpKSB7XG4gICAgICBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZUJhemVsVXBkYXRlQXNwZWN0TG9ja0ZpbGVzKHRoaXMucHJvamVjdERpcik7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogR2V0IHRoZSBtb2RpZmllZCBBc3BlY3QgbG9jayBmaWxlcyBpZiBgcnVsZXNKc0ludGVyb3BNb2RlYCBpcyBlbmFibGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldEFzcGVjdExvY2tGaWxlcygpOiBzdHJpbmdbXSB7XG4gICAgLy8gVE9ETzogUmVtb3ZlIGFmdGVyIGBydWxlc19qc2AgbWlncmF0aW9uIGlzIGNvbXBsZXRlLlxuICAgIHJldHVybiB0aGlzLmNvbmZpZy5ydWxlc0pzSW50ZXJvcE1vZGVcbiAgICAgID8gZ2xvYi5zeW5jKFsnLmFzcGVjdC8qKicsICdwbnBtLWxvY2sueWFtbCddLCB7Y3dkOiB0aGlzLnByb2plY3REaXJ9KVxuICAgICAgOiBbXTtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBtb3N0IHJlY2VudCBjb21taXQgb2YgYSBzcGVjaWZpZWQgYnJhbmNoLiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgZ2V0TGF0ZXN0Q29tbWl0T2ZCcmFuY2goYnJhbmNoTmFtZTogc3RyaW5nKTogUHJvbWlzZTxDb21taXQ+IHtcbiAgICBjb25zdCB7XG4gICAgICBkYXRhOiB7Y29tbWl0fSxcbiAgICB9ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnJlcG9zLmdldEJyYW5jaCh7Li4udGhpcy5naXQucmVtb3RlUGFyYW1zLCBicmFuY2g6IGJyYW5jaE5hbWV9KTtcbiAgICByZXR1cm4gY29tbWl0O1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlIGdpdmVuIGNvbW1pdCBoYXMgcGFzc2luZyBhbGwgc3RhdHVzZXMuXG4gICAqXG4gICAqIFVwb24gZXJyb3IsIGEgbGluayB0byB0aGUgYnJhbmNoIGNvbnRhaW5pbmcgdGhlIGNvbW1pdCBpcyBwcmludGVkLFxuICAgKiBhbGxvd2luZyB0aGUgY2FyZXRha2VyIHRvIHF1aWNrbHkgaW5zcGVjdCB0aGUgR2l0SHViIGNvbW1pdCBzdGF0dXMgZmFpbHVyZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgYXNzZXJ0UGFzc2luZ0dpdGh1YlN0YXR1cyhjb21taXRTaGE6IHN0cmluZywgYnJhbmNoTmFtZUZvckVycm9yOiBzdHJpbmcpIHtcbiAgICBjb25zdCB7cmVzdWx0fSA9IGF3YWl0IGdpdGh1Yk1hY3Jvcy5nZXRDb21iaW5lZENoZWNrc0FuZFN0YXR1c2VzRm9yUmVmKHRoaXMuZ2l0LmdpdGh1Yiwge1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgcmVmOiBjb21taXRTaGEsXG4gICAgfSk7XG4gICAgY29uc3QgYnJhbmNoQ29tbWl0c1VybCA9IGdldExpc3RDb21taXRzSW5CcmFuY2hVcmwodGhpcy5naXQsIGJyYW5jaE5hbWVGb3JFcnJvcik7XG5cbiAgICBpZiAocmVzdWx0ID09PSAnZmFpbGluZycgfHwgcmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBMb2cuZXJyb3IoXG4gICAgICAgIGAgIOKcmCAgIENhbm5vdCBzdGFnZSByZWxlYXNlLiBDb21taXQgXCIke2NvbW1pdFNoYX1cIiBkb2VzIG5vdCBwYXNzIGFsbCBnaXRodWIgYCArXG4gICAgICAgICAgJ3N0YXR1cyBjaGVja3MuIFBsZWFzZSBtYWtlIHN1cmUgdGhpcyBjb21taXQgcGFzc2VzIGFsbCBjaGVja3MgYmVmb3JlIHJlLXJ1bm5pbmcuJyxcbiAgICAgICk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIFBsZWFzZSBoYXZlIGEgbG9vayBhdDogJHticmFuY2hDb21taXRzVXJsfWApO1xuXG4gICAgICBpZiAoYXdhaXQgUHJvbXB0LmNvbmZpcm0oe21lc3NhZ2U6ICdEbyB5b3Ugd2FudCB0byBpZ25vcmUgdGhlIEdpdGh1YiBzdGF0dXMgYW5kIHByb2NlZWQ/J30pKSB7XG4gICAgICAgIExvZy53YXJuKFxuICAgICAgICAgICcgIOKaoCAgIFVwc3RyZWFtIGNvbW1pdCBpcyBmYWlsaW5nIENJIGNoZWNrcywgYnV0IHN0YXR1cyBoYXMgYmVlbiBmb3JjaWJseSBpZ25vcmVkLicsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH0gZWxzZSBpZiAocmVzdWx0ID09PSAncGVuZGluZycpIHtcbiAgICAgIExvZy5lcnJvcihcbiAgICAgICAgYCAg4pyYICAgQ29tbWl0IFwiJHtjb21taXRTaGF9XCIgc3RpbGwgaGFzIHBlbmRpbmcgZ2l0aHViIHN0YXR1c2VzIHRoYXQgYCArXG4gICAgICAgICAgJ25lZWQgdG8gc3VjY2VlZCBiZWZvcmUgc3RhZ2luZyBhIHJlbGVhc2UuJyxcbiAgICAgICk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIFBsZWFzZSBoYXZlIGEgbG9vayBhdDogJHticmFuY2hDb21taXRzVXJsfWApO1xuICAgICAgaWYgKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gaWdub3JlIHRoZSBHaXRodWIgc3RhdHVzIGFuZCBwcm9jZWVkPyd9KSkge1xuICAgICAgICBMb2cud2FybignICDimqAgICBVcHN0cmVhbSBjb21taXQgaXMgcGVuZGluZyBDSSwgYnV0IHN0YXR1cyBoYXMgYmVlbiBmb3JjaWJseSBpZ25vcmVkLicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBVcHN0cmVhbSBjb21taXQgaXMgcGFzc2luZyBhbGwgZ2l0aHViIHN0YXR1cyBjaGVja3MuJykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb21wdHMgdGhlIHVzZXIgZm9yIHBvdGVudGlhbCByZWxlYXNlIG5vdGVzIGVkaXRzIHRoYXQgbmVlZCB0byBiZSBtYWRlLiBPbmNlXG4gICAqIGNvbmZpcm1lZCwgYSBuZXcgY29tbWl0IGZvciB0aGUgcmVsZWFzZSBwb2ludCBpcyBjcmVhdGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHdhaXRGb3JFZGl0c0FuZENyZWF0ZVJlbGVhc2VDb21taXQobmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcikge1xuICAgIExvZy53YXJuKFxuICAgICAgJyAg4pqgICAgUGxlYXNlIHJldmlldyB0aGUgY2hhbmdlbG9nIGFuZCBlbnN1cmUgdGhhdCB0aGUgbG9nIGNvbnRhaW5zIG9ubHkgY2hhbmdlcyAnICtcbiAgICAgICAgJ3RoYXQgYXBwbHkgdG8gdGhlIHB1YmxpYyBBUEkgc3VyZmFjZS4nLFxuICAgICk7XG4gICAgTG9nLndhcm4oJyAgICAgIE1hbnVhbCBjaGFuZ2VzIGNhbiBiZSBtYWRlLiBXaGVuIGRvbmUsIHBsZWFzZSBwcm9jZWVkIHdpdGggdGhlIHByb21wdCBiZWxvdy4nKTtcblxuICAgIGlmICghKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gcHJvY2VlZCBhbmQgY29tbWl0IHRoZSBjaGFuZ2VzPyd9KSkpIHtcbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cblxuICAgIC8vIENvbW1pdCBtZXNzYWdlIGZvciB0aGUgcmVsZWFzZSBwb2ludC5cbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gZ2V0Q29tbWl0TWVzc2FnZUZvclJlbGVhc2UobmV3VmVyc2lvbik7XG4gICAgY29uc3QgZmlsZXNUb0NvbW1pdCA9IFtcbiAgICAgIHdvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRoLFxuICAgICAgd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoLFxuICAgICAgLi4udGhpcy5nZXRBc3BlY3RMb2NrRmlsZXMoKSxcbiAgICBdO1xuXG4gICAgLy8gQ3JlYXRlIGEgcmVsZWFzZSBzdGFnaW5nIGNvbW1pdCBpbmNsdWRpbmcgY2hhbmdlbG9nIGFuZCB2ZXJzaW9uIGJ1bXAuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVDb21taXQoY29tbWl0TWVzc2FnZSwgZmlsZXNUb0NvbW1pdCk7XG5cbiAgICAvLyBUaGUgY2FyZXRha2VyIG1heSBoYXZlIGF0dGVtcHRlZCB0byBtYWtlIGFkZGl0aW9uYWwgY2hhbmdlcy4gVGhlc2UgY2hhbmdlcyB3b3VsZFxuICAgIC8vIG5vdCBiZSBjYXB0dXJlZCBpbnRvIHRoZSByZWxlYXNlIGNvbW1pdC4gVGhlIHdvcmtpbmcgZGlyZWN0b3J5IHNob3VsZCByZW1haW4gY2xlYW4sXG4gICAgLy8gbGlrZSB3ZSBhc3N1bWUgaXQgYmVpbmcgY2xlYW4gd2hlbiB3ZSBzdGFydCB0aGUgcmVsZWFzZSBhY3Rpb25zLlxuICAgIGlmICh0aGlzLmdpdC5oYXNVbmNvbW1pdHRlZENoYW5nZXMoKSkge1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIFVucmVsYXRlZCBjaGFuZ2VzIGhhdmUgYmVlbiBtYWRlIGFzIHBhcnQgb2YgdGhlIGNoYW5nZWxvZyBlZGl0aW5nLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCByZWxlYXNlIGNvbW1pdCBmb3I6IFwiJHtuZXdWZXJzaW9ufVwiLmApKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFuIG93bmVkIGZvcmsgZm9yIHRoZSBjb25maWd1cmVkIHByb2plY3Qgb2YgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlci4gQWJvcnRzIHRoZVxuICAgKiBwcm9jZXNzIHdpdGggYW4gZXJyb3IgaWYgbm8gZm9yayBjb3VsZCBiZSBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX2dldEZvcmtPZkF1dGhlbnRpY2F0ZWRVc2VyKCk6IFByb21pc2U8R2l0aHViUmVwbz4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5naXQuZ2V0Rm9ya09mQXV0aGVudGljYXRlZFVzZXIoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHtvd25lciwgbmFtZX0gPSB0aGlzLmdpdC5yZW1vdGVDb25maWc7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVW5hYmxlIHRvIGZpbmQgZm9yayBmb3IgY3VycmVudGx5IGF1dGhlbnRpY2F0ZWQgdXNlci4nKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgUGxlYXNlIGVuc3VyZSB5b3UgY3JlYXRlZCBhIGZvcmsgb2Y6ICR7b3duZXJ9LyR7bmFtZX0uYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKiogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBicmFuY2ggbmFtZSBpcyByZXNlcnZlZCBpbiB0aGUgc3BlY2lmaWVkIHJlcG9zaXRvcnkuICovXG4gIHByaXZhdGUgYXN5bmMgX2lzQnJhbmNoTmFtZVJlc2VydmVkSW5SZXBvKHJlcG86IEdpdGh1YlJlcG8sIG5hbWU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuZ2V0QnJhbmNoKHtvd25lcjogcmVwby5vd25lciwgcmVwbzogcmVwby5uYW1lLCBicmFuY2g6IG5hbWV9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIElmIHRoZSBlcnJvciBoYXMgYSBgc3RhdHVzYCBwcm9wZXJ0eSBzZXQgdG8gYDQwNGAsIHRoZW4gd2Uga25vdyB0aGF0IHRoZSBicmFuY2hcbiAgICAgIC8vIGRvZXMgbm90IGV4aXN0LiBPdGhlcndpc2UsIGl0IG1pZ2h0IGJlIGFuIEFQSSBlcnJvciB0aGF0IHdlIHdhbnQgdG8gcmVwb3J0L3JlLXRocm93LlxuICAgICAgaWYgKGlzR2l0aHViQXBpRXJyb3IoZSkgJiYgZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBGaW5kcyBhIG5vbi1yZXNlcnZlZCBicmFuY2ggbmFtZSBpbiB0aGUgcmVwb3NpdG9yeSB3aXRoIHJlc3BlY3QgdG8gYSBiYXNlIG5hbWUuICovXG4gIHByaXZhdGUgYXN5bmMgX2ZpbmRBdmFpbGFibGVCcmFuY2hOYW1lKHJlcG86IEdpdGh1YlJlcG8sIGJhc2VOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGxldCBjdXJyZW50TmFtZSA9IGJhc2VOYW1lO1xuICAgIGxldCBzdWZmaXhOdW0gPSAwO1xuICAgIHdoaWxlIChhd2FpdCB0aGlzLl9pc0JyYW5jaE5hbWVSZXNlcnZlZEluUmVwbyhyZXBvLCBjdXJyZW50TmFtZSkpIHtcbiAgICAgIHN1ZmZpeE51bSsrO1xuICAgICAgY3VycmVudE5hbWUgPSBgJHtiYXNlTmFtZX1fJHtzdWZmaXhOdW19YDtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnJlbnROYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsb2NhbCBicmFuY2ggZnJvbSB0aGUgY3VycmVudCBHaXQgYEhFQURgLiBXaWxsIG92ZXJyaWRlXG4gICAqIGV4aXN0aW5nIGJyYW5jaGVzIGluIGNhc2Ugb2YgYSBjb2xsaXNpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctcScsICctQicsIGJyYW5jaE5hbWVdKTtcbiAgfVxuXG4gIC8qKiBQdXNoZXMgdGhlIGN1cnJlbnQgR2l0IGBIRUFEYCB0byB0aGUgZ2l2ZW4gcmVtb3RlIGJyYW5jaCBpbiB0aGUgY29uZmlndXJlZCBwcm9qZWN0LiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgcHVzaEhlYWRUb1JlbW90ZUJyYW5jaChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICAvLyBQdXNoIHRoZSBsb2NhbCBgSEVBRGAgdG8gdGhlIHJlbW90ZSBicmFuY2ggaW4gdGhlIGNvbmZpZ3VyZWQgcHJvamVjdC5cbiAgICB0aGlzLmdpdC5ydW4oWydwdXNoJywgJy1xJywgdGhpcy5naXQuZ2V0UmVwb0dpdFVybCgpLCBgSEVBRDpyZWZzL2hlYWRzLyR7YnJhbmNoTmFtZX1gXSk7XG4gIH1cblxuICAvKipcbiAgICogUHVzaGVzIHRoZSBjdXJyZW50IEdpdCBgSEVBRGAgdG8gYSBmb3JrIGZvciB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgaXMgb3duZWQgYnlcbiAgICogdGhlIGF1dGhlbnRpY2F0ZWQgdXNlci4gSWYgdGhlIHNwZWNpZmllZCBicmFuY2ggbmFtZSBleGlzdHMgaW4gdGhlIGZvcmsgYWxyZWFkeSwgYVxuICAgKiB1bmlxdWUgb25lIHdpbGwgYmUgZ2VuZXJhdGVkIGJhc2VkIG9uIHRoZSBwcm9wb3NlZCBuYW1lIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gICAqIEBwYXJhbSBwcm9wb3NlZEJyYW5jaE5hbWUgUHJvcG9zZWQgYnJhbmNoIG5hbWUgZm9yIHRoZSBmb3JrLlxuICAgKiBAcGFyYW0gdHJhY2tMb2NhbEJyYW5jaCBXaGV0aGVyIHRoZSBmb3JrIGJyYW5jaCBzaG91bGQgYmUgdHJhY2tlZCBsb2NhbGx5LiBpLmUuIHdoZXRoZXJcbiAgICogICBhIGxvY2FsIGJyYW5jaCB3aXRoIHJlbW90ZSB0cmFja2luZyBzaG91bGQgYmUgc2V0IHVwLlxuICAgKiBAcmV0dXJucyBUaGUgZm9yayBhbmQgYnJhbmNoIG5hbWUgY29udGFpbmluZyB0aGUgcHVzaGVkIGNoYW5nZXMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9wdXNoSGVhZFRvRm9yayhcbiAgICBwcm9wb3NlZEJyYW5jaE5hbWU6IHN0cmluZyxcbiAgICB0cmFja0xvY2FsQnJhbmNoOiBib29sZWFuLFxuICApOiBQcm9taXNlPHtmb3JrOiBHaXRodWJSZXBvOyBicmFuY2hOYW1lOiBzdHJpbmd9PiB7XG4gICAgY29uc3QgZm9yayA9IGF3YWl0IHRoaXMuX2dldEZvcmtPZkF1dGhlbnRpY2F0ZWRVc2VyKCk7XG4gICAgLy8gQ29tcHV0ZSBhIHJlcG9zaXRvcnkgVVJMIGZvciBwdXNoaW5nIHRvIHRoZSBmb3JrLiBOb3RlIHRoYXQgd2Ugd2FudCB0byByZXNwZWN0XG4gICAgLy8gdGhlIFNTSCBvcHRpb24gZnJvbSB0aGUgZGV2LWluZnJhIGdpdGh1YiBjb25maWd1cmF0aW9uLlxuICAgIGNvbnN0IHJlcG9HaXRVcmwgPSBnZXRSZXBvc2l0b3J5R2l0VXJsKFxuICAgICAgey4uLmZvcmssIHVzZVNzaDogdGhpcy5naXQucmVtb3RlQ29uZmlnLnVzZVNzaH0sXG4gICAgICB0aGlzLmdpdC5naXRodWJUb2tlbixcbiAgICApO1xuICAgIGNvbnN0IGJyYW5jaE5hbWUgPSBhd2FpdCB0aGlzLl9maW5kQXZhaWxhYmxlQnJhbmNoTmFtZShmb3JrLCBwcm9wb3NlZEJyYW5jaE5hbWUpO1xuICAgIGNvbnN0IHB1c2hBcmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIC8vIElmIGEgbG9jYWwgYnJhbmNoIHNob3VsZCB0cmFjayB0aGUgcmVtb3RlIGZvcmsgYnJhbmNoLCBjcmVhdGUgYSBicmFuY2ggbWF0Y2hpbmdcbiAgICAvLyB0aGUgcmVtb3RlIGJyYW5jaC4gTGF0ZXIgd2l0aCB0aGUgYGdpdCBwdXNoYCwgdGhlIHJlbW90ZSBpcyBzZXQgZm9yIHRoZSBicmFuY2guXG4gICAgaWYgKHRyYWNrTG9jYWxCcmFuY2gpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZChicmFuY2hOYW1lKTtcbiAgICAgIHB1c2hBcmdzLnB1c2goJy0tc2V0LXVwc3RyZWFtJyk7XG4gICAgfVxuICAgIC8vIFB1c2ggdGhlIGxvY2FsIGBIRUFEYCB0byB0aGUgcmVtb3RlIGJyYW5jaCBpbiB0aGUgZm9yay5cbiAgICB0aGlzLmdpdC5ydW4oWydwdXNoJywgJy1xJywgcmVwb0dpdFVybCwgYEhFQUQ6cmVmcy9oZWFkcy8ke2JyYW5jaE5hbWV9YCwgLi4ucHVzaEFyZ3NdKTtcbiAgICByZXR1cm4ge2ZvcmssIGJyYW5jaE5hbWV9O1xuICB9XG5cbiAgLyoqXG4gICAqIFB1c2hlcyBjaGFuZ2VzIHRvIGEgZm9yayBmb3IgdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCB0aGF0IGlzIG93bmVkIGJ5IHRoZSBjdXJyZW50bHlcbiAgICogYXV0aGVudGljYXRlZCB1c2VyLiBBIHB1bGwgcmVxdWVzdCBpcyB0aGVuIGNyZWF0ZWQgZm9yIHRoZSBwdXNoZWQgY2hhbmdlcyBvbiB0aGVcbiAgICogY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgdGFyZ2V0cyB0aGUgc3BlY2lmaWVkIHRhcmdldCBicmFuY2guXG4gICAqIEByZXR1cm5zIEFuIG9iamVjdCBkZXNjcmliaW5nIHRoZSBjcmVhdGVkIHB1bGwgcmVxdWVzdC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBwdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgIHRhcmdldEJyYW5jaDogc3RyaW5nLFxuICAgIHByb3Bvc2VkRm9ya0JyYW5jaE5hbWU6IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIGJvZHk/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8UHVsbFJlcXVlc3Q+IHtcbiAgICBjb25zdCByZXBvU2x1ZyA9IGAke3RoaXMuZ2l0LnJlbW90ZVBhcmFtcy5vd25lcn0vJHt0aGlzLmdpdC5yZW1vdGVQYXJhbXMucmVwb31gO1xuICAgIGNvbnN0IHtmb3JrLCBicmFuY2hOYW1lfSA9IGF3YWl0IHRoaXMuX3B1c2hIZWFkVG9Gb3JrKHByb3Bvc2VkRm9ya0JyYW5jaE5hbWUsIHRydWUpO1xuICAgIGNvbnN0IHtkYXRhfSA9IGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5wdWxscy5jcmVhdGUoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgaGVhZDogYCR7Zm9yay5vd25lcn06JHticmFuY2hOYW1lfWAsXG4gICAgICBiYXNlOiB0YXJnZXRCcmFuY2gsXG4gICAgICBib2R5LFxuICAgICAgdGl0bGUsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgbGFiZWxzIHRvIHRoZSBuZXdseSBjcmVhdGVkIFBSIGlmIHByb3ZpZGVkIGluIHRoZSBjb25maWd1cmF0aW9uLlxuICAgIGlmICh0aGlzLmNvbmZpZy5yZWxlYXNlUHJMYWJlbHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLmlzc3Vlcy5hZGRMYWJlbHMoe1xuICAgICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICAgIGlzc3VlX251bWJlcjogZGF0YS5udW1iZXIsXG4gICAgICAgIGxhYmVsczogdGhpcy5jb25maWcucmVsZWFzZVByTGFiZWxzLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCBwdWxsIHJlcXVlc3QgIyR7ZGF0YS5udW1iZXJ9IGluICR7cmVwb1NsdWd9LmApKTtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGRhdGEubnVtYmVyLFxuICAgICAgdXJsOiBkYXRhLmh0bWxfdXJsLFxuICAgICAgZm9yayxcbiAgICAgIGZvcmtCcmFuY2g6IGJyYW5jaE5hbWUsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwZW5kIHJlbGVhc2VzIG5vdGVzIGZvciBhIHZlcnNpb24gcHVibGlzaGVkIGluIGEgZ2l2ZW4gYnJhbmNoIHRvIHRoZSBjaGFuZ2Vsb2cgaW5cbiAgICogdGhlIGN1cnJlbnQgR2l0IGBIRUFEYC4gVGhpcyBpcyB1c2VmdWwgZm9yIGNoZXJyeS1waWNraW5nIHRoZSBjaGFuZ2Vsb2cuXG4gICAqIEByZXR1cm5zIEEgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHJlbGVhc2Ugbm90ZXMgaGF2ZSBiZWVuIHByZXBlbmRlZC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBwcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCByZWxlYXNlTm90ZXMucHJlcGVuZEVudHJ5VG9DaGFuZ2Vsb2dGaWxlKCk7XG4gICAgTG9nLmluZm8oXG4gICAgICBncmVlbihgICDinJMgICBVcGRhdGVkIHRoZSBjaGFuZ2Vsb2cgdG8gY2FwdHVyZSBjaGFuZ2VzIGZvciBcIiR7cmVsZWFzZU5vdGVzLnZlcnNpb259XCIuYCksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBDaGVja3Mgb3V0IGFuIHVwc3RyZWFtIGJyYW5jaCB3aXRoIGEgZGV0YWNoZWQgaGVhZC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNoZWNrb3V0VXBzdHJlYW1CcmFuY2goYnJhbmNoTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5naXQucnVuKFsnZmV0Y2gnLCAnLXEnLCB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksIGJyYW5jaE5hbWVdKTtcbiAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctcScsICdGRVRDSF9IRUFEJywgJy0tZGV0YWNoJ10pO1xuICB9XG5cbiAgLyoqIEluc3RhbGxzIGFsbCBZYXJuIGRlcGVuZGVuY2llcyBpbiB0aGUgY3VycmVudCBicmFuY2guICovXG4gIHByb3RlY3RlZCBhc3luYyBpbnN0YWxsRGVwZW5kZW5jaWVzRm9yQ3VycmVudEJyYW5jaCgpIHtcbiAgICBpZiAoYXdhaXQgdGhpcy5wbnBtVmVyc2lvbmluZy5pc1VzaW5nUG5wbSh0aGlzLnByb2plY3REaXIpKSB7XG4gICAgICBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZVBucG1JbnN0YWxsKHRoaXMucHJvamVjdERpciwgdGhpcy5wbnBtVmVyc2lvbmluZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZU1vZHVsZXNEaXIgPSBqb2luKHRoaXMucHJvamVjdERpciwgJ25vZGVfbW9kdWxlcycpO1xuICAgIC8vIE5vdGU6IFdlIGRlbGV0ZSBhbGwgY29udGVudHMgb2YgdGhlIGBub2RlX21vZHVsZXNgIGZpcnN0LiBUaGlzIGlzIG5lY2Vzc2FyeVxuICAgIC8vIGJlY2F1c2UgWWFybiBjb3VsZCBwcmVzZXJ2ZSBleHRyYW5lb3VzL291dGRhdGVkIG5lc3RlZCBtb2R1bGVzIHRoYXQgd2lsbCBjYXVzZVxuICAgIC8vIHVuZXhwZWN0ZWQgYnVpbGQgZmFpbHVyZXMgd2l0aCB0aGUgTm9kZUpTIEJhemVsIGBAbnBtYCB3b3Jrc3BhY2UgZ2VuZXJhdGlvbi5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3I6IGh0dHBzOi8vZ2l0aHViLmNvbS95YXJucGtnL3lhcm4vaXNzdWVzLzgxNDYuIEV2ZW4gdGhvdWdoXG4gICAgLy8gd2UgbWlnaHQgYmUgYWJsZSB0byBmaXggdGhpcyB3aXRoIFlhcm4gMissIGl0IGlzIHJlYXNvbmFibGUgZW5zdXJpbmcgY2xlYW4gbm9kZSBtb2R1bGVzLlxuICAgIC8vIFRPRE86IFJlbW92ZSB0aGlzIHdoZW4gd2UgdXNlIFlhcm4gMisgaW4gYWxsIEFuZ3VsYXIgcmVwb3NpdG9yaWVzLlxuICAgIGF3YWl0IGZzLnJtKG5vZGVNb2R1bGVzRGlyLCB7Zm9yY2U6IHRydWUsIHJlY3Vyc2l2ZTogdHJ1ZSwgbWF4UmV0cmllczogM30pO1xuICAgIGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlWWFybkluc3RhbGwodGhpcy5wcm9qZWN0RGlyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgY29tbWl0IGZvciB0aGUgc3BlY2lmaWVkIGZpbGVzIHdpdGggdGhlIGdpdmVuIG1lc3NhZ2UuXG4gICAqIEBwYXJhbSBtZXNzYWdlIE1lc3NhZ2UgZm9yIHRoZSBjcmVhdGVkIGNvbW1pdFxuICAgKiBAcGFyYW0gZmlsZXMgTGlzdCBvZiBwcm9qZWN0LXJlbGF0aXZlIGZpbGUgcGF0aHMgdG8gYmUgY29tbWl0dGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNyZWF0ZUNvbW1pdChtZXNzYWdlOiBzdHJpbmcsIGZpbGVzOiBzdHJpbmdbXSkge1xuICAgIC8vIE5vdGU6IGBnaXQgYWRkYCB3b3VsZCBub3QgYmUgbmVlZGVkIGlmIHRoZSBmaWxlcyBhcmUgYWxyZWFkeSBrbm93biB0b1xuICAgIC8vIEdpdCwgYnV0IHRoZSBzcGVjaWZpZWQgZmlsZXMgY291bGQgYWxzbyBiZSBuZXdseSBjcmVhdGVkLCBhbmQgdW5rbm93bi5cbiAgICB0aGlzLmdpdC5ydW4oWydhZGQnLCAuLi5maWxlc10pO1xuICAgIC8vIE5vdGU6IGAtLW5vLXZlcmlmeWAgc2tpcHMgdGhlIG1ham9yaXR5IG9mIGNvbW1pdCBob29rcyBoZXJlLCBidXQgdGhlcmUgYXJlIGhvb2tzXG4gICAgLy8gbGlrZSBgcHJlcGFyZS1jb21taXQtbWVzc2FnZWAgd2hpY2ggc3RpbGwgcnVuLiBXZSBoYXZlIHNldCB0aGUgYEhVU0tZPTBgIGVudmlyb25tZW50XG4gICAgLy8gdmFyaWFibGUgYXQgdGhlIHN0YXJ0IG9mIHRoZSBwdWJsaXNoIGNvbW1hbmQgdG8gaWdub3JlIHN1Y2ggaG9va3MgYXMgd2VsbC5cbiAgICB0aGlzLmdpdC5ydW4oWydjb21taXQnLCAnLXEnLCAnLS1uby12ZXJpZnknLCAnLW0nLCBtZXNzYWdlLCAuLi5maWxlc10pO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyB0aGUgcmVsZWFzZSBvdXRwdXQgZm9yIHRoZSBjdXJyZW50IGJyYW5jaC4gQXNzdW1lcyB0aGUgbm9kZSBtb2R1bGVzXG4gICAqIHRvIGJlIGFscmVhZHkgaW5zdGFsbGVkIGZvciB0aGUgY3VycmVudCBicmFuY2guXG4gICAqXG4gICAqIEByZXR1cm5zIEEgbGlzdCBvZiBidWlsdCByZWxlYXNlIHBhY2thZ2VzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGJ1aWxkUmVsZWFzZUZvckN1cnJlbnRCcmFuY2goKTogUHJvbWlzZTxCdWlsdFBhY2thZ2VXaXRoSW5mb1tdPiB7XG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvIG5vdCBkaXJlY3RseSBjYWxsIHRoZSBidWlsZCBwYWNrYWdlcyBmdW5jdGlvbiBmcm9tIHRoZSByZWxlYXNlXG4gICAgLy8gY29uZmlnLiBXZSBvbmx5IHdhbnQgdG8gYnVpbGQgYW5kIHB1Ymxpc2ggcGFja2FnZXMgdGhhdCBoYXZlIGJlZW4gY29uZmlndXJlZCBpbiB0aGUgZ2l2ZW5cbiAgICAvLyBwdWJsaXNoIGJyYW5jaC4gZS5nLiBjb25zaWRlciB3ZSBwdWJsaXNoIHBhdGNoIHZlcnNpb24gYW5kIGEgbmV3IHBhY2thZ2UgaGFzIGJlZW5cbiAgICAvLyBjcmVhdGVkIGluIHRoZSBgbmV4dGAgYnJhbmNoLiBUaGUgbmV3IHBhY2thZ2Ugd291bGQgbm90IGJlIHBhcnQgb2YgdGhlIHBhdGNoIGJyYW5jaCxcbiAgICAvLyBzbyB3ZSBjYW5ub3QgYnVpbGQgYW5kIHB1Ymxpc2ggaXQuXG4gICAgY29uc3QgYnVpbHRQYWNrYWdlcyA9IGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlUmVsZWFzZUJ1aWxkKFxuICAgICAgdGhpcy5wcm9qZWN0RGlyLFxuICAgICAgdGhpcy5wbnBtVmVyc2lvbmluZyxcbiAgICApO1xuICAgIGNvbnN0IHJlbGVhc2VJbmZvID0gYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlSW5mbyhcbiAgICAgIHRoaXMucHJvamVjdERpcixcbiAgICAgIHRoaXMucG5wbVZlcnNpb25pbmcsXG4gICAgKTtcblxuICAgIC8vIEV4dGVuZCB0aGUgYnVpbHQgcGFja2FnZXMgd2l0aCB0aGVpciBkaXNrIGhhc2ggYW5kIE5QTSBwYWNrYWdlIGluZm9ybWF0aW9uLiBUaGlzIGlzXG4gICAgLy8gaGVscGZ1bCBsYXRlciBmb3IgdmVyaWZ5aW5nIGludGVncml0eSBhbmQgZmlsdGVyaW5nIG91dCBlLmcuIGV4cGVyaW1lbnRhbCBwYWNrYWdlcy5cbiAgICByZXR1cm4gYW5hbHl6ZUFuZEV4dGVuZEJ1aWx0UGFja2FnZXNXaXRoSW5mbyhidWlsdFBhY2thZ2VzLCByZWxlYXNlSW5mby5ucG1QYWNrYWdlcyk7XG4gIH1cblxuICAvKipcbiAgICogU3RhZ2VzIHRoZSBzcGVjaWZpZWQgbmV3IHZlcnNpb24gZm9yIHRoZSBjdXJyZW50IGJyYW5jaCwgYnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCxcbiAgICogdmVyaWZpZXMgaXRzIG91dHB1dCBhbmQgY3JlYXRlcyBhIHB1bGwgcmVxdWVzdCAgdGhhdCB0YXJnZXRzIHRoZSBnaXZlbiBiYXNlIGJyYW5jaC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgYXNzdW1lcyB0aGUgc3RhZ2luZyBicmFuY2ggaXMgYWxyZWFkeSBjaGVja2VkLW91dC5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IHZlcnNpb24gdG8gYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgVmVyc2lvbiB1c2VkIGZvciBjb21wYXJpbmcgd2l0aCB0aGUgY3VycmVudFxuICAgKiAgIGBIRUFEYCBpbiBvcmRlciBidWlsZCB0aGUgcmVsZWFzZSBub3Rlcy5cbiAgICogQHBhcmFtIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoIEJyYW5jaCB0aGUgcHVsbCByZXF1ZXN0IHNob3VsZCB0YXJnZXQuXG4gICAqIEBwYXJhbSBvcHRzIE5vbi1tYW5kYXRvcnkgb3B0aW9ucyBmb3IgY29udHJvbGxpbmcgdGhlIHN0YWdpbmcsIGUuZy5cbiAgICogICBhbGxvd2luZyBmb3IgYWRkaXRpb25hbCBgcGFja2FnZS5qc29uYCBtb2RpZmljYXRpb25zLlxuICAgKiBAcmV0dXJucyBhbiBvYmplY3QgY2FwdHVyaW5nIGFjdGlvbnMgcGVyZm9ybWVkIGFzIHBhcnQgb2Ygc3RhZ2luZy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBzdGFnZVZlcnNpb25Gb3JCcmFuY2hBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzOiBzZW12ZXIuU2VtVmVyLFxuICAgIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoOiBzdHJpbmcsXG4gICAgb3B0cz86IFN0YWdpbmdPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcztcbiAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3Q7XG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdO1xuICB9PiB7XG4gICAgY29uc3QgcmVsZWFzZU5vdGVzQ29tcGFyZVRhZyA9IGdldFJlbGVhc2VUYWdGb3JWZXJzaW9uKGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzKTtcblxuICAgIC8vIEZldGNoIHRoZSBjb21wYXJlIHRhZyBzbyB0aGF0IGNvbW1pdHMgZm9yIHRoZSByZWxlYXNlIG5vdGVzIGNhbiBiZSBkZXRlcm1pbmVkLlxuICAgIC8vIFdlIGZvcmNpYmx5IG92ZXJyaWRlIGV4aXN0aW5nIGxvY2FsIHRhZ3MgdGhhdCBhcmUgbmFtZWQgc2ltaWxhciBhcyB3ZSB3aWxsIGZldGNoXG4gICAgLy8gdGhlIGNvcnJlY3QgdGFnIGZvciByZWxlYXNlIG5vdGVzIGNvbXBhcmlzb24gZnJvbSB0aGUgdXBzdHJlYW0gcmVtb3RlLlxuICAgIHRoaXMuZ2l0LnJ1bihbXG4gICAgICAnZmV0Y2gnLFxuICAgICAgJy0tZm9yY2UnLFxuICAgICAgdGhpcy5naXQuZ2V0UmVwb0dpdFVybCgpLFxuICAgICAgYHJlZnMvdGFncy8ke3JlbGVhc2VOb3Rlc0NvbXBhcmVUYWd9OnJlZnMvdGFncy8ke3JlbGVhc2VOb3Rlc0NvbXBhcmVUYWd9YCxcbiAgICBdKTtcblxuICAgIC8vIEJ1aWxkIHJlbGVhc2Ugbm90ZXMgZm9yIGNvbW1pdHMgZnJvbSBgPHJlbGVhc2VOb3Rlc0NvbXBhcmVUYWc+Li5IRUFEYC5cbiAgICBjb25zdCByZWxlYXNlTm90ZXMgPSBhd2FpdCBSZWxlYXNlTm90ZXMuZm9yUmFuZ2UoXG4gICAgICB0aGlzLmdpdCxcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgICByZWxlYXNlTm90ZXNDb21wYXJlVGFnLFxuICAgICAgJ0hFQUQnLFxuICAgICk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3RWZXJzaW9uKG5ld1ZlcnNpb24sIG9wdHM/LnVwZGF0ZVBrZ0pzb25Gbik7XG4gICAgYXdhaXQgdGhpcy5wcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzKTtcbiAgICBhd2FpdCB0aGlzLndhaXRGb3JFZGl0c0FuZENyZWF0ZVJlbGVhc2VDb21taXQobmV3VmVyc2lvbik7XG5cbiAgICAvLyBJbnN0YWxsIHRoZSBwcm9qZWN0IGRlcGVuZGVuY2llcyBmb3IgdGhlIHB1Ymxpc2ggYnJhbmNoLlxuICAgIGF3YWl0IHRoaXMuaW5zdGFsbERlcGVuZGVuY2llc0ZvckN1cnJlbnRCcmFuY2goKTtcblxuICAgIGNvbnN0IGJ1aWx0UGFja2FnZXNXaXRoSW5mbyA9IGF3YWl0IHRoaXMuYnVpbGRSZWxlYXNlRm9yQ3VycmVudEJyYW5jaCgpO1xuXG4gICAgLy8gUnVuIHJlbGVhc2UgcHJlLWNoZWNrcyAoZS5nLiB2YWxpZGF0aW5nIHRoZSByZWxlYXNlIG91dHB1dCkuXG4gICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlUHJlY2hlY2soXG4gICAgICB0aGlzLnByb2plY3REaXIsXG4gICAgICBuZXdWZXJzaW9uLFxuICAgICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvLFxuICAgICAgdGhpcy5wbnBtVmVyc2lvbmluZyxcbiAgICApO1xuXG4gICAgLy8gVmVyaWZ5IHRoZSBwYWNrYWdlcyBidWlsdCBhcmUgdGhlIGNvcnJlY3QgdmVyc2lvbi5cbiAgICBhd2FpdCB0aGlzLl92ZXJpZnlQYWNrYWdlVmVyc2lvbnMocmVsZWFzZU5vdGVzLnZlcnNpb24sIGJ1aWx0UGFja2FnZXNXaXRoSW5mbyk7XG5cbiAgICBjb25zdCBwdWxsUmVxdWVzdCA9IGF3YWl0IHRoaXMucHVzaENoYW5nZXNUb0ZvcmtBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICAgIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoLFxuICAgICAgYHJlbGVhc2Utc3RhZ2UtJHtuZXdWZXJzaW9ufWAsXG4gICAgICBgQnVtcCB2ZXJzaW9uIHRvIFwidiR7bmV3VmVyc2lvbn1cIiB3aXRoIGNoYW5nZWxvZy5gLFxuICAgICk7XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBSZWxlYXNlIHN0YWdpbmcgcHVsbCByZXF1ZXN0IGhhcyBiZWVuIGNyZWF0ZWQuJykpO1xuXG4gICAgcmV0dXJuIHtyZWxlYXNlTm90ZXMsIHB1bGxSZXF1ZXN0LCBidWlsdFBhY2thZ2VzV2l0aEluZm99O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBvdXQgdGhlIHNwZWNpZmllZCB0YXJnZXQgYnJhbmNoLCB2ZXJpZmllcyBpdHMgQ0kgc3RhdHVzIGFuZCBzdGFnZXNcbiAgICogdGhlIHNwZWNpZmllZCBuZXcgdmVyc2lvbiBpbiBvcmRlciB0byBjcmVhdGUgYSBwdWxsIHJlcXVlc3QuXG4gICAqXG4gICAqIEBwYXJhbSBuZXdWZXJzaW9uIE5ldyB2ZXJzaW9uIHRvIGJlIHN0YWdlZC5cbiAgICogQHBhcmFtIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzIFZlcnNpb24gdXNlZCBmb3IgY29tcGFyaW5nIHdpdGggYEhFQURgIG9mXG4gICAqICAgdGhlIHN0YWdpbmcgYnJhbmNoIGluIG9yZGVyIGJ1aWxkIHRoZSByZWxlYXNlIG5vdGVzLlxuICAgKiBAcGFyYW0gc3RhZ2luZ0JyYW5jaCBCcmFuY2ggd2l0aGluIHRoZSBuZXcgdmVyc2lvbiBzaG91bGQgYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gc3RhZ2luZ09wdGlvbnMgTm9uLW1hbmRhdG9yeSBvcHRpb25zIGZvciBjb250cm9sbGluZyB0aGUgc3RhZ2luZyBvZlxuICAgKiAgIHRoZSBuZXcgdmVyc2lvbi4gZS5nLiBhbGxvd2luZyBmb3IgYWRkaXRpb25hbCBgcGFja2FnZS5qc29uYCBtb2RpZmljYXRpb25zLlxuICAgKiBAcmV0dXJucyBhbiBvYmplY3QgY2FwdHVyaW5nIGFjdGlvbnMgcGVyZm9ybWVkIGFzIHBhcnQgb2Ygc3RhZ2luZy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBjaGVja291dEJyYW5jaEFuZFN0YWdlVmVyc2lvbihcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzOiBzZW12ZXIuU2VtVmVyLFxuICAgIHN0YWdpbmdCcmFuY2g6IHN0cmluZyxcbiAgICBzdGFnaW5nT3B0cz86IFN0YWdpbmdPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcztcbiAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3Q7XG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdO1xuICAgIGJlZm9yZVN0YWdpbmdTaGE6IHN0cmluZztcbiAgfT4ge1xuICAgIC8vIEtlZXAgdHJhY2sgb2YgdGhlIGNvbW1pdCB3aGVyZSB3ZSBzdGFydGVkIHRoZSBzdGFnaW5nIHByb2Nlc3Mgb24uIFRoaXMgd2lsbCBiZSB1c2VkXG4gICAgLy8gbGF0ZXIgdG8gZW5zdXJlIHRoYXQgbm8gY2hhbmdlcywgZXhjZXB0IGZvciB0aGUgdmVyc2lvbiBidW1wIGhhdmUgbGFuZGVkIGFzIHBhcnRcbiAgICAvLyBvZiB0aGUgc3RhZ2luZyB0aW1lIHdpbmRvdyAod2hlcmUgdGhlIGNhcmV0YWtlciBjb3VsZCBhY2NpZGVudGFsbHkgbGFuZCBvdGhlciBzdHVmZikuXG4gICAgY29uc3Qge3NoYTogYmVmb3JlU3RhZ2luZ1NoYX0gPSBhd2FpdCB0aGlzLmdldExhdGVzdENvbW1pdE9mQnJhbmNoKHN0YWdpbmdCcmFuY2gpO1xuXG4gICAgYXdhaXQgdGhpcy5hc3NlcnRQYXNzaW5nR2l0aHViU3RhdHVzKGJlZm9yZVN0YWdpbmdTaGEsIHN0YWdpbmdCcmFuY2gpO1xuICAgIGF3YWl0IHRoaXMuY2hlY2tvdXRVcHN0cmVhbUJyYW5jaChzdGFnaW5nQnJhbmNoKTtcblxuICAgIGNvbnN0IHN0YWdpbmdJbmZvID0gYXdhaXQgdGhpcy5zdGFnZVZlcnNpb25Gb3JCcmFuY2hBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgICBjb21wYXJlVmVyc2lvbkZvclJlbGVhc2VOb3RlcyxcbiAgICAgIHN0YWdpbmdCcmFuY2gsXG4gICAgICBzdGFnaW5nT3B0cyxcbiAgICApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnN0YWdpbmdJbmZvLFxuICAgICAgYmVmb3JlU3RhZ2luZ1NoYSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZXJyeS1waWNrcyB0aGUgcmVsZWFzZSBub3RlcyBvZiBhIHZlcnNpb24gdGhhdCBoYXZlIGJlZW4gcHVzaGVkIHRvIGEgZ2l2ZW4gYnJhbmNoXG4gICAqIGludG8gdGhlIGBuZXh0YCBwcmltYXJ5IGRldmVsb3BtZW50IGJyYW5jaC4gQSBwdWxsIHJlcXVlc3QgaXMgY3JlYXRlZCBmb3IgdGhpcy5cbiAgICogQHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgc3VjY2Vzc2Z1bCBjcmVhdGlvbiBvZiB0aGUgY2hlcnJ5LXBpY2sgcHVsbCByZXF1ZXN0LlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNoZXJyeVBpY2tDaGFuZ2Vsb2dJbnRvTmV4dEJyYW5jaChcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcyxcbiAgICBzdGFnaW5nQnJhbmNoOiBzdHJpbmcsXG4gICk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IG5leHRCcmFuY2ggPSB0aGlzLmFjdGl2ZS5uZXh0LmJyYW5jaE5hbWU7XG4gICAgY29uc3QgY29tbWl0TWVzc2FnZSA9IGdldFJlbGVhc2VOb3RlQ2hlcnJ5UGlja0NvbW1pdE1lc3NhZ2UocmVsZWFzZU5vdGVzLnZlcnNpb24pO1xuXG4gICAgLy8gQ2hlY2tvdXQgdGhlIG5leHQgYnJhbmNoLlxuICAgIGF3YWl0IHRoaXMuY2hlY2tvdXRVcHN0cmVhbUJyYW5jaChuZXh0QnJhbmNoKTtcblxuICAgIGF3YWl0IHRoaXMucHJlcGVuZFJlbGVhc2VOb3Rlc1RvQ2hhbmdlbG9nKHJlbGVhc2VOb3Rlcyk7XG5cbiAgICAvLyBDcmVhdGUgYSBjaGFuZ2Vsb2cgY2hlcnJ5LXBpY2sgY29tbWl0LlxuICAgIGF3YWl0IHRoaXMuY3JlYXRlQ29tbWl0KGNvbW1pdE1lc3NhZ2UsIFt3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGhdKTtcbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBDcmVhdGVkIGNoYW5nZWxvZyBjaGVycnktcGljayBjb21taXQgZm9yOiBcIiR7cmVsZWFzZU5vdGVzLnZlcnNpb259XCIuYCkpO1xuXG4gICAgLy8gQ3JlYXRlIGEgY2hlcnJ5LXBpY2sgcHVsbCByZXF1ZXN0IHRoYXQgc2hvdWxkIGJlIG1lcmdlZCBieSB0aGUgY2FyZXRha2VyLlxuICAgIGNvbnN0IHB1bGxSZXF1ZXN0ID0gYXdhaXQgdGhpcy5wdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgbmV4dEJyYW5jaCxcbiAgICAgIGBjaGFuZ2Vsb2ctY2hlcnJ5LXBpY2stJHtyZWxlYXNlTm90ZXMudmVyc2lvbn1gLFxuICAgICAgY29tbWl0TWVzc2FnZSxcbiAgICAgIGBDaGVycnktcGlja3MgdGhlIGNoYW5nZWxvZyBmcm9tIHRoZSBcIiR7c3RhZ2luZ0JyYW5jaH1cIiBicmFuY2ggdG8gdGhlIG5leHQgYCArXG4gICAgICAgIGBicmFuY2ggKCR7bmV4dEJyYW5jaH0pLmAsXG4gICAgKTtcblxuICAgIExvZy5pbmZvKFxuICAgICAgZ3JlZW4oXG4gICAgICAgIGAgIOKckyAgIFB1bGwgcmVxdWVzdCBmb3IgY2hlcnJ5LXBpY2tpbmcgdGhlIGNoYW5nZWxvZyBpbnRvIFwiJHtuZXh0QnJhbmNofVwiIGAgK1xuICAgICAgICAgICdoYXMgYmVlbiBjcmVhdGVkLicsXG4gICAgICApLFxuICAgICk7XG5cbiAgICBhd2FpdCB0aGlzLnByb21wdEFuZFdhaXRGb3JQdWxsUmVxdWVzdE1lcmdlZChwdWxsUmVxdWVzdCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKiBQcm9tcHRzIHRoZSB1c2VyIGZvciBtZXJnaW5nIHRoZSBwdWxsIHJlcXVlc3QsIGFuZCB3YWl0cyBmb3IgaXQgdG8gYmUgbWVyZ2VkLiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgcHJvbXB0QW5kV2FpdEZvclB1bGxSZXF1ZXN0TWVyZ2VkKHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHByb21wdFRvSW5pdGlhdGVQdWxsUmVxdWVzdE1lcmdlKHRoaXMuZ2l0LCBwdWxsUmVxdWVzdCk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEdpdGh1YiByZWxlYXNlIGZvciB0aGUgc3BlY2lmaWVkIHZlcnNpb24uIFRoZSByZWxlYXNlIGlzIGNyZWF0ZWRcbiAgICogYnkgdGFnZ2luZyB0aGUgdmVyc2lvbiBidW1wIGNvbW1pdCwgYW5kIGJ5IGNyZWF0aW5nIHRoZSByZWxlYXNlIGVudHJ5LlxuICAgKlxuICAgKiBFeHBlY3RzIHRoZSB2ZXJzaW9uIGJ1bXAgY29tbWl0IGFuZCBjaGFuZ2Vsb2cgdG8gYmUgYXZhaWxhYmxlIGluIHRoZVxuICAgKiB1cHN0cmVhbSByZW1vdGUuXG4gICAqXG4gICAqIEBwYXJhbSByZWxlYXNlTm90ZXMgVGhlIHJlbGVhc2Ugbm90ZXMgZm9yIHRoZSB2ZXJzaW9uIGJlaW5nIHB1Ymxpc2hlZC5cbiAgICogQHBhcmFtIHZlcnNpb25CdW1wQ29tbWl0U2hhIENvbW1pdCB0aGF0IGJ1bXBlZCB0aGUgdmVyc2lvbi4gVGhlIHJlbGVhc2UgdGFnXG4gICAqICAgd2lsbCBwb2ludCB0byB0aGlzIGNvbW1pdC5cbiAgICogQHBhcmFtIGlzUHJlcmVsZWFzZSBXaGV0aGVyIHRoZSBuZXcgdmVyc2lvbiBpcyBwdWJsaXNoZWQgYXMgYSBwcmUtcmVsZWFzZS5cbiAgICogQHBhcmFtIHNob3dBc0xhdGVzdE9uR2l0SHViIFdoZXRoZXIgdGhlIHZlcnNpb24gcmVsZWFzZWQgd2lsbCByZXByZXNlbnRcbiAgICogICB0aGUgXCJsYXRlc3RcIiB2ZXJzaW9uIG9mIHRoZSBwcm9qZWN0LiBJLmUuIEdpdEh1YiB3aWxsIHNob3cgdGhpcyB2ZXJzaW9uIGFzIFwibGF0ZXN0XCIuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9jcmVhdGVHaXRodWJSZWxlYXNlRm9yVmVyc2lvbihcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcyxcbiAgICB2ZXJzaW9uQnVtcENvbW1pdFNoYTogc3RyaW5nLFxuICAgIGlzUHJlcmVsZWFzZTogYm9vbGVhbixcbiAgICBzaG93QXNMYXRlc3RPbkdpdEh1YjogYm9vbGVhbixcbiAgKSB7XG4gICAgY29uc3QgdGFnTmFtZSA9IGdldFJlbGVhc2VUYWdGb3JWZXJzaW9uKHJlbGVhc2VOb3Rlcy52ZXJzaW9uKTtcbiAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIuZ2l0LmNyZWF0ZVJlZih7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICByZWY6IGByZWZzL3RhZ3MvJHt0YWdOYW1lfWAsXG4gICAgICBzaGE6IHZlcnNpb25CdW1wQ29tbWl0U2hhLFxuICAgIH0pO1xuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFRhZ2dlZCB2JHtyZWxlYXNlTm90ZXMudmVyc2lvbn0gcmVsZWFzZSB1cHN0cmVhbS5gKSk7XG5cbiAgICBsZXQgcmVsZWFzZUJvZHkgPSBhd2FpdCByZWxlYXNlTm90ZXMuZ2V0R2l0aHViUmVsZWFzZUVudHJ5KCk7XG5cbiAgICAvLyBJZiB0aGUgcmVsZWFzZSBib2R5IGV4Y2VlZHMgdGhlIEdpdGh1YiBib2R5IGxpbWl0LCB3ZSBqdXN0IHByb3ZpZGVcbiAgICAvLyBhIGxpbmsgdG8gdGhlIGNoYW5nZWxvZyBlbnRyeSBpbiB0aGUgR2l0aHViIHJlbGVhc2UgZW50cnkuXG4gICAgaWYgKHJlbGVhc2VCb2R5Lmxlbmd0aCA+IGdpdGh1YlJlbGVhc2VCb2R5TGltaXQpIHtcbiAgICAgIGNvbnN0IHJlbGVhc2VOb3Rlc1VybCA9IGF3YWl0IHRoaXMuX2dldEdpdGh1YkNoYW5nZWxvZ1VybEZvclJlZihyZWxlYXNlTm90ZXMsIHRhZ05hbWUpO1xuICAgICAgcmVsZWFzZUJvZHkgPVxuICAgICAgICBgUmVsZWFzZSBub3RlcyBhcmUgdG9vIGxhcmdlIHRvIGJlIGNhcHR1cmVkIGhlcmUuIGAgK1xuICAgICAgICBgW1ZpZXcgYWxsIGNoYW5nZXMgaGVyZV0oJHtyZWxlYXNlTm90ZXNVcmx9KS5gO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5yZXBvcy5jcmVhdGVSZWxlYXNlKHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIG5hbWU6IHJlbGVhc2VOb3Rlcy52ZXJzaW9uLnRvU3RyaW5nKCksXG4gICAgICB0YWdfbmFtZTogdGFnTmFtZSxcbiAgICAgIHByZXJlbGVhc2U6IGlzUHJlcmVsZWFzZSxcbiAgICAgIG1ha2VfbGF0ZXN0OiBzaG93QXNMYXRlc3RPbkdpdEh1YiA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgICBib2R5OiByZWxlYXNlQm9keSxcbiAgICB9KTtcbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBDcmVhdGVkIHYke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufSByZWxlYXNlIGluIEdpdGh1Yi5gKSk7XG4gIH1cblxuICAvKiogR2V0cyBhIEdpdGh1YiBVUkwgdGhhdCByZXNvbHZlcyB0byB0aGUgcmVsZWFzZSBub3RlcyBpbiB0aGUgZ2l2ZW4gcmVmLiAqL1xuICBwcml2YXRlIGFzeW5jIF9nZXRHaXRodWJDaGFuZ2Vsb2dVcmxGb3JSZWYocmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsIHJlZjogc3RyaW5nKSB7XG4gICAgY29uc3QgYmFzZVVybCA9IGdldEZpbGVDb250ZW50c1VybCh0aGlzLmdpdCwgcmVmLCB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGgpO1xuICAgIGNvbnN0IHVybEZyYWdtZW50ID0gYXdhaXQgcmVsZWFzZU5vdGVzLmdldFVybEZyYWdtZW50Rm9yUmVsZWFzZSgpO1xuICAgIHJldHVybiBgJHtiYXNlVXJsfSMke3VybEZyYWdtZW50fWA7XG4gIH1cblxuICAvKipcbiAgICogUHVibGlzaGVzIHRoZSBnaXZlbiBwYWNrYWdlcyB0byB0aGUgcmVnaXN0cnkgYW5kIG1ha2VzIHRoZSByZWxlYXNlc1xuICAgKiBhdmFpbGFibGUgb24gR2l0SHViLlxuICAgKlxuICAgKiBAcGFyYW0gYnVpbHRQYWNrYWdlc1dpdGhJbmZvIExpc3Qgb2YgYnVpbHQgcGFja2FnZXMgdGhhdCB3aWxsIGJlIHB1Ymxpc2hlZC5cbiAgICogQHBhcmFtIHJlbGVhc2VOb3RlcyBUaGUgcmVsZWFzZSBub3RlcyBmb3IgdGhlIHZlcnNpb24gYmVpbmcgcHVibGlzaGVkLlxuICAgKiBAcGFyYW0gYmVmb3JlU3RhZ2luZ1NoYSBDb21taXQgU0hBIHRoYXQgaXMgZXhwZWN0ZWQgdG8gYmUgdGhlIG1vc3QgcmVjZW50IG9uZSBhZnRlclxuICAgKiAgIHRoZSBhY3R1YWwgdmVyc2lvbiBidW1wIGNvbW1pdC4gVGhpcyBleGlzdHMgdG8gZW5zdXJlIHRoYXQgY2FyZXRha2VycyBkbyBub3QgbGFuZFxuICAgKiAgIGFkZGl0aW9uYWwgY2hhbmdlcyBhZnRlciB0aGUgcmVsZWFzZSBvdXRwdXQgaGFzIGJlZW4gYnVpbHQgbG9jYWxseS5cbiAgICogQHBhcmFtIHB1Ymxpc2hCcmFuY2ggTmFtZSBvZiB0aGUgYnJhbmNoIHRoYXQgY29udGFpbnMgdGhlIG5ldyB2ZXJzaW9uLlxuICAgKiBAcGFyYW0gbnBtRGlzdFRhZyBOUE0gZGlzdCB0YWcgd2hlcmUgdGhlIHZlcnNpb24gc2hvdWxkIGJlIHB1Ymxpc2hlZCB0by5cbiAgICogQHBhcmFtIGFkZGl0aW9uYWxPcHRpb25zIEFkZGl0aW9uYWwgb3B0aW9ucyBuZWVkZWQgZm9yIHB1Ymxpc2hpbmcgYSByZWxlYXNlLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHB1Ymxpc2goXG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdLFxuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzLFxuICAgIGJlZm9yZVN0YWdpbmdTaGE6IHN0cmluZyxcbiAgICBwdWJsaXNoQnJhbmNoOiBzdHJpbmcsXG4gICAgbnBtRGlzdFRhZzogTnBtRGlzdFRhZyxcbiAgICBhZGRpdGlvbmFsT3B0aW9uczoge3Nob3dBc0xhdGVzdE9uR2l0SHViOiBib29sZWFufSxcbiAgKSB7XG4gICAgY29uc3QgcmVsZWFzZVNoYSA9IGF3YWl0IHRoaXMuX2dldEFuZFZhbGlkYXRlTGF0ZXN0Q29tbWl0Rm9yUHVibGlzaGluZyhcbiAgICAgIHB1Ymxpc2hCcmFuY2gsXG4gICAgICByZWxlYXNlTm90ZXMudmVyc2lvbixcbiAgICAgIGJlZm9yZVN0YWdpbmdTaGEsXG4gICAgKTtcblxuICAgIC8vIEJlZm9yZSBwdWJsaXNoaW5nLCB3ZSB3YW50IHRvIGVuc3VyZSB0aGF0IHRoZSBsb2NhbGx5LWJ1aWx0IHBhY2thZ2VzIHdlXG4gICAgLy8gYnVpbHQgaW4gdGhlIHN0YWdpbmcgcGhhc2UgaGF2ZSBub3QgYmVlbiBtb2RpZmllZCBhY2NpZGVudGFsbHkuXG4gICAgYXdhaXQgYXNzZXJ0SW50ZWdyaXR5T2ZCdWlsdFBhY2thZ2VzKGJ1aWx0UGFja2FnZXNXaXRoSW5mbyk7XG5cbiAgICAvLyBDcmVhdGUgYSBHaXRodWIgcmVsZWFzZSBmb3IgdGhlIG5ldyB2ZXJzaW9uLlxuICAgIGF3YWl0IHRoaXMuX2NyZWF0ZUdpdGh1YlJlbGVhc2VGb3JWZXJzaW9uKFxuICAgICAgcmVsZWFzZU5vdGVzLFxuICAgICAgcmVsZWFzZVNoYSxcbiAgICAgIG5wbURpc3RUYWcgPT09ICduZXh0JyxcbiAgICAgIGFkZGl0aW9uYWxPcHRpb25zLnNob3dBc0xhdGVzdE9uR2l0SHViLFxuICAgICk7XG5cbiAgICAvLyBXYWxrIHRocm91Z2ggYWxsIGJ1aWx0IHBhY2thZ2VzIGFuZCBwdWJsaXNoIHRoZW0gdG8gTlBNLlxuICAgIGZvciAoY29uc3QgcGtnIG9mIGJ1aWx0UGFja2FnZXNXaXRoSW5mbykge1xuICAgICAgYXdhaXQgdGhpcy5fcHVibGlzaEJ1aWx0UGFja2FnZVRvTnBtKHBrZywgbnBtRGlzdFRhZyk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oJyAg4pyTICAgUHVibGlzaGVkIGFsbCBwYWNrYWdlcyBzdWNjZXNzZnVsbHknKSk7XG4gIH1cblxuICAvKiogUHVibGlzaGVzIHRoZSBnaXZlbiBidWlsdCBwYWNrYWdlIHRvIE5QTSB3aXRoIHRoZSBzcGVjaWZpZWQgTlBNIGRpc3QgdGFnLiAqL1xuICBwcml2YXRlIGFzeW5jIF9wdWJsaXNoQnVpbHRQYWNrYWdlVG9OcG0ocGtnOiBCdWlsdFBhY2thZ2UsIG5wbURpc3RUYWc6IE5wbURpc3RUYWcpIHtcbiAgICBMb2cuZGVidWcoYFN0YXJ0aW5nIHB1Ymxpc2ggb2YgXCIke3BrZy5uYW1lfVwiLmApO1xuICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcihgUHVibGlzaGluZyBcIiR7cGtnLm5hbWV9XCJgKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBOcG1Db21tYW5kLnB1Ymxpc2gocGtnLm91dHB1dFBhdGgsIG5wbURpc3RUYWcsIHRoaXMuY29uZmlnLnB1Ymxpc2hSZWdpc3RyeSk7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBTdWNjZXNzZnVsbHkgcHVibGlzaGVkIFwiJHtwa2cubmFtZX0uYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBwdWJsaXNoaW5nIFwiJHtwa2cubmFtZX1cIi5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyZWl2ZSB0aGUgbGF0ZXN0IGNvbW1pdCBmcm9tIHRoZSBwcm92aWRlZCBicmFuY2gsIGFuZCB2ZXJpZnkgdGhhdCBpdCBpcyB0aGUgZXhwZWN0ZWRcbiAgICogcmVsZWFzZSBjb21taXQgYW5kIGlzIHRoZSBkaXJlY3QgY2hpbGQgb2YgdGhlIHByZXZpb3VzIHNoYSBwcm92aWRlZC5cbiAgICpcbiAgICogVGhlIG1ldGhvZCB3aWxsIG1ha2Ugb25lIHJlY3Vyc2l2ZSBhdHRlbXB0IHRvIGNoZWNrIGFnYWluIGJlZm9yZSB0aHJvd2luZyBhbiBlcnJvciBpZlxuICAgKiBhbnkgZXJyb3Igb2NjdXJzIGR1cmluZyB0aGlzIHZhbGlkYXRpb24uIFRoaXMgZXhpc3RzIGFzIGFuIGF0dGVtcHQgdG8gaGFuZGxlIHRyYW5zaWVudFxuICAgKiB0aW1lb3V0cyBmcm9tIEdpdGh1YiBhbG9uZyB3aXRoIGNhc2VzLCB3aGVyZSB0aGUgR2l0aHViIEFQSSByZXNwb25zZSBkb2VzIG5vdCBrZWVwIHVwXG4gICAqIHdpdGggdGhlIHRpbWluZyBmcm9tIHdoZW4gd2UgcGVyZm9ybSBhIG1lcmdlIHRvIHdoZW4gd2UgdmVyaWZ5IHRoYXQgdGhlIG1lcmdlZCBjb21taXQgaXNcbiAgICogcHJlc2VudCBpbiB0aGUgdXBzdHJlYW0gYnJhbmNoLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfZ2V0QW5kVmFsaWRhdGVMYXRlc3RDb21taXRGb3JQdWJsaXNoaW5nKFxuICAgIGJyYW5jaDogc3RyaW5nLFxuICAgIHZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgcHJldmlvdXNTaGE6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBsZXQgbGF0ZXN0U2hhOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgIC8vIFN1cHBvcnQgcmUtY2hlY2tpbmcgYXMgbWFueSB0aW1lcyBhcyBuZWVkZWQuIE9mdGVuIHRpbWVzIHRoZSBHaXRIdWIgQVBJXG4gICAgLy8gaXMgbm90IHVwLXRvLWRhdGUgYW5kIHdlIGRvbid0IHdhbnQgdG8gZXhpdCB0aGUgcmVsZWFzZSBzY3JpcHQgdGhlbi5cbiAgICB3aGlsZSAobGF0ZXN0U2hhID09PSBudWxsKSB7XG4gICAgICBjb25zdCBjb21taXQgPSBhd2FpdCB0aGlzLmdldExhdGVzdENvbW1pdE9mQnJhbmNoKGJyYW5jaCk7XG5cbiAgICAgIC8vIEVuc3VyZSB0aGUgbGF0ZXN0IGNvbW1pdCBpbiB0aGUgcHVibGlzaCBicmFuY2ggaXMgdGhlIGJ1bXAgY29tbWl0LlxuICAgICAgaWYgKCFjb21taXQuY29tbWl0Lm1lc3NhZ2Uuc3RhcnRzV2l0aChnZXRDb21taXRNZXNzYWdlRm9yUmVsZWFzZSh2ZXJzaW9uKSkpIHtcbiAgICAgICAgLyoqIFRoZSBzaG9ydGVuZWQgc2hhIG9mIHRoZSBjb21taXQgZm9yIHVzYWdlIGluIHRoZSBlcnJvciBtZXNzYWdlLiAqL1xuICAgICAgICBjb25zdCBzaGEgPSBjb21taXQuc2hhLnNsaWNlKDAsIDgpO1xuICAgICAgICBMb2cuZXJyb3IoYCAg4pyYICAgTGF0ZXN0IGNvbW1pdCAoJHtzaGF9KSBpbiBcIiR7YnJhbmNofVwiIGJyYW5jaCBpcyBub3QgYSBzdGFnaW5nIGNvbW1pdC5gKTtcbiAgICAgICAgTG9nLmVycm9yKCcgICAgICBQbGVhc2UgbWFrZSBzdXJlIHRoZSBzdGFnaW5nIHB1bGwgcmVxdWVzdCBoYXMgYmVlbiBtZXJnZWQuJyk7XG5cbiAgICAgICAgaWYgKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiBgRG8geW91IHdhbnQgdG8gcmUtdHJ5P2AsIGRlZmF1bHQ6IHRydWV9KSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgICAgfVxuXG4gICAgICAvLyBXZSBvbmx5IGluc3BlY3QgdGhlIGZpcnN0IHBhcmVudCBhcyB3ZSBlbmZvcmNlIHRoYXQgbm8gbWVyZ2UgY29tbWl0cyBhcmUgdXNlZCBpbiBvdXJcbiAgICAgIC8vIHJlcG9zLCBzbyBhbGwgY29tbWl0cyBoYXZlIGV4YWN0bHkgb25lIHBhcmVudC5cbiAgICAgIGlmIChjb21taXQucGFyZW50c1swXS5zaGEgIT09IHByZXZpb3VzU2hhKSB7XG4gICAgICAgIExvZy5lcnJvcihgICDinJggICBVbmV4cGVjdGVkIGFkZGl0aW9uYWwgY29tbWl0cyBoYXZlIGxhbmRlZCB3aGlsZSBzdGFnaW5nIHRoZSByZWxlYXNlLmApO1xuICAgICAgICBMb2cuZXJyb3IoJyAgICAgIFBsZWFzZSByZXZlcnQgdGhlIGJ1bXAgY29tbWl0IGFuZCByZXRyeSwgb3IgY3V0IGEgbmV3IHZlcnNpb24gb24gdG9wLicpO1xuXG4gICAgICAgIGlmIChhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogYERvIHlvdSB3YW50IHRvIHJlLXRyeT9gLCBkZWZhdWx0OiB0cnVlfSkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICAgIH1cblxuICAgICAgbGF0ZXN0U2hhID0gY29tbWl0LnNoYTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGF0ZXN0U2hhO1xuICB9XG5cbiAgLy8gVE9ETzogUmVtb3ZlIHRoaXMgY2hlY2sgYW5kIHJ1biBpdCBhcyBwYXJ0IG9mIGNvbW1vbiByZWxlYXNlIHZhbGlkYXRpb24uXG4gIC8qKiBWZXJpZnkgdGhlIHZlcnNpb24gb2YgZWFjaCBnZW5lcmF0ZWQgcGFja2FnZSBleGFjdCBtYXRjaGVzIHRoZSBzcGVjaWZpZWQgdmVyc2lvbi4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfdmVyaWZ5UGFja2FnZVZlcnNpb25zKHZlcnNpb246IHNlbXZlci5TZW1WZXIsIHBhY2thZ2VzOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdKSB7XG4gICAgLy8gRXhwZXJpbWVudGFsIGVxdWl2YWxlbnQgdmVyc2lvbiBmb3IgcGFja2FnZXMuXG4gICAgY29uc3QgZXhwZXJpbWVudGFsVmVyc2lvbiA9IGNyZWF0ZUV4cGVyaW1lbnRhbFNlbXZlcih2ZXJzaW9uKTtcblxuICAgIGZvciAoY29uc3QgcGtnIG9mIHBhY2thZ2VzKSB7XG4gICAgICBjb25zdCB7dmVyc2lvbjogcGFja2FnZUpzb25WZXJzaW9ufSA9IEpTT04ucGFyc2UoXG4gICAgICAgIGF3YWl0IGZzLnJlYWRGaWxlKGpvaW4ocGtnLm91dHB1dFBhdGgsICdwYWNrYWdlLmpzb24nKSwgJ3V0ZjgnKSxcbiAgICAgICkgYXMge3ZlcnNpb246IHN0cmluZzsgW2tleTogc3RyaW5nXTogYW55fTtcblxuICAgICAgY29uc3QgZXhwZWN0ZWRWZXJzaW9uID0gcGtnLmV4cGVyaW1lbnRhbCA/IGV4cGVyaW1lbnRhbFZlcnNpb24gOiB2ZXJzaW9uO1xuICAgICAgY29uc3QgbWlzbWF0Y2hlc1ZlcnNpb24gPSBleHBlY3RlZFZlcnNpb24uY29tcGFyZShwYWNrYWdlSnNvblZlcnNpb24pICE9PSAwO1xuXG4gICAgICBpZiAobWlzbWF0Y2hlc1ZlcnNpb24pIHtcbiAgICAgICAgTG9nLmVycm9yKGBUaGUgYnVpbHQgcGFja2FnZSB2ZXJzaW9uIGRvZXMgbm90IG1hdGNoIGZvcjogJHtwa2cubmFtZX0uYCk7XG4gICAgICAgIExvZy5lcnJvcihgICBBY3R1YWwgdmVyc2lvbjogICAke3BhY2thZ2VKc29uVmVyc2lvbn1gKTtcbiAgICAgICAgTG9nLmVycm9yKGAgIEV4cGVjdGVkIHZlcnNpb246ICR7ZXhwZWN0ZWRWZXJzaW9ufWApO1xuICAgICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==