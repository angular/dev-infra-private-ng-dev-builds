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
        return commit.sha;
    }
    /** Checks whether the given revision is ahead to the base by the specified amount. */
    async _isRevisionAheadOfBase(baseRevision, targetRevision, expectedAheadCount) {
        const { data: { ahead_by, status }, } = await this.git.github.repos.compareCommits({
            ...this.git.remoteParams,
            base: baseRevision,
            head: targetRevision,
        });
        return status === 'ahead' && ahead_by === expectedAheadCount;
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
        const beforeStagingSha = await this.getLatestCommitOfBranch(stagingBranch);
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
        const versionBumpCommitSha = await this.getLatestCommitOfBranch(publishBranch);
        // Ensure the latest commit in the publish branch is the bump commit.
        if (!(await this._isCommitForVersionStaging(releaseNotes.version, versionBumpCommitSha))) {
            Log.error(`  ✘   Latest commit in "${publishBranch}" branch is not a staging commit.`);
            Log.error('      Please make sure the staging pull request has been merged.');
            throw new FatalReleaseActionError();
        }
        // Ensure no commits have landed since we started the staging process. This would signify
        // that the locally-built release packages are not matching with the release commit on GitHub.
        // Note: We expect the version bump commit to be ahead by **one** commit. This means it's
        // the direct parent of the commit that was latest when we started the staging.
        if (!(await this._isRevisionAheadOfBase(beforeStagingSha, versionBumpCommitSha, 1))) {
            Log.error(`  ✘   Unexpected additional commits have landed while staging the release.`);
            Log.error('      Please revert the bump commit and retry, or cut a new version on top.');
            throw new FatalReleaseActionError();
        }
        // Before publishing, we want to ensure that the locally-built packages we
        // built in the staging phase have not been modified accidentally.
        await assertIntegrityOfBuiltPackages(builtPackagesWithInfo);
        // Create a Github release for the new version.
        await this._createGithubReleaseForVersion(releaseNotes, versionBumpCommitSha, npmDistTag === 'next', additionalOptions.showAsLatestOnGitHub);
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
    /** Checks whether the given commit represents a staging commit for the specified version. */
    async _isCommitForVersionStaging(version, commitSha) {
        const { data } = await this.git.github.repos.getCommit({
            ...this.git.remoteParams,
            ref: commitSha,
        });
        return data.commit.message.startsWith(getCommitMessageForRelease(version));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsUUFBUSxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDOUMsT0FBTyxJQUFJLEVBQUUsRUFBQyxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFHaEMsT0FBTyxFQUFDLGdDQUFnQyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFMUUsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxZQUFZLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUNMLGtCQUFrQixFQUNsQix5QkFBeUIsRUFDekIsbUJBQW1CLEdBQ3BCLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEMsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFL0MsT0FBTyxFQUFDLFlBQVksRUFBRSw4QkFBOEIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBR3ZGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RSxPQUFPLEVBQUMsdUJBQXVCLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMxRixPQUFPLEVBQ0wscUNBQXFDLEVBQ3JDLDhCQUE4QixHQUMvQixNQUFNLHlCQUF5QixDQUFDO0FBQ2pDLE9BQU8sRUFDTCwwQkFBMEIsRUFDMUIscUNBQXFDLEdBQ3RD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LEtBQUssQ0FBQyx1QkFBdUIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO2dCQUN2RCxHQUFHLENBQUMsS0FBSyxDQUFDLHVCQUF1QixlQUFlLEVBQUUsQ0FBQyxDQUFDO2dCQUNwRCxNQUFNLElBQUksdUJBQXVCLEVBQUUsQ0FBQztZQUN0QyxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3Byb21pc2VzIGFzIGZzLCBleGlzdHNTeW5jfSBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCwge2pvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG5pbXBvcnQge3dvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRofSBmcm9tICcuLi8uLi91dGlscy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7aXNHaXRodWJBcGlFcnJvcn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi5qcyc7XG5pbXBvcnQgZ2l0aHViTWFjcm9zIGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWItbWFjcm9zLmpzJztcbmltcG9ydCB7XG4gIGdldEZpbGVDb250ZW50c1VybCxcbiAgZ2V0TGlzdENvbW1pdHNJbkJyYW5jaFVybCxcbiAgZ2V0UmVwb3NpdG9yeUdpdFVybCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi11cmxzLmpzJztcbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1NwaW5uZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXIuanMnO1xuaW1wb3J0IHtCdWlsdFBhY2thZ2UsIEJ1aWx0UGFja2FnZVdpdGhJbmZvLCBSZWxlYXNlQ29uZmlnfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtSZWxlYXNlTm90ZXMsIHdvcmtzcGFjZVJlbGF0aXZlQ2hhbmdlbG9nUGF0aH0gZnJvbSAnLi4vbm90ZXMvcmVsZWFzZS1ub3Rlcy5qcyc7XG5pbXBvcnQge05wbURpc3RUYWcsIFBhY2thZ2VKc29ufSBmcm9tICcuLi92ZXJzaW9uaW5nL2luZGV4LmpzJztcbmltcG9ydCB7QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMuanMnO1xuaW1wb3J0IHtjcmVhdGVFeHBlcmltZW50YWxTZW12ZXJ9IGZyb20gJy4uL3ZlcnNpb25pbmcvZXhwZXJpbWVudGFsLXZlcnNpb25zLmpzJztcbmltcG9ydCB7TnBtQ29tbWFuZH0gZnJvbSAnLi4vdmVyc2lvbmluZy9ucG0tY29tbWFuZC5qcyc7XG5pbXBvcnQge2dldFJlbGVhc2VUYWdGb3JWZXJzaW9ufSBmcm9tICcuLi92ZXJzaW9uaW5nL3ZlcnNpb24tdGFncy5qcyc7XG5pbXBvcnQge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yLCBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcn0gZnJvbSAnLi9hY3Rpb25zLWVycm9yLmpzJztcbmltcG9ydCB7XG4gIGFuYWx5emVBbmRFeHRlbmRCdWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gIGFzc2VydEludGVncml0eU9mQnVpbHRQYWNrYWdlcyxcbn0gZnJvbSAnLi9idWlsdC1wYWNrYWdlLWluZm8uanMnO1xuaW1wb3J0IHtcbiAgZ2V0Q29tbWl0TWVzc2FnZUZvclJlbGVhc2UsXG4gIGdldFJlbGVhc2VOb3RlQ2hlcnJ5UGlja0NvbW1pdE1lc3NhZ2UsXG59IGZyb20gJy4vY29tbWl0LW1lc3NhZ2UuanMnO1xuaW1wb3J0IHtnaXRodWJSZWxlYXNlQm9keUxpbWl0fSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQge0V4dGVybmFsQ29tbWFuZHN9IGZyb20gJy4vZXh0ZXJuYWwtY29tbWFuZHMuanMnO1xuaW1wb3J0IHtwcm9tcHRUb0luaXRpYXRlUHVsbFJlcXVlc3RNZXJnZX0gZnJvbSAnLi9wcm9tcHQtbWVyZ2UuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5pbXBvcnQge2dsb2J9IGZyb20gJ2Zhc3QtZ2xvYic7XG5pbXBvcnQge1BucG1WZXJzaW9uaW5nfSBmcm9tICcuL3BucG0tdmVyc2lvbmluZy5qcyc7XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyBhIEdpdGh1YiByZXBvc2l0b3J5LiAqL1xuZXhwb3J0IGludGVyZmFjZSBHaXRodWJSZXBvIHtcbiAgb3duZXI6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xufVxuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgYSBHaXRodWIgcHVsbCByZXF1ZXN0LiAqL1xuZXhwb3J0IGludGVyZmFjZSBQdWxsUmVxdWVzdCB7XG4gIC8qKiBVbmlxdWUgaWQgZm9yIHRoZSBwdWxsIHJlcXVlc3QgKGkuZS4gdGhlIFBSIG51bWJlcikuICovXG4gIGlkOiBudW1iZXI7XG4gIC8qKiBVUkwgdGhhdCByZXNvbHZlcyB0byB0aGUgcHVsbCByZXF1ZXN0IGluIEdpdGh1Yi4gKi9cbiAgdXJsOiBzdHJpbmc7XG4gIC8qKiBGb3JrIGNvbnRhaW5pbmcgdGhlIGhlYWQgYnJhbmNoIG9mIHRoaXMgcHVsbCByZXF1ZXN0LiAqL1xuICBmb3JrOiBHaXRodWJSZXBvO1xuICAvKiogQnJhbmNoIG5hbWUgaW4gdGhlIGZvcmsgdGhhdCBkZWZpbmVzIHRoaXMgcHVsbCByZXF1ZXN0LiAqL1xuICBmb3JrQnJhbmNoOiBzdHJpbmc7XG59XG5cbi8qKiBPcHRpb25zIHRoYXQgY2FuIGJlIHVzZWQgdG8gY29udHJvbCB0aGUgc3RhZ2luZyBvZiBhIG5ldyB2ZXJzaW9uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdGFnaW5nT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBBcyBwYXJ0IG9mIHN0YWdpbmcsIHRoZSBgcGFja2FnZS5qc29uYCBjYW4gYmUgdXBkYXRlZCBiZWZvcmUgdGhlXG4gICAqIG5ldyB2ZXJzaW9uIGlzIHNldC5cbiAgICogQHNlZSB7UmVsZWFzZUFjdGlvbi51cGRhdGVQcm9qZWN0VmVyc2lvbn1cbiAgICovXG4gIHVwZGF0ZVBrZ0pzb25Gbj86IChwa2dKc29uOiBQYWNrYWdlSnNvbikgPT4gdm9pZDtcbn1cblxuLyoqIENvbnN0cnVjdG9yIHR5cGUgZm9yIGluc3RhbnRpYXRpbmcgYSByZWxlYXNlIGFjdGlvbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZWxlYXNlQWN0aW9uQ29uc3RydWN0b3I8VCBleHRlbmRzIFJlbGVhc2VBY3Rpb24gPSBSZWxlYXNlQWN0aW9uPiB7XG4gIC8qKiBXaGV0aGVyIHRoZSByZWxlYXNlIGFjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlLiAqL1xuICBpc0FjdGl2ZShhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMsIGNvbmZpZzogUmVsZWFzZUNvbmZpZyk6IFByb21pc2U8Ym9vbGVhbj47XG4gIC8qKiBDb25zdHJ1Y3RzIGEgcmVsZWFzZSBhY3Rpb24uICovXG4gIG5ldyAoLi4uYXJnczogW0FjdGl2ZVJlbGVhc2VUcmFpbnMsIEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsIFJlbGVhc2VDb25maWcsIHN0cmluZ10pOiBUO1xufVxuXG4vKipcbiAqIEFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIGEgcmVsZWFzZSBhY3Rpb24uIEEgcmVsZWFzZSBhY3Rpb24gaXMgc2VsZWN0YWJsZSBieSB0aGUgY2FyZXRha2VyXG4gKiBpZiBhY3RpdmUsIGFuZCBjYW4gcGVyZm9ybSBjaGFuZ2VzIGZvciByZWxlYXNpbmcsIHN1Y2ggYXMgc3RhZ2luZyBhIHJlbGVhc2UsIGJ1bXBpbmcgdGhlXG4gKiB2ZXJzaW9uLCBjaGVycnktcGlja2luZyB0aGUgY2hhbmdlbG9nLCBicmFuY2hpbmcgb2ZmIGZyb20gdGhlIG1haW4gYnJhbmNoLiBldGMuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBSZWxlYXNlQWN0aW9uIHtcbiAgLyoqIFdoZXRoZXIgdGhlIHJlbGVhc2UgYWN0aW9uIGlzIGN1cnJlbnRseSBhY3RpdmUuICovXG4gIHN0YXRpYyBpc0FjdGl2ZShfdHJhaW5zOiBBY3RpdmVSZWxlYXNlVHJhaW5zLCBfY29uZmlnOiBSZWxlYXNlQ29uZmlnKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdGhyb3cgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSByZWxlYXNlIGFjdGlvbi4gKi9cbiAgYWJzdHJhY3QgZ2V0RGVzY3JpcHRpb24oKTogUHJvbWlzZTxzdHJpbmc+O1xuICAvKipcbiAgICogUGVyZm9ybXMgdGhlIGdpdmVuIHJlbGVhc2UgYWN0aW9uLlxuICAgKiBAdGhyb3dzIHtVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcn0gV2hlbiB0aGUgdXNlciBtYW51YWxseSBhYm9ydGVkIHRoZSBhY3Rpb24uXG4gICAqIEB0aHJvd3Mge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yfSBXaGVuIHRoZSBhY3Rpb24gaGFzIGJlZW4gYWJvcnRlZCBkdWUgdG8gYSBmYXRhbCBlcnJvci5cbiAgICovXG4gIGFic3RyYWN0IHBlcmZvcm0oKTogUHJvbWlzZTx2b2lkPjtcblxuICBwcm90ZWN0ZWQgcG5wbVZlcnNpb25pbmcgPSBuZXcgUG5wbVZlcnNpb25pbmcoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgYWN0aXZlOiBBY3RpdmVSZWxlYXNlVHJhaW5zLFxuICAgIHByb3RlY3RlZCBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgcHJvdGVjdGVkIGNvbmZpZzogUmVsZWFzZUNvbmZpZyxcbiAgICBwcm90ZWN0ZWQgcHJvamVjdERpcjogc3RyaW5nLFxuICApIHt9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIHZlcnNpb24gaW4gdGhlIHByb2plY3QgdG9wLWxldmVsIGBwYWNrYWdlLmpzb25gIGZpbGUuXG4gICAqXG4gICAqIEBwYXJhbSBuZXdWZXJzaW9uIE5ldyBTZW1WZXIgdmVyc2lvbiB0byBiZSBzZXQgaW4gdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBhZGRpdGlvbmFsVXBkYXRlRm4gT3B0aW9uYWwgdXBkYXRlIGZ1bmN0aW9uIHRoYXQgcnVucyBiZWZvcmVcbiAgICogICB0aGUgdmVyc2lvbiB1cGRhdGUuIENhbiBiZSB1c2VkIHRvIHVwZGF0ZSBvdGhlciBmaWVsZHMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgdXBkYXRlUHJvamVjdFZlcnNpb24oXG4gICAgbmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBhZGRpdGlvbmFsVXBkYXRlRm4/OiAocGtnSnNvbjogUGFja2FnZUpzb24pID0+IHZvaWQsXG4gICkge1xuICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gam9pbih0aGlzLnByb2plY3REaXIsIHdvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRoKTtcbiAgICBjb25zdCBwa2dKc29uID0gSlNPTi5wYXJzZShhd2FpdCBmcy5yZWFkRmlsZShwa2dKc29uUGF0aCwgJ3V0ZjgnKSkgYXMge1xuICAgICAgdmVyc2lvbjogc3RyaW5nO1xuICAgICAgW2tleTogc3RyaW5nXTogYW55O1xuICAgIH07XG4gICAgaWYgKGFkZGl0aW9uYWxVcGRhdGVGbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhZGRpdGlvbmFsVXBkYXRlRm4ocGtnSnNvbik7XG4gICAgfVxuICAgIHBrZ0pzb24udmVyc2lvbiA9IG5ld1ZlcnNpb24uZm9ybWF0KCk7XG4gICAgLy8gV3JpdGUgdGhlIGBwYWNrYWdlLmpzb25gIGZpbGUuIE5vdGUgdGhhdCB3ZSBhZGQgYSB0cmFpbGluZyBuZXcgbGluZVxuICAgIC8vIHRvIGF2b2lkIHVubmVjZXNzYXJ5IGRpZmYuIElERXMgdXN1YWxseSBhZGQgYSB0cmFpbGluZyBuZXcgbGluZS5cbiAgICBhd2FpdCBmcy53cml0ZUZpbGUocGtnSnNvblBhdGgsIGAke0pTT04uc3RyaW5naWZ5KHBrZ0pzb24sIG51bGwsIDIpfVxcbmApO1xuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFVwZGF0ZWQgcHJvamVjdCB2ZXJzaW9uIHRvICR7cGtnSnNvbi52ZXJzaW9ufWApKTtcblxuICAgIGlmICh0aGlzLmNvbmZpZy5ydWxlc0pzSW50ZXJvcE1vZGUgJiYgZXhpc3RzU3luYyhwYXRoLmpvaW4odGhpcy5wcm9qZWN0RGlyLCAnLmFzcGVjdCcpKSkge1xuICAgICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VCYXplbFVwZGF0ZUFzcGVjdExvY2tGaWxlcyh0aGlzLnByb2plY3REaXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAqIEdldCB0aGUgbW9kaWZpZWQgQXNwZWN0IGxvY2sgZmlsZXMgaWYgYHJ1bGVzSnNJbnRlcm9wTW9kZWAgaXMgZW5hYmxlZC5cbiAgICovXG4gIHByb3RlY3RlZCBnZXRBc3BlY3RMb2NrRmlsZXMoKTogc3RyaW5nW10ge1xuICAgIC8vIFRPRE86IFJlbW92ZSBhZnRlciBgcnVsZXNfanNgIG1pZ3JhdGlvbiBpcyBjb21wbGV0ZS5cbiAgICByZXR1cm4gdGhpcy5jb25maWcucnVsZXNKc0ludGVyb3BNb2RlXG4gICAgICA/IGdsb2Iuc3luYyhbJy5hc3BlY3QvKionLCAncG5wbS1sb2NrLnlhbWwnXSwge2N3ZDogdGhpcy5wcm9qZWN0RGlyfSlcbiAgICAgIDogW107XG4gIH1cblxuICAvKiogR2V0cyB0aGUgbW9zdCByZWNlbnQgY29tbWl0IG9mIGEgc3BlY2lmaWVkIGJyYW5jaC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGdldExhdGVzdENvbW1pdE9mQnJhbmNoKGJyYW5jaE5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qge1xuICAgICAgZGF0YToge2NvbW1pdH0sXG4gICAgfSA9IGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5yZXBvcy5nZXRCcmFuY2goey4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcywgYnJhbmNoOiBicmFuY2hOYW1lfSk7XG4gICAgcmV0dXJuIGNvbW1pdC5zaGE7XG4gIH1cblxuICAvKiogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIHJldmlzaW9uIGlzIGFoZWFkIHRvIHRoZSBiYXNlIGJ5IHRoZSBzcGVjaWZpZWQgYW1vdW50LiAqL1xuICBwcml2YXRlIGFzeW5jIF9pc1JldmlzaW9uQWhlYWRPZkJhc2UoXG4gICAgYmFzZVJldmlzaW9uOiBzdHJpbmcsXG4gICAgdGFyZ2V0UmV2aXNpb246IHN0cmluZyxcbiAgICBleHBlY3RlZEFoZWFkQ291bnQ6IG51bWJlcixcbiAgKSB7XG4gICAgY29uc3Qge1xuICAgICAgZGF0YToge2FoZWFkX2J5LCBzdGF0dXN9LFxuICAgIH0gPSBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuY29tcGFyZUNvbW1pdHMoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgYmFzZTogYmFzZVJldmlzaW9uLFxuICAgICAgaGVhZDogdGFyZ2V0UmV2aXNpb24sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3RhdHVzID09PSAnYWhlYWQnICYmIGFoZWFkX2J5ID09PSBleHBlY3RlZEFoZWFkQ291bnQ7XG4gIH1cblxuICAvKipcbiAgICogVmVyaWZpZXMgdGhhdCB0aGUgZ2l2ZW4gY29tbWl0IGhhcyBwYXNzaW5nIGFsbCBzdGF0dXNlcy5cbiAgICpcbiAgICogVXBvbiBlcnJvciwgYSBsaW5rIHRvIHRoZSBicmFuY2ggY29udGFpbmluZyB0aGUgY29tbWl0IGlzIHByaW50ZWQsXG4gICAqIGFsbG93aW5nIHRoZSBjYXJldGFrZXIgdG8gcXVpY2tseSBpbnNwZWN0IHRoZSBHaXRIdWIgY29tbWl0IHN0YXR1cyBmYWlsdXJlcy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBhc3NlcnRQYXNzaW5nR2l0aHViU3RhdHVzKGNvbW1pdFNoYTogc3RyaW5nLCBicmFuY2hOYW1lRm9yRXJyb3I6IHN0cmluZykge1xuICAgIGNvbnN0IHtyZXN1bHR9ID0gYXdhaXQgZ2l0aHViTWFjcm9zLmdldENvbWJpbmVkQ2hlY2tzQW5kU3RhdHVzZXNGb3JSZWYodGhpcy5naXQuZ2l0aHViLCB7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICByZWY6IGNvbW1pdFNoYSxcbiAgICB9KTtcbiAgICBjb25zdCBicmFuY2hDb21taXRzVXJsID0gZ2V0TGlzdENvbW1pdHNJbkJyYW5jaFVybCh0aGlzLmdpdCwgYnJhbmNoTmFtZUZvckVycm9yKTtcblxuICAgIGlmIChyZXN1bHQgPT09ICdmYWlsaW5nJyB8fCByZXN1bHQgPT09IG51bGwpIHtcbiAgICAgIExvZy5lcnJvcihcbiAgICAgICAgYCAg4pyYICAgQ2Fubm90IHN0YWdlIHJlbGVhc2UuIENvbW1pdCBcIiR7Y29tbWl0U2hhfVwiIGRvZXMgbm90IHBhc3MgYWxsIGdpdGh1YiBgICtcbiAgICAgICAgICAnc3RhdHVzIGNoZWNrcy4gUGxlYXNlIG1ha2Ugc3VyZSB0aGlzIGNvbW1pdCBwYXNzZXMgYWxsIGNoZWNrcyBiZWZvcmUgcmUtcnVubmluZy4nLFxuICAgICAgKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgUGxlYXNlIGhhdmUgYSBsb29rIGF0OiAke2JyYW5jaENvbW1pdHNVcmx9YCk7XG5cbiAgICAgIGlmIChhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogJ0RvIHlvdSB3YW50IHRvIGlnbm9yZSB0aGUgR2l0aHViIHN0YXR1cyBhbmQgcHJvY2VlZD8nfSkpIHtcbiAgICAgICAgTG9nLndhcm4oXG4gICAgICAgICAgJyAg4pqgICAgVXBzdHJlYW0gY29tbWl0IGlzIGZhaWxpbmcgQ0kgY2hlY2tzLCBidXQgc3RhdHVzIGhhcyBiZWVuIGZvcmNpYmx5IGlnbm9yZWQuJyxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IFVzZXJBYm9ydGVkUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfSBlbHNlIGlmIChyZXN1bHQgPT09ICdwZW5kaW5nJykge1xuICAgICAgTG9nLmVycm9yKFxuICAgICAgICBgICDinJggICBDb21taXQgXCIke2NvbW1pdFNoYX1cIiBzdGlsbCBoYXMgcGVuZGluZyBnaXRodWIgc3RhdHVzZXMgdGhhdCBgICtcbiAgICAgICAgICAnbmVlZCB0byBzdWNjZWVkIGJlZm9yZSBzdGFnaW5nIGEgcmVsZWFzZS4nLFxuICAgICAgKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgUGxlYXNlIGhhdmUgYSBsb29rIGF0OiAke2JyYW5jaENvbW1pdHNVcmx9YCk7XG4gICAgICBpZiAoYXdhaXQgUHJvbXB0LmNvbmZpcm0oe21lc3NhZ2U6ICdEbyB5b3Ugd2FudCB0byBpZ25vcmUgdGhlIEdpdGh1YiBzdGF0dXMgYW5kIHByb2NlZWQ/J30pKSB7XG4gICAgICAgIExvZy53YXJuKCcgIOKaoCAgIFVwc3RyZWFtIGNvbW1pdCBpcyBwZW5kaW5nIENJLCBidXQgc3RhdHVzIGhhcyBiZWVuIGZvcmNpYmx5IGlnbm9yZWQuJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cblxuICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIFVwc3RyZWFtIGNvbW1pdCBpcyBwYXNzaW5nIGFsbCBnaXRodWIgc3RhdHVzIGNoZWNrcy4nKSk7XG4gIH1cblxuICAvKipcbiAgICogUHJvbXB0cyB0aGUgdXNlciBmb3IgcG90ZW50aWFsIHJlbGVhc2Ugbm90ZXMgZWRpdHMgdGhhdCBuZWVkIHRvIGJlIG1hZGUuIE9uY2VcbiAgICogY29uZmlybWVkLCBhIG5ldyBjb21taXQgZm9yIHRoZSByZWxlYXNlIHBvaW50IGlzIGNyZWF0ZWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgd2FpdEZvckVkaXRzQW5kQ3JlYXRlUmVsZWFzZUNvbW1pdChuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyKSB7XG4gICAgTG9nLndhcm4oXG4gICAgICAnICDimqAgICBQbGVhc2UgcmV2aWV3IHRoZSBjaGFuZ2Vsb2cgYW5kIGVuc3VyZSB0aGF0IHRoZSBsb2cgY29udGFpbnMgb25seSBjaGFuZ2VzICcgK1xuICAgICAgICAndGhhdCBhcHBseSB0byB0aGUgcHVibGljIEFQSSBzdXJmYWNlLicsXG4gICAgKTtcbiAgICBMb2cud2FybignICAgICAgTWFudWFsIGNoYW5nZXMgY2FuIGJlIG1hZGUuIFdoZW4gZG9uZSwgcGxlYXNlIHByb2NlZWQgd2l0aCB0aGUgcHJvbXB0IGJlbG93LicpO1xuXG4gICAgaWYgKCEoYXdhaXQgUHJvbXB0LmNvbmZpcm0oe21lc3NhZ2U6ICdEbyB5b3Ugd2FudCB0byBwcm9jZWVkIGFuZCBjb21taXQgdGhlIGNoYW5nZXM/J30pKSkge1xuICAgICAgdGhyb3cgbmV3IFVzZXJBYm9ydGVkUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuXG4gICAgLy8gQ29tbWl0IG1lc3NhZ2UgZm9yIHRoZSByZWxlYXNlIHBvaW50LlxuICAgIGNvbnN0IGNvbW1pdE1lc3NhZ2UgPSBnZXRDb21taXRNZXNzYWdlRm9yUmVsZWFzZShuZXdWZXJzaW9uKTtcbiAgICBjb25zdCBmaWxlc1RvQ29tbWl0ID0gW1xuICAgICAgd29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGgsXG4gICAgICB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGgsXG4gICAgICAuLi50aGlzLmdldEFzcGVjdExvY2tGaWxlcygpLFxuICAgIF07XG5cbiAgICAvLyBDcmVhdGUgYSByZWxlYXNlIHN0YWdpbmcgY29tbWl0IGluY2x1ZGluZyBjaGFuZ2Vsb2cgYW5kIHZlcnNpb24gYnVtcC5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbW1pdChjb21taXRNZXNzYWdlLCBmaWxlc1RvQ29tbWl0KTtcblxuICAgIC8vIFRoZSBjYXJldGFrZXIgbWF5IGhhdmUgYXR0ZW1wdGVkIHRvIG1ha2UgYWRkaXRpb25hbCBjaGFuZ2VzLiBUaGVzZSBjaGFuZ2VzIHdvdWxkXG4gICAgLy8gbm90IGJlIGNhcHR1cmVkIGludG8gdGhlIHJlbGVhc2UgY29tbWl0LiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgc2hvdWxkIHJlbWFpbiBjbGVhbixcbiAgICAvLyBsaWtlIHdlIGFzc3VtZSBpdCBiZWluZyBjbGVhbiB3aGVuIHdlIHN0YXJ0IHRoZSByZWxlYXNlIGFjdGlvbnMuXG4gICAgaWYgKHRoaXMuZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVW5yZWxhdGVkIGNoYW5nZXMgaGF2ZSBiZWVuIG1hZGUgYXMgcGFydCBvZiB0aGUgY2hhbmdlbG9nIGVkaXRpbmcuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBDcmVhdGVkIHJlbGVhc2UgY29tbWl0IGZvcjogXCIke25ld1ZlcnNpb259XCIuYCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYW4gb3duZWQgZm9yayBmb3IgdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCBvZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyLiBBYm9ydHMgdGhlXG4gICAqIHByb2Nlc3Mgd2l0aCBhbiBlcnJvciBpZiBubyBmb3JrIGNvdWxkIGJlIGZvdW5kLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfZ2V0Rm9ya09mQXV0aGVudGljYXRlZFVzZXIoKTogUHJvbWlzZTxHaXRodWJSZXBvPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLmdpdC5nZXRGb3JrT2ZBdXRoZW50aWNhdGVkVXNlcigpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3Qge293bmVyLCBuYW1lfSA9IHRoaXMuZ2l0LnJlbW90ZUNvbmZpZztcbiAgICAgIExvZy5lcnJvcignICDinJggICBVbmFibGUgdG8gZmluZCBmb3JrIGZvciBjdXJyZW50bHkgYXV0aGVudGljYXRlZCB1c2VyLicpO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgZW5zdXJlIHlvdSBjcmVhdGVkIGEgZm9yayBvZjogJHtvd25lcn0vJHtuYW1lfS5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBDaGVja3Mgd2hldGhlciBhIGdpdmVuIGJyYW5jaCBuYW1lIGlzIHJlc2VydmVkIGluIHRoZSBzcGVjaWZpZWQgcmVwb3NpdG9yeS4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfaXNCcmFuY2hOYW1lUmVzZXJ2ZWRJblJlcG8ocmVwbzogR2l0aHViUmVwbywgbmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5yZXBvcy5nZXRCcmFuY2goe293bmVyOiByZXBvLm93bmVyLCByZXBvOiByZXBvLm5hbWUsIGJyYW5jaDogbmFtZX0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gSWYgdGhlIGVycm9yIGhhcyBhIGBzdGF0dXNgIHByb3BlcnR5IHNldCB0byBgNDA0YCwgdGhlbiB3ZSBrbm93IHRoYXQgdGhlIGJyYW5jaFxuICAgICAgLy8gZG9lcyBub3QgZXhpc3QuIE90aGVyd2lzZSwgaXQgbWlnaHQgYmUgYW4gQVBJIGVycm9yIHRoYXQgd2Ugd2FudCB0byByZXBvcnQvcmUtdGhyb3cuXG4gICAgICBpZiAoaXNHaXRodWJBcGlFcnJvcihlKSAmJiBlLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgLyoqIEZpbmRzIGEgbm9uLXJlc2VydmVkIGJyYW5jaCBuYW1lIGluIHRoZSByZXBvc2l0b3J5IHdpdGggcmVzcGVjdCB0byBhIGJhc2UgbmFtZS4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfZmluZEF2YWlsYWJsZUJyYW5jaE5hbWUocmVwbzogR2l0aHViUmVwbywgYmFzZU5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgbGV0IGN1cnJlbnROYW1lID0gYmFzZU5hbWU7XG4gICAgbGV0IHN1ZmZpeE51bSA9IDA7XG4gICAgd2hpbGUgKGF3YWl0IHRoaXMuX2lzQnJhbmNoTmFtZVJlc2VydmVkSW5SZXBvKHJlcG8sIGN1cnJlbnROYW1lKSkge1xuICAgICAgc3VmZml4TnVtKys7XG4gICAgICBjdXJyZW50TmFtZSA9IGAke2Jhc2VOYW1lfV8ke3N1ZmZpeE51bX1gO1xuICAgIH1cbiAgICByZXR1cm4gY3VycmVudE5hbWU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGxvY2FsIGJyYW5jaCBmcm9tIHRoZSBjdXJyZW50IEdpdCBgSEVBRGAuIFdpbGwgb3ZlcnJpZGVcbiAgICogZXhpc3RpbmcgYnJhbmNoZXMgaW4gY2FzZSBvZiBhIGNvbGxpc2lvbi5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBjcmVhdGVMb2NhbEJyYW5jaEZyb21IZWFkKGJyYW5jaE5hbWU6IHN0cmluZykge1xuICAgIHRoaXMuZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgJy1CJywgYnJhbmNoTmFtZV0pO1xuICB9XG5cbiAgLyoqIFB1c2hlcyB0aGUgY3VycmVudCBHaXQgYEhFQURgIHRvIHRoZSBnaXZlbiByZW1vdGUgYnJhbmNoIGluIHRoZSBjb25maWd1cmVkIHByb2plY3QuICovXG4gIHByb3RlY3RlZCBhc3luYyBwdXNoSGVhZFRvUmVtb3RlQnJhbmNoKGJyYW5jaE5hbWU6IHN0cmluZykge1xuICAgIC8vIFB1c2ggdGhlIGxvY2FsIGBIRUFEYCB0byB0aGUgcmVtb3RlIGJyYW5jaCBpbiB0aGUgY29uZmlndXJlZCBwcm9qZWN0LlxuICAgIHRoaXMuZ2l0LnJ1bihbJ3B1c2gnLCAnLXEnLCB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksIGBIRUFEOnJlZnMvaGVhZHMvJHticmFuY2hOYW1lfWBdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdXNoZXMgdGhlIGN1cnJlbnQgR2l0IGBIRUFEYCB0byBhIGZvcmsgZm9yIHRoZSBjb25maWd1cmVkIHByb2plY3QgdGhhdCBpcyBvd25lZCBieVxuICAgKiB0aGUgYXV0aGVudGljYXRlZCB1c2VyLiBJZiB0aGUgc3BlY2lmaWVkIGJyYW5jaCBuYW1lIGV4aXN0cyBpbiB0aGUgZm9yayBhbHJlYWR5LCBhXG4gICAqIHVuaXF1ZSBvbmUgd2lsbCBiZSBnZW5lcmF0ZWQgYmFzZWQgb24gdGhlIHByb3Bvc2VkIG5hbWUgdG8gYXZvaWQgY29sbGlzaW9ucy5cbiAgICogQHBhcmFtIHByb3Bvc2VkQnJhbmNoTmFtZSBQcm9wb3NlZCBicmFuY2ggbmFtZSBmb3IgdGhlIGZvcmsuXG4gICAqIEBwYXJhbSB0cmFja0xvY2FsQnJhbmNoIFdoZXRoZXIgdGhlIGZvcmsgYnJhbmNoIHNob3VsZCBiZSB0cmFja2VkIGxvY2FsbHkuIGkuZS4gd2hldGhlclxuICAgKiAgIGEgbG9jYWwgYnJhbmNoIHdpdGggcmVtb3RlIHRyYWNraW5nIHNob3VsZCBiZSBzZXQgdXAuXG4gICAqIEByZXR1cm5zIFRoZSBmb3JrIGFuZCBicmFuY2ggbmFtZSBjb250YWluaW5nIHRoZSBwdXNoZWQgY2hhbmdlcy5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX3B1c2hIZWFkVG9Gb3JrKFxuICAgIHByb3Bvc2VkQnJhbmNoTmFtZTogc3RyaW5nLFxuICAgIHRyYWNrTG9jYWxCcmFuY2g6IGJvb2xlYW4sXG4gICk6IFByb21pc2U8e2Zvcms6IEdpdGh1YlJlcG87IGJyYW5jaE5hbWU6IHN0cmluZ30+IHtcbiAgICBjb25zdCBmb3JrID0gYXdhaXQgdGhpcy5fZ2V0Rm9ya09mQXV0aGVudGljYXRlZFVzZXIoKTtcbiAgICAvLyBDb21wdXRlIGEgcmVwb3NpdG9yeSBVUkwgZm9yIHB1c2hpbmcgdG8gdGhlIGZvcmsuIE5vdGUgdGhhdCB3ZSB3YW50IHRvIHJlc3BlY3RcbiAgICAvLyB0aGUgU1NIIG9wdGlvbiBmcm9tIHRoZSBkZXYtaW5mcmEgZ2l0aHViIGNvbmZpZ3VyYXRpb24uXG4gICAgY29uc3QgcmVwb0dpdFVybCA9IGdldFJlcG9zaXRvcnlHaXRVcmwoXG4gICAgICB7Li4uZm9yaywgdXNlU3NoOiB0aGlzLmdpdC5yZW1vdGVDb25maWcudXNlU3NofSxcbiAgICAgIHRoaXMuZ2l0LmdpdGh1YlRva2VuLFxuICAgICk7XG4gICAgY29uc3QgYnJhbmNoTmFtZSA9IGF3YWl0IHRoaXMuX2ZpbmRBdmFpbGFibGVCcmFuY2hOYW1lKGZvcmssIHByb3Bvc2VkQnJhbmNoTmFtZSk7XG4gICAgY29uc3QgcHVzaEFyZ3M6IHN0cmluZ1tdID0gW107XG4gICAgLy8gSWYgYSBsb2NhbCBicmFuY2ggc2hvdWxkIHRyYWNrIHRoZSByZW1vdGUgZm9yayBicmFuY2gsIGNyZWF0ZSBhIGJyYW5jaCBtYXRjaGluZ1xuICAgIC8vIHRoZSByZW1vdGUgYnJhbmNoLiBMYXRlciB3aXRoIHRoZSBgZ2l0IHB1c2hgLCB0aGUgcmVtb3RlIGlzIHNldCBmb3IgdGhlIGJyYW5jaC5cbiAgICBpZiAodHJhY2tMb2NhbEJyYW5jaCkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVMb2NhbEJyYW5jaEZyb21IZWFkKGJyYW5jaE5hbWUpO1xuICAgICAgcHVzaEFyZ3MucHVzaCgnLS1zZXQtdXBzdHJlYW0nKTtcbiAgICB9XG4gICAgLy8gUHVzaCB0aGUgbG9jYWwgYEhFQURgIHRvIHRoZSByZW1vdGUgYnJhbmNoIGluIHRoZSBmb3JrLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ3B1c2gnLCAnLXEnLCByZXBvR2l0VXJsLCBgSEVBRDpyZWZzL2hlYWRzLyR7YnJhbmNoTmFtZX1gLCAuLi5wdXNoQXJnc10pO1xuICAgIHJldHVybiB7Zm9yaywgYnJhbmNoTmFtZX07XG4gIH1cblxuICAvKipcbiAgICogUHVzaGVzIGNoYW5nZXMgdG8gYSBmb3JrIGZvciB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgaXMgb3duZWQgYnkgdGhlIGN1cnJlbnRseVxuICAgKiBhdXRoZW50aWNhdGVkIHVzZXIuIEEgcHVsbCByZXF1ZXN0IGlzIHRoZW4gY3JlYXRlZCBmb3IgdGhlIHB1c2hlZCBjaGFuZ2VzIG9uIHRoZVxuICAgKiBjb25maWd1cmVkIHByb2plY3QgdGhhdCB0YXJnZXRzIHRoZSBzcGVjaWZpZWQgdGFyZ2V0IGJyYW5jaC5cbiAgICogQHJldHVybnMgQW4gb2JqZWN0IGRlc2NyaWJpbmcgdGhlIGNyZWF0ZWQgcHVsbCByZXF1ZXN0LlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHB1c2hDaGFuZ2VzVG9Gb3JrQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgdGFyZ2V0QnJhbmNoOiBzdHJpbmcsXG4gICAgcHJvcG9zZWRGb3JrQnJhbmNoTmFtZTogc3RyaW5nLFxuICAgIHRpdGxlOiBzdHJpbmcsXG4gICAgYm9keT86IHN0cmluZyxcbiAgKTogUHJvbWlzZTxQdWxsUmVxdWVzdD4ge1xuICAgIGNvbnN0IHJlcG9TbHVnID0gYCR7dGhpcy5naXQucmVtb3RlUGFyYW1zLm93bmVyfS8ke3RoaXMuZ2l0LnJlbW90ZVBhcmFtcy5yZXBvfWA7XG4gICAgY29uc3Qge2ZvcmssIGJyYW5jaE5hbWV9ID0gYXdhaXQgdGhpcy5fcHVzaEhlYWRUb0ZvcmsocHJvcG9zZWRGb3JrQnJhbmNoTmFtZSwgdHJ1ZSk7XG4gICAgY29uc3Qge2RhdGF9ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnB1bGxzLmNyZWF0ZSh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBoZWFkOiBgJHtmb3JrLm93bmVyfToke2JyYW5jaE5hbWV9YCxcbiAgICAgIGJhc2U6IHRhcmdldEJyYW5jaCxcbiAgICAgIGJvZHksXG4gICAgICB0aXRsZSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBsYWJlbHMgdG8gdGhlIG5ld2x5IGNyZWF0ZWQgUFIgaWYgcHJvdmlkZWQgaW4gdGhlIGNvbmZpZ3VyYXRpb24uXG4gICAgaWYgKHRoaXMuY29uZmlnLnJlbGVhc2VQckxhYmVscyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIuaXNzdWVzLmFkZExhYmVscyh7XG4gICAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgICAgaXNzdWVfbnVtYmVyOiBkYXRhLm51bWJlcixcbiAgICAgICAgbGFiZWxzOiB0aGlzLmNvbmZpZy5yZWxlYXNlUHJMYWJlbHMsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBDcmVhdGVkIHB1bGwgcmVxdWVzdCAjJHtkYXRhLm51bWJlcn0gaW4gJHtyZXBvU2x1Z30uYCkpO1xuICAgIHJldHVybiB7XG4gICAgICBpZDogZGF0YS5udW1iZXIsXG4gICAgICB1cmw6IGRhdGEuaHRtbF91cmwsXG4gICAgICBmb3JrLFxuICAgICAgZm9ya0JyYW5jaDogYnJhbmNoTmFtZSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBlbmQgcmVsZWFzZXMgbm90ZXMgZm9yIGEgdmVyc2lvbiBwdWJsaXNoZWQgaW4gYSBnaXZlbiBicmFuY2ggdG8gdGhlIGNoYW5nZWxvZyBpblxuICAgKiB0aGUgY3VycmVudCBHaXQgYEhFQURgLiBUaGlzIGlzIHVzZWZ1bCBmb3IgY2hlcnJ5LXBpY2tpbmcgdGhlIGNoYW5nZWxvZy5cbiAgICogQHJldHVybnMgQSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0aGUgcmVsZWFzZSBub3RlcyBoYXZlIGJlZW4gcHJlcGVuZGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHByZXBlbmRSZWxlYXNlTm90ZXNUb0NoYW5nZWxvZyhyZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3Rlcyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHJlbGVhc2VOb3Rlcy5wcmVwZW5kRW50cnlUb0NoYW5nZWxvZ0ZpbGUoKTtcbiAgICBMb2cuaW5mbyhcbiAgICAgIGdyZWVuKGAgIOKckyAgIFVwZGF0ZWQgdGhlIGNoYW5nZWxvZyB0byBjYXB0dXJlIGNoYW5nZXMgZm9yIFwiJHtyZWxlYXNlTm90ZXMudmVyc2lvbn1cIi5gKSxcbiAgICApO1xuICB9XG5cbiAgLyoqIENoZWNrcyBvdXQgYW4gdXBzdHJlYW0gYnJhbmNoIHdpdGggYSBkZXRhY2hlZCBoZWFkLiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY2hlY2tvdXRVcHN0cmVhbUJyYW5jaChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmdpdC5ydW4oWydmZXRjaCcsICctcScsIHRoaXMuZ2l0LmdldFJlcG9HaXRVcmwoKSwgYnJhbmNoTmFtZV0pO1xuICAgIHRoaXMuZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgJ0ZFVENIX0hFQUQnLCAnLS1kZXRhY2gnXSk7XG4gIH1cblxuICAvKiogSW5zdGFsbHMgYWxsIFlhcm4gZGVwZW5kZW5jaWVzIGluIHRoZSBjdXJyZW50IGJyYW5jaC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGluc3RhbGxEZXBlbmRlbmNpZXNGb3JDdXJyZW50QnJhbmNoKCkge1xuICAgIGlmIChhd2FpdCB0aGlzLnBucG1WZXJzaW9uaW5nLmlzVXNpbmdQbnBtKHRoaXMucHJvamVjdERpcikpIHtcbiAgICAgIGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlUG5wbUluc3RhbGwodGhpcy5wcm9qZWN0RGlyLCB0aGlzLnBucG1WZXJzaW9uaW5nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlTW9kdWxlc0RpciA9IGpvaW4odGhpcy5wcm9qZWN0RGlyLCAnbm9kZV9tb2R1bGVzJyk7XG4gICAgLy8gTm90ZTogV2UgZGVsZXRlIGFsbCBjb250ZW50cyBvZiB0aGUgYG5vZGVfbW9kdWxlc2AgZmlyc3QuIFRoaXMgaXMgbmVjZXNzYXJ5XG4gICAgLy8gYmVjYXVzZSBZYXJuIGNvdWxkIHByZXNlcnZlIGV4dHJhbmVvdXMvb3V0ZGF0ZWQgbmVzdGVkIG1vZHVsZXMgdGhhdCB3aWxsIGNhdXNlXG4gICAgLy8gdW5leHBlY3RlZCBidWlsZCBmYWlsdXJlcyB3aXRoIHRoZSBOb2RlSlMgQmF6ZWwgYEBucG1gIHdvcmtzcGFjZSBnZW5lcmF0aW9uLlxuICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvcjogaHR0cHM6Ly9naXRodWIuY29tL3lhcm5wa2cveWFybi9pc3N1ZXMvODE0Ni4gRXZlbiB0aG91Z2hcbiAgICAvLyB3ZSBtaWdodCBiZSBhYmxlIHRvIGZpeCB0aGlzIHdpdGggWWFybiAyKywgaXQgaXMgcmVhc29uYWJsZSBlbnN1cmluZyBjbGVhbiBub2RlIG1vZHVsZXMuXG4gICAgLy8gVE9ETzogUmVtb3ZlIHRoaXMgd2hlbiB3ZSB1c2UgWWFybiAyKyBpbiBhbGwgQW5ndWxhciByZXBvc2l0b3JpZXMuXG4gICAgYXdhaXQgZnMucm0obm9kZU1vZHVsZXNEaXIsIHtmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzfSk7XG4gICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VZYXJuSW5zdGFsbCh0aGlzLnByb2plY3REaXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBjb21taXQgZm9yIHRoZSBzcGVjaWZpZWQgZmlsZXMgd2l0aCB0aGUgZ2l2ZW4gbWVzc2FnZS5cbiAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSBmb3IgdGhlIGNyZWF0ZWQgY29tbWl0XG4gICAqIEBwYXJhbSBmaWxlcyBMaXN0IG9mIHByb2plY3QtcmVsYXRpdmUgZmlsZSBwYXRocyB0byBiZSBjb21taXR0ZWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY3JlYXRlQ29tbWl0KG1lc3NhZ2U6IHN0cmluZywgZmlsZXM6IHN0cmluZ1tdKSB7XG4gICAgLy8gTm90ZTogYGdpdCBhZGRgIHdvdWxkIG5vdCBiZSBuZWVkZWQgaWYgdGhlIGZpbGVzIGFyZSBhbHJlYWR5IGtub3duIHRvXG4gICAgLy8gR2l0LCBidXQgdGhlIHNwZWNpZmllZCBmaWxlcyBjb3VsZCBhbHNvIGJlIG5ld2x5IGNyZWF0ZWQsIGFuZCB1bmtub3duLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ2FkZCcsIC4uLmZpbGVzXSk7XG4gICAgLy8gTm90ZTogYC0tbm8tdmVyaWZ5YCBza2lwcyB0aGUgbWFqb3JpdHkgb2YgY29tbWl0IGhvb2tzIGhlcmUsIGJ1dCB0aGVyZSBhcmUgaG9va3NcbiAgICAvLyBsaWtlIGBwcmVwYXJlLWNvbW1pdC1tZXNzYWdlYCB3aGljaCBzdGlsbCBydW4uIFdlIGhhdmUgc2V0IHRoZSBgSFVTS1k9MGAgZW52aXJvbm1lbnRcbiAgICAvLyB2YXJpYWJsZSBhdCB0aGUgc3RhcnQgb2YgdGhlIHB1Ymxpc2ggY29tbWFuZCB0byBpZ25vcmUgc3VjaCBob29rcyBhcyB3ZWxsLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ2NvbW1pdCcsICctcScsICctLW5vLXZlcmlmeScsICctbScsIG1lc3NhZ2UsIC4uLmZpbGVzXSk7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCBmb3IgdGhlIGN1cnJlbnQgYnJhbmNoLiBBc3N1bWVzIHRoZSBub2RlIG1vZHVsZXNcbiAgICogdG8gYmUgYWxyZWFkeSBpbnN0YWxsZWQgZm9yIHRoZSBjdXJyZW50IGJyYW5jaC5cbiAgICpcbiAgICogQHJldHVybnMgQSBsaXN0IG9mIGJ1aWx0IHJlbGVhc2UgcGFja2FnZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgYnVpbGRSZWxlYXNlRm9yQ3VycmVudEJyYW5jaCgpOiBQcm9taXNlPEJ1aWx0UGFja2FnZVdpdGhJbmZvW10+IHtcbiAgICAvLyBOb3RlIHRoYXQgd2UgZG8gbm90IGRpcmVjdGx5IGNhbGwgdGhlIGJ1aWxkIHBhY2thZ2VzIGZ1bmN0aW9uIGZyb20gdGhlIHJlbGVhc2VcbiAgICAvLyBjb25maWcuIFdlIG9ubHkgd2FudCB0byBidWlsZCBhbmQgcHVibGlzaCBwYWNrYWdlcyB0aGF0IGhhdmUgYmVlbiBjb25maWd1cmVkIGluIHRoZSBnaXZlblxuICAgIC8vIHB1Ymxpc2ggYnJhbmNoLiBlLmcuIGNvbnNpZGVyIHdlIHB1Ymxpc2ggcGF0Y2ggdmVyc2lvbiBhbmQgYSBuZXcgcGFja2FnZSBoYXMgYmVlblxuICAgIC8vIGNyZWF0ZWQgaW4gdGhlIGBuZXh0YCBicmFuY2guIFRoZSBuZXcgcGFja2FnZSB3b3VsZCBub3QgYmUgcGFydCBvZiB0aGUgcGF0Y2ggYnJhbmNoLFxuICAgIC8vIHNvIHdlIGNhbm5vdCBidWlsZCBhbmQgcHVibGlzaCBpdC5cbiAgICBjb25zdCBidWlsdFBhY2thZ2VzID0gYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlQnVpbGQoXG4gICAgICB0aGlzLnByb2plY3REaXIsXG4gICAgICB0aGlzLnBucG1WZXJzaW9uaW5nLFxuICAgICk7XG4gICAgY29uc3QgcmVsZWFzZUluZm8gPSBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZVJlbGVhc2VJbmZvKFxuICAgICAgdGhpcy5wcm9qZWN0RGlyLFxuICAgICAgdGhpcy5wbnBtVmVyc2lvbmluZyxcbiAgICApO1xuXG4gICAgLy8gRXh0ZW5kIHRoZSBidWlsdCBwYWNrYWdlcyB3aXRoIHRoZWlyIGRpc2sgaGFzaCBhbmQgTlBNIHBhY2thZ2UgaW5mb3JtYXRpb24uIFRoaXMgaXNcbiAgICAvLyBoZWxwZnVsIGxhdGVyIGZvciB2ZXJpZnlpbmcgaW50ZWdyaXR5IGFuZCBmaWx0ZXJpbmcgb3V0IGUuZy4gZXhwZXJpbWVudGFsIHBhY2thZ2VzLlxuICAgIHJldHVybiBhbmFseXplQW5kRXh0ZW5kQnVpbHRQYWNrYWdlc1dpdGhJbmZvKGJ1aWx0UGFja2FnZXMsIHJlbGVhc2VJbmZvLm5wbVBhY2thZ2VzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFnZXMgdGhlIHNwZWNpZmllZCBuZXcgdmVyc2lvbiBmb3IgdGhlIGN1cnJlbnQgYnJhbmNoLCBidWlsZHMgdGhlIHJlbGVhc2Ugb3V0cHV0LFxuICAgKiB2ZXJpZmllcyBpdHMgb3V0cHV0IGFuZCBjcmVhdGVzIGEgcHVsbCByZXF1ZXN0ICB0aGF0IHRhcmdldHMgdGhlIGdpdmVuIGJhc2UgYnJhbmNoLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoZSBzdGFnaW5nIGJyYW5jaCBpcyBhbHJlYWR5IGNoZWNrZWQtb3V0LlxuICAgKlxuICAgKiBAcGFyYW0gbmV3VmVyc2lvbiBOZXcgdmVyc2lvbiB0byBiZSBzdGFnZWQuXG4gICAqIEBwYXJhbSBjb21wYXJlVmVyc2lvbkZvclJlbGVhc2VOb3RlcyBWZXJzaW9uIHVzZWQgZm9yIGNvbXBhcmluZyB3aXRoIHRoZSBjdXJyZW50XG4gICAqICAgYEhFQURgIGluIG9yZGVyIGJ1aWxkIHRoZSByZWxlYXNlIG5vdGVzLlxuICAgKiBAcGFyYW0gcHVsbFJlcXVlc3RUYXJnZXRCcmFuY2ggQnJhbmNoIHRoZSBwdWxsIHJlcXVlc3Qgc2hvdWxkIHRhcmdldC5cbiAgICogQHBhcmFtIG9wdHMgTm9uLW1hbmRhdG9yeSBvcHRpb25zIGZvciBjb250cm9sbGluZyB0aGUgc3RhZ2luZywgZS5nLlxuICAgKiAgIGFsbG93aW5nIGZvciBhZGRpdGlvbmFsIGBwYWNrYWdlLmpzb25gIG1vZGlmaWNhdGlvbnMuXG4gICAqIEByZXR1cm5zIGFuIG9iamVjdCBjYXB0dXJpbmcgYWN0aW9ucyBwZXJmb3JtZWQgYXMgcGFydCBvZiBzdGFnaW5nLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHN0YWdlVmVyc2lvbkZvckJyYW5jaEFuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgIG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXM6IHNlbXZlci5TZW1WZXIsXG4gICAgcHVsbFJlcXVlc3RUYXJnZXRCcmFuY2g6IHN0cmluZyxcbiAgICBvcHRzPzogU3RhZ2luZ09wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzO1xuICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdDtcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW107XG4gIH0+IHtcbiAgICBjb25zdCByZWxlYXNlTm90ZXNDb21wYXJlVGFnID0gZ2V0UmVsZWFzZVRhZ0ZvclZlcnNpb24oY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMpO1xuXG4gICAgLy8gRmV0Y2ggdGhlIGNvbXBhcmUgdGFnIHNvIHRoYXQgY29tbWl0cyBmb3IgdGhlIHJlbGVhc2Ugbm90ZXMgY2FuIGJlIGRldGVybWluZWQuXG4gICAgLy8gV2UgZm9yY2libHkgb3ZlcnJpZGUgZXhpc3RpbmcgbG9jYWwgdGFncyB0aGF0IGFyZSBuYW1lZCBzaW1pbGFyIGFzIHdlIHdpbGwgZmV0Y2hcbiAgICAvLyB0aGUgY29ycmVjdCB0YWcgZm9yIHJlbGVhc2Ugbm90ZXMgY29tcGFyaXNvbiBmcm9tIHRoZSB1cHN0cmVhbSByZW1vdGUuXG4gICAgdGhpcy5naXQucnVuKFtcbiAgICAgICdmZXRjaCcsXG4gICAgICAnLS1mb3JjZScsXG4gICAgICB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksXG4gICAgICBgcmVmcy90YWdzLyR7cmVsZWFzZU5vdGVzQ29tcGFyZVRhZ306cmVmcy90YWdzLyR7cmVsZWFzZU5vdGVzQ29tcGFyZVRhZ31gLFxuICAgIF0pO1xuXG4gICAgLy8gQnVpbGQgcmVsZWFzZSBub3RlcyBmb3IgY29tbWl0cyBmcm9tIGA8cmVsZWFzZU5vdGVzQ29tcGFyZVRhZz4uLkhFQURgLlxuICAgIGNvbnN0IHJlbGVhc2VOb3RlcyA9IGF3YWl0IFJlbGVhc2VOb3Rlcy5mb3JSYW5nZShcbiAgICAgIHRoaXMuZ2l0LFxuICAgICAgbmV3VmVyc2lvbixcbiAgICAgIHJlbGVhc2VOb3Rlc0NvbXBhcmVUYWcsXG4gICAgICAnSEVBRCcsXG4gICAgKTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdFZlcnNpb24obmV3VmVyc2lvbiwgb3B0cz8udXBkYXRlUGtnSnNvbkZuKTtcbiAgICBhd2FpdCB0aGlzLnByZXBlbmRSZWxlYXNlTm90ZXNUb0NoYW5nZWxvZyhyZWxlYXNlTm90ZXMpO1xuICAgIGF3YWl0IHRoaXMud2FpdEZvckVkaXRzQW5kQ3JlYXRlUmVsZWFzZUNvbW1pdChuZXdWZXJzaW9uKTtcblxuICAgIC8vIEluc3RhbGwgdGhlIHByb2plY3QgZGVwZW5kZW5jaWVzIGZvciB0aGUgcHVibGlzaCBicmFuY2guXG4gICAgYXdhaXQgdGhpcy5pbnN0YWxsRGVwZW5kZW5jaWVzRm9yQ3VycmVudEJyYW5jaCgpO1xuXG4gICAgY29uc3QgYnVpbHRQYWNrYWdlc1dpdGhJbmZvID0gYXdhaXQgdGhpcy5idWlsZFJlbGVhc2VGb3JDdXJyZW50QnJhbmNoKCk7XG5cbiAgICAvLyBSdW4gcmVsZWFzZSBwcmUtY2hlY2tzIChlLmcuIHZhbGlkYXRpbmcgdGhlIHJlbGVhc2Ugb3V0cHV0KS5cbiAgICBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZVJlbGVhc2VQcmVjaGVjayhcbiAgICAgIHRoaXMucHJvamVjdERpcixcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgICBidWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gICAgICB0aGlzLnBucG1WZXJzaW9uaW5nLFxuICAgICk7XG5cbiAgICAvLyBWZXJpZnkgdGhlIHBhY2thZ2VzIGJ1aWx0IGFyZSB0aGUgY29ycmVjdCB2ZXJzaW9uLlxuICAgIGF3YWl0IHRoaXMuX3ZlcmlmeVBhY2thZ2VWZXJzaW9ucyhyZWxlYXNlTm90ZXMudmVyc2lvbiwgYnVpbHRQYWNrYWdlc1dpdGhJbmZvKTtcblxuICAgIGNvbnN0IHB1bGxSZXF1ZXN0ID0gYXdhaXQgdGhpcy5wdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgcHVsbFJlcXVlc3RUYXJnZXRCcmFuY2gsXG4gICAgICBgcmVsZWFzZS1zdGFnZS0ke25ld1ZlcnNpb259YCxcbiAgICAgIGBCdW1wIHZlcnNpb24gdG8gXCJ2JHtuZXdWZXJzaW9ufVwiIHdpdGggY2hhbmdlbG9nLmAsXG4gICAgKTtcblxuICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIFJlbGVhc2Ugc3RhZ2luZyBwdWxsIHJlcXVlc3QgaGFzIGJlZW4gY3JlYXRlZC4nKSk7XG5cbiAgICByZXR1cm4ge3JlbGVhc2VOb3RlcywgcHVsbFJlcXVlc3QsIGJ1aWx0UGFja2FnZXNXaXRoSW5mb307XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIG91dCB0aGUgc3BlY2lmaWVkIHRhcmdldCBicmFuY2gsIHZlcmlmaWVzIGl0cyBDSSBzdGF0dXMgYW5kIHN0YWdlc1xuICAgKiB0aGUgc3BlY2lmaWVkIG5ldyB2ZXJzaW9uIGluIG9yZGVyIHRvIGNyZWF0ZSBhIHB1bGwgcmVxdWVzdC5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IHZlcnNpb24gdG8gYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgVmVyc2lvbiB1c2VkIGZvciBjb21wYXJpbmcgd2l0aCBgSEVBRGAgb2ZcbiAgICogICB0aGUgc3RhZ2luZyBicmFuY2ggaW4gb3JkZXIgYnVpbGQgdGhlIHJlbGVhc2Ugbm90ZXMuXG4gICAqIEBwYXJhbSBzdGFnaW5nQnJhbmNoIEJyYW5jaCB3aXRoaW4gdGhlIG5ldyB2ZXJzaW9uIHNob3VsZCBiZSBzdGFnZWQuXG4gICAqIEBwYXJhbSBzdGFnaW5nT3B0aW9ucyBOb24tbWFuZGF0b3J5IG9wdGlvbnMgZm9yIGNvbnRyb2xsaW5nIHRoZSBzdGFnaW5nIG9mXG4gICAqICAgdGhlIG5ldyB2ZXJzaW9uLiBlLmcuIGFsbG93aW5nIGZvciBhZGRpdGlvbmFsIGBwYWNrYWdlLmpzb25gIG1vZGlmaWNhdGlvbnMuXG4gICAqIEByZXR1cm5zIGFuIG9iamVjdCBjYXB0dXJpbmcgYWN0aW9ucyBwZXJmb3JtZWQgYXMgcGFydCBvZiBzdGFnaW5nLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNoZWNrb3V0QnJhbmNoQW5kU3RhZ2VWZXJzaW9uKFxuICAgIG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXM6IHNlbXZlci5TZW1WZXIsXG4gICAgc3RhZ2luZ0JyYW5jaDogc3RyaW5nLFxuICAgIHN0YWdpbmdPcHRzPzogU3RhZ2luZ09wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzO1xuICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdDtcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW107XG4gICAgYmVmb3JlU3RhZ2luZ1NoYTogc3RyaW5nO1xuICB9PiB7XG4gICAgLy8gS2VlcCB0cmFjayBvZiB0aGUgY29tbWl0IHdoZXJlIHdlIHN0YXJ0ZWQgdGhlIHN0YWdpbmcgcHJvY2VzcyBvbi4gVGhpcyB3aWxsIGJlIHVzZWRcbiAgICAvLyBsYXRlciB0byBlbnN1cmUgdGhhdCBubyBjaGFuZ2VzLCBleGNlcHQgZm9yIHRoZSB2ZXJzaW9uIGJ1bXAgaGF2ZSBsYW5kZWQgYXMgcGFydFxuICAgIC8vIG9mIHRoZSBzdGFnaW5nIHRpbWUgd2luZG93ICh3aGVyZSB0aGUgY2FyZXRha2VyIGNvdWxkIGFjY2lkZW50YWxseSBsYW5kIG90aGVyIHN0dWZmKS5cbiAgICBjb25zdCBiZWZvcmVTdGFnaW5nU2hhID0gYXdhaXQgdGhpcy5nZXRMYXRlc3RDb21taXRPZkJyYW5jaChzdGFnaW5nQnJhbmNoKTtcblxuICAgIGF3YWl0IHRoaXMuYXNzZXJ0UGFzc2luZ0dpdGh1YlN0YXR1cyhiZWZvcmVTdGFnaW5nU2hhLCBzdGFnaW5nQnJhbmNoKTtcbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2goc3RhZ2luZ0JyYW5jaCk7XG5cbiAgICBjb25zdCBzdGFnaW5nSW5mbyA9IGF3YWl0IHRoaXMuc3RhZ2VWZXJzaW9uRm9yQnJhbmNoQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgICBuZXdWZXJzaW9uLFxuICAgICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMsXG4gICAgICBzdGFnaW5nQnJhbmNoLFxuICAgICAgc3RhZ2luZ09wdHMsXG4gICAgKTtcblxuICAgIHJldHVybiB7XG4gICAgICAuLi5zdGFnaW5nSW5mbyxcbiAgICAgIGJlZm9yZVN0YWdpbmdTaGEsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVycnktcGlja3MgdGhlIHJlbGVhc2Ugbm90ZXMgb2YgYSB2ZXJzaW9uIHRoYXQgaGF2ZSBiZWVuIHB1c2hlZCB0byBhIGdpdmVuIGJyYW5jaFxuICAgKiBpbnRvIHRoZSBgbmV4dGAgcHJpbWFyeSBkZXZlbG9wbWVudCBicmFuY2guIEEgcHVsbCByZXF1ZXN0IGlzIGNyZWF0ZWQgZm9yIHRoaXMuXG4gICAqIEByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3NmdWwgY3JlYXRpb24gb2YgdGhlIGNoZXJyeS1waWNrIHB1bGwgcmVxdWVzdC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBjaGVycnlQaWNrQ2hhbmdlbG9nSW50b05leHRCcmFuY2goXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgc3RhZ2luZ0JyYW5jaDogc3RyaW5nLFxuICApOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBuZXh0QnJhbmNoID0gdGhpcy5hY3RpdmUubmV4dC5icmFuY2hOYW1lO1xuICAgIGNvbnN0IGNvbW1pdE1lc3NhZ2UgPSBnZXRSZWxlYXNlTm90ZUNoZXJyeVBpY2tDb21taXRNZXNzYWdlKHJlbGVhc2VOb3Rlcy52ZXJzaW9uKTtcblxuICAgIC8vIENoZWNrb3V0IHRoZSBuZXh0IGJyYW5jaC5cbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2gobmV4dEJyYW5jaCk7XG5cbiAgICBhd2FpdCB0aGlzLnByZXBlbmRSZWxlYXNlTm90ZXNUb0NoYW5nZWxvZyhyZWxlYXNlTm90ZXMpO1xuXG4gICAgLy8gQ3JlYXRlIGEgY2hhbmdlbG9nIGNoZXJyeS1waWNrIGNvbW1pdC5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbW1pdChjb21taXRNZXNzYWdlLCBbd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoXSk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCBjaGFuZ2Vsb2cgY2hlcnJ5LXBpY2sgY29tbWl0IGZvcjogXCIke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufVwiLmApKTtcblxuICAgIC8vIENyZWF0ZSBhIGNoZXJyeS1waWNrIHB1bGwgcmVxdWVzdCB0aGF0IHNob3VsZCBiZSBtZXJnZWQgYnkgdGhlIGNhcmV0YWtlci5cbiAgICBjb25zdCBwdWxsUmVxdWVzdCA9IGF3YWl0IHRoaXMucHVzaENoYW5nZXNUb0ZvcmtBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICAgIG5leHRCcmFuY2gsXG4gICAgICBgY2hhbmdlbG9nLWNoZXJyeS1waWNrLSR7cmVsZWFzZU5vdGVzLnZlcnNpb259YCxcbiAgICAgIGNvbW1pdE1lc3NhZ2UsXG4gICAgICBgQ2hlcnJ5LXBpY2tzIHRoZSBjaGFuZ2Vsb2cgZnJvbSB0aGUgXCIke3N0YWdpbmdCcmFuY2h9XCIgYnJhbmNoIHRvIHRoZSBuZXh0IGAgK1xuICAgICAgICBgYnJhbmNoICgke25leHRCcmFuY2h9KS5gLFxuICAgICk7XG5cbiAgICBMb2cuaW5mbyhcbiAgICAgIGdyZWVuKFxuICAgICAgICBgICDinJMgICBQdWxsIHJlcXVlc3QgZm9yIGNoZXJyeS1waWNraW5nIHRoZSBjaGFuZ2Vsb2cgaW50byBcIiR7bmV4dEJyYW5jaH1cIiBgICtcbiAgICAgICAgICAnaGFzIGJlZW4gY3JlYXRlZC4nLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgYXdhaXQgdGhpcy5wcm9tcHRBbmRXYWl0Rm9yUHVsbFJlcXVlc3RNZXJnZWQocHVsbFJlcXVlc3QpO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKiogUHJvbXB0cyB0aGUgdXNlciBmb3IgbWVyZ2luZyB0aGUgcHVsbCByZXF1ZXN0LCBhbmQgd2FpdHMgZm9yIGl0IHRvIGJlIG1lcmdlZC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHByb21wdEFuZFdhaXRGb3JQdWxsUmVxdWVzdE1lcmdlZChwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBwcm9tcHRUb0luaXRpYXRlUHVsbFJlcXVlc3RNZXJnZSh0aGlzLmdpdCwgcHVsbFJlcXVlc3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBHaXRodWIgcmVsZWFzZSBmb3IgdGhlIHNwZWNpZmllZCB2ZXJzaW9uLiBUaGUgcmVsZWFzZSBpcyBjcmVhdGVkXG4gICAqIGJ5IHRhZ2dpbmcgdGhlIHZlcnNpb24gYnVtcCBjb21taXQsIGFuZCBieSBjcmVhdGluZyB0aGUgcmVsZWFzZSBlbnRyeS5cbiAgICpcbiAgICogRXhwZWN0cyB0aGUgdmVyc2lvbiBidW1wIGNvbW1pdCBhbmQgY2hhbmdlbG9nIHRvIGJlIGF2YWlsYWJsZSBpbiB0aGVcbiAgICogdXBzdHJlYW0gcmVtb3RlLlxuICAgKlxuICAgKiBAcGFyYW0gcmVsZWFzZU5vdGVzIFRoZSByZWxlYXNlIG5vdGVzIGZvciB0aGUgdmVyc2lvbiBiZWluZyBwdWJsaXNoZWQuXG4gICAqIEBwYXJhbSB2ZXJzaW9uQnVtcENvbW1pdFNoYSBDb21taXQgdGhhdCBidW1wZWQgdGhlIHZlcnNpb24uIFRoZSByZWxlYXNlIHRhZ1xuICAgKiAgIHdpbGwgcG9pbnQgdG8gdGhpcyBjb21taXQuXG4gICAqIEBwYXJhbSBpc1ByZXJlbGVhc2UgV2hldGhlciB0aGUgbmV3IHZlcnNpb24gaXMgcHVibGlzaGVkIGFzIGEgcHJlLXJlbGVhc2UuXG4gICAqIEBwYXJhbSBzaG93QXNMYXRlc3RPbkdpdEh1YiBXaGV0aGVyIHRoZSB2ZXJzaW9uIHJlbGVhc2VkIHdpbGwgcmVwcmVzZW50XG4gICAqICAgdGhlIFwibGF0ZXN0XCIgdmVyc2lvbiBvZiB0aGUgcHJvamVjdC4gSS5lLiBHaXRIdWIgd2lsbCBzaG93IHRoaXMgdmVyc2lvbiBhcyBcImxhdGVzdFwiLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfY3JlYXRlR2l0aHViUmVsZWFzZUZvclZlcnNpb24oXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgdmVyc2lvbkJ1bXBDb21taXRTaGE6IHN0cmluZyxcbiAgICBpc1ByZXJlbGVhc2U6IGJvb2xlYW4sXG4gICAgc2hvd0FzTGF0ZXN0T25HaXRIdWI6IGJvb2xlYW4sXG4gICkge1xuICAgIGNvbnN0IHRhZ05hbWUgPSBnZXRSZWxlYXNlVGFnRm9yVmVyc2lvbihyZWxlYXNlTm90ZXMudmVyc2lvbik7XG4gICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLmdpdC5jcmVhdGVSZWYoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgcmVmOiBgcmVmcy90YWdzLyR7dGFnTmFtZX1gLFxuICAgICAgc2hhOiB2ZXJzaW9uQnVtcENvbW1pdFNoYSxcbiAgICB9KTtcbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBUYWdnZWQgdiR7cmVsZWFzZU5vdGVzLnZlcnNpb259IHJlbGVhc2UgdXBzdHJlYW0uYCkpO1xuXG4gICAgbGV0IHJlbGVhc2VCb2R5ID0gYXdhaXQgcmVsZWFzZU5vdGVzLmdldEdpdGh1YlJlbGVhc2VFbnRyeSgpO1xuXG4gICAgLy8gSWYgdGhlIHJlbGVhc2UgYm9keSBleGNlZWRzIHRoZSBHaXRodWIgYm9keSBsaW1pdCwgd2UganVzdCBwcm92aWRlXG4gICAgLy8gYSBsaW5rIHRvIHRoZSBjaGFuZ2Vsb2cgZW50cnkgaW4gdGhlIEdpdGh1YiByZWxlYXNlIGVudHJ5LlxuICAgIGlmIChyZWxlYXNlQm9keS5sZW5ndGggPiBnaXRodWJSZWxlYXNlQm9keUxpbWl0KSB7XG4gICAgICBjb25zdCByZWxlYXNlTm90ZXNVcmwgPSBhd2FpdCB0aGlzLl9nZXRHaXRodWJDaGFuZ2Vsb2dVcmxGb3JSZWYocmVsZWFzZU5vdGVzLCB0YWdOYW1lKTtcbiAgICAgIHJlbGVhc2VCb2R5ID1cbiAgICAgICAgYFJlbGVhc2Ugbm90ZXMgYXJlIHRvbyBsYXJnZSB0byBiZSBjYXB0dXJlZCBoZXJlLiBgICtcbiAgICAgICAgYFtWaWV3IGFsbCBjaGFuZ2VzIGhlcmVdKCR7cmVsZWFzZU5vdGVzVXJsfSkuYDtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuY3JlYXRlUmVsZWFzZSh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBuYW1lOiByZWxlYXNlTm90ZXMudmVyc2lvbi50b1N0cmluZygpLFxuICAgICAgdGFnX25hbWU6IHRhZ05hbWUsXG4gICAgICBwcmVyZWxlYXNlOiBpc1ByZXJlbGVhc2UsXG4gICAgICBtYWtlX2xhdGVzdDogc2hvd0FzTGF0ZXN0T25HaXRIdWIgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgICAgYm9keTogcmVsZWFzZUJvZHksXG4gICAgfSk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCB2JHtyZWxlYXNlTm90ZXMudmVyc2lvbn0gcmVsZWFzZSBpbiBHaXRodWIuYCkpO1xuICB9XG5cbiAgLyoqIEdldHMgYSBHaXRodWIgVVJMIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIHJlbGVhc2Ugbm90ZXMgaW4gdGhlIGdpdmVuIHJlZi4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfZ2V0R2l0aHViQ2hhbmdlbG9nVXJsRm9yUmVmKHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzLCByZWY6IHN0cmluZykge1xuICAgIGNvbnN0IGJhc2VVcmwgPSBnZXRGaWxlQ29udGVudHNVcmwodGhpcy5naXQsIHJlZiwgd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoKTtcbiAgICBjb25zdCB1cmxGcmFnbWVudCA9IGF3YWl0IHJlbGVhc2VOb3Rlcy5nZXRVcmxGcmFnbWVudEZvclJlbGVhc2UoKTtcbiAgICByZXR1cm4gYCR7YmFzZVVybH0jJHt1cmxGcmFnbWVudH1gO1xuICB9XG5cbiAgLyoqXG4gICAqIFB1Ymxpc2hlcyB0aGUgZ2l2ZW4gcGFja2FnZXMgdG8gdGhlIHJlZ2lzdHJ5IGFuZCBtYWtlcyB0aGUgcmVsZWFzZXNcbiAgICogYXZhaWxhYmxlIG9uIEdpdEh1Yi5cbiAgICpcbiAgICogQHBhcmFtIGJ1aWx0UGFja2FnZXNXaXRoSW5mbyBMaXN0IG9mIGJ1aWx0IHBhY2thZ2VzIHRoYXQgd2lsbCBiZSBwdWJsaXNoZWQuXG4gICAqIEBwYXJhbSByZWxlYXNlTm90ZXMgVGhlIHJlbGVhc2Ugbm90ZXMgZm9yIHRoZSB2ZXJzaW9uIGJlaW5nIHB1Ymxpc2hlZC5cbiAgICogQHBhcmFtIGJlZm9yZVN0YWdpbmdTaGEgQ29tbWl0IFNIQSB0aGF0IGlzIGV4cGVjdGVkIHRvIGJlIHRoZSBtb3N0IHJlY2VudCBvbmUgYWZ0ZXJcbiAgICogICB0aGUgYWN0dWFsIHZlcnNpb24gYnVtcCBjb21taXQuIFRoaXMgZXhpc3RzIHRvIGVuc3VyZSB0aGF0IGNhcmV0YWtlcnMgZG8gbm90IGxhbmRcbiAgICogICBhZGRpdGlvbmFsIGNoYW5nZXMgYWZ0ZXIgdGhlIHJlbGVhc2Ugb3V0cHV0IGhhcyBiZWVuIGJ1aWx0IGxvY2FsbHkuXG4gICAqIEBwYXJhbSBwdWJsaXNoQnJhbmNoIE5hbWUgb2YgdGhlIGJyYW5jaCB0aGF0IGNvbnRhaW5zIHRoZSBuZXcgdmVyc2lvbi5cbiAgICogQHBhcmFtIG5wbURpc3RUYWcgTlBNIGRpc3QgdGFnIHdoZXJlIHRoZSB2ZXJzaW9uIHNob3VsZCBiZSBwdWJsaXNoZWQgdG8uXG4gICAqIEBwYXJhbSBhZGRpdGlvbmFsT3B0aW9ucyBBZGRpdGlvbmFsIG9wdGlvbnMgbmVlZGVkIGZvciBwdWJsaXNoaW5nIGEgcmVsZWFzZS5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBwdWJsaXNoKFxuICAgIGJ1aWx0UGFja2FnZXNXaXRoSW5mbzogQnVpbHRQYWNrYWdlV2l0aEluZm9bXSxcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcyxcbiAgICBiZWZvcmVTdGFnaW5nU2hhOiBzdHJpbmcsXG4gICAgcHVibGlzaEJyYW5jaDogc3RyaW5nLFxuICAgIG5wbURpc3RUYWc6IE5wbURpc3RUYWcsXG4gICAgYWRkaXRpb25hbE9wdGlvbnM6IHtzaG93QXNMYXRlc3RPbkdpdEh1YjogYm9vbGVhbn0sXG4gICkge1xuICAgIGNvbnN0IHZlcnNpb25CdW1wQ29tbWl0U2hhID0gYXdhaXQgdGhpcy5nZXRMYXRlc3RDb21taXRPZkJyYW5jaChwdWJsaXNoQnJhbmNoKTtcblxuICAgIC8vIEVuc3VyZSB0aGUgbGF0ZXN0IGNvbW1pdCBpbiB0aGUgcHVibGlzaCBicmFuY2ggaXMgdGhlIGJ1bXAgY29tbWl0LlxuICAgIGlmICghKGF3YWl0IHRoaXMuX2lzQ29tbWl0Rm9yVmVyc2lvblN0YWdpbmcocmVsZWFzZU5vdGVzLnZlcnNpb24sIHZlcnNpb25CdW1wQ29tbWl0U2hhKSkpIHtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBMYXRlc3QgY29tbWl0IGluIFwiJHtwdWJsaXNoQnJhbmNofVwiIGJyYW5jaCBpcyBub3QgYSBzdGFnaW5nIGNvbW1pdC5gKTtcbiAgICAgIExvZy5lcnJvcignICAgICAgUGxlYXNlIG1ha2Ugc3VyZSB0aGUgc3RhZ2luZyBwdWxsIHJlcXVlc3QgaGFzIGJlZW4gbWVyZ2VkLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuXG4gICAgLy8gRW5zdXJlIG5vIGNvbW1pdHMgaGF2ZSBsYW5kZWQgc2luY2Ugd2Ugc3RhcnRlZCB0aGUgc3RhZ2luZyBwcm9jZXNzLiBUaGlzIHdvdWxkIHNpZ25pZnlcbiAgICAvLyB0aGF0IHRoZSBsb2NhbGx5LWJ1aWx0IHJlbGVhc2UgcGFja2FnZXMgYXJlIG5vdCBtYXRjaGluZyB3aXRoIHRoZSByZWxlYXNlIGNvbW1pdCBvbiBHaXRIdWIuXG4gICAgLy8gTm90ZTogV2UgZXhwZWN0IHRoZSB2ZXJzaW9uIGJ1bXAgY29tbWl0IHRvIGJlIGFoZWFkIGJ5ICoqb25lKiogY29tbWl0LiBUaGlzIG1lYW5zIGl0J3NcbiAgICAvLyB0aGUgZGlyZWN0IHBhcmVudCBvZiB0aGUgY29tbWl0IHRoYXQgd2FzIGxhdGVzdCB3aGVuIHdlIHN0YXJ0ZWQgdGhlIHN0YWdpbmcuXG4gICAgaWYgKCEoYXdhaXQgdGhpcy5faXNSZXZpc2lvbkFoZWFkT2ZCYXNlKGJlZm9yZVN0YWdpbmdTaGEsIHZlcnNpb25CdW1wQ29tbWl0U2hhLCAxKSkpIHtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBVbmV4cGVjdGVkIGFkZGl0aW9uYWwgY29tbWl0cyBoYXZlIGxhbmRlZCB3aGlsZSBzdGFnaW5nIHRoZSByZWxlYXNlLmApO1xuICAgICAgTG9nLmVycm9yKCcgICAgICBQbGVhc2UgcmV2ZXJ0IHRoZSBidW1wIGNvbW1pdCBhbmQgcmV0cnksIG9yIGN1dCBhIG5ldyB2ZXJzaW9uIG9uIHRvcC4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cblxuICAgIC8vIEJlZm9yZSBwdWJsaXNoaW5nLCB3ZSB3YW50IHRvIGVuc3VyZSB0aGF0IHRoZSBsb2NhbGx5LWJ1aWx0IHBhY2thZ2VzIHdlXG4gICAgLy8gYnVpbHQgaW4gdGhlIHN0YWdpbmcgcGhhc2UgaGF2ZSBub3QgYmVlbiBtb2RpZmllZCBhY2NpZGVudGFsbHkuXG4gICAgYXdhaXQgYXNzZXJ0SW50ZWdyaXR5T2ZCdWlsdFBhY2thZ2VzKGJ1aWx0UGFja2FnZXNXaXRoSW5mbyk7XG5cbiAgICAvLyBDcmVhdGUgYSBHaXRodWIgcmVsZWFzZSBmb3IgdGhlIG5ldyB2ZXJzaW9uLlxuICAgIGF3YWl0IHRoaXMuX2NyZWF0ZUdpdGh1YlJlbGVhc2VGb3JWZXJzaW9uKFxuICAgICAgcmVsZWFzZU5vdGVzLFxuICAgICAgdmVyc2lvbkJ1bXBDb21taXRTaGEsXG4gICAgICBucG1EaXN0VGFnID09PSAnbmV4dCcsXG4gICAgICBhZGRpdGlvbmFsT3B0aW9ucy5zaG93QXNMYXRlc3RPbkdpdEh1YixcbiAgICApO1xuXG4gICAgLy8gV2FsayB0aHJvdWdoIGFsbCBidWlsdCBwYWNrYWdlcyBhbmQgcHVibGlzaCB0aGVtIHRvIE5QTS5cbiAgICBmb3IgKGNvbnN0IHBrZyBvZiBidWlsdFBhY2thZ2VzV2l0aEluZm8pIHtcbiAgICAgIGF3YWl0IHRoaXMuX3B1Ymxpc2hCdWlsdFBhY2thZ2VUb05wbShwa2csIG5wbURpc3RUYWcpO1xuICAgIH1cblxuICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIFB1Ymxpc2hlZCBhbGwgcGFja2FnZXMgc3VjY2Vzc2Z1bGx5JykpO1xuICB9XG5cbiAgLyoqIFB1Ymxpc2hlcyB0aGUgZ2l2ZW4gYnVpbHQgcGFja2FnZSB0byBOUE0gd2l0aCB0aGUgc3BlY2lmaWVkIE5QTSBkaXN0IHRhZy4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfcHVibGlzaEJ1aWx0UGFja2FnZVRvTnBtKHBrZzogQnVpbHRQYWNrYWdlLCBucG1EaXN0VGFnOiBOcG1EaXN0VGFnKSB7XG4gICAgTG9nLmRlYnVnKGBTdGFydGluZyBwdWJsaXNoIG9mIFwiJHtwa2cubmFtZX1cIi5gKTtcbiAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoYFB1Ymxpc2hpbmcgXCIke3BrZy5uYW1lfVwiYCk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgTnBtQ29tbWFuZC5wdWJsaXNoKHBrZy5vdXRwdXRQYXRoLCBucG1EaXN0VGFnLCB0aGlzLmNvbmZpZy5wdWJsaXNoUmVnaXN0cnkpO1xuICAgICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgU3VjY2Vzc2Z1bGx5IHB1Ymxpc2hlZCBcIiR7cGtnLm5hbWV9LmApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcHVibGlzaGluZyBcIiR7cGtnLm5hbWV9XCIuYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKiogQ2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIGNvbW1pdCByZXByZXNlbnRzIGEgc3RhZ2luZyBjb21taXQgZm9yIHRoZSBzcGVjaWZpZWQgdmVyc2lvbi4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfaXNDb21taXRGb3JWZXJzaW9uU3RhZ2luZyh2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyLCBjb21taXRTaGE6IHN0cmluZykge1xuICAgIGNvbnN0IHtkYXRhfSA9IGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5yZXBvcy5nZXRDb21taXQoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgcmVmOiBjb21taXRTaGEsXG4gICAgfSk7XG4gICAgcmV0dXJuIGRhdGEuY29tbWl0Lm1lc3NhZ2Uuc3RhcnRzV2l0aChnZXRDb21taXRNZXNzYWdlRm9yUmVsZWFzZSh2ZXJzaW9uKSk7XG4gIH1cblxuICAvLyBUT0RPOiBSZW1vdmUgdGhpcyBjaGVjayBhbmQgcnVuIGl0IGFzIHBhcnQgb2YgY29tbW9uIHJlbGVhc2UgdmFsaWRhdGlvbi5cbiAgLyoqIFZlcmlmeSB0aGUgdmVyc2lvbiBvZiBlYWNoIGdlbmVyYXRlZCBwYWNrYWdlIGV4YWN0IG1hdGNoZXMgdGhlIHNwZWNpZmllZCB2ZXJzaW9uLiAqL1xuICBwcml2YXRlIGFzeW5jIF92ZXJpZnlQYWNrYWdlVmVyc2lvbnModmVyc2lvbjogc2VtdmVyLlNlbVZlciwgcGFja2FnZXM6IEJ1aWx0UGFja2FnZVdpdGhJbmZvW10pIHtcbiAgICAvLyBFeHBlcmltZW50YWwgZXF1aXZhbGVudCB2ZXJzaW9uIGZvciBwYWNrYWdlcy5cbiAgICBjb25zdCBleHBlcmltZW50YWxWZXJzaW9uID0gY3JlYXRlRXhwZXJpbWVudGFsU2VtdmVyKHZlcnNpb24pO1xuXG4gICAgZm9yIChjb25zdCBwa2cgb2YgcGFja2FnZXMpIHtcbiAgICAgIGNvbnN0IHt2ZXJzaW9uOiBwYWNrYWdlSnNvblZlcnNpb259ID0gSlNPTi5wYXJzZShcbiAgICAgICAgYXdhaXQgZnMucmVhZEZpbGUoam9pbihwa2cub3V0cHV0UGF0aCwgJ3BhY2thZ2UuanNvbicpLCAndXRmOCcpLFxuICAgICAgKSBhcyB7dmVyc2lvbjogc3RyaW5nOyBba2V5OiBzdHJpbmddOiBhbnl9O1xuXG4gICAgICBjb25zdCBleHBlY3RlZFZlcnNpb24gPSBwa2cuZXhwZXJpbWVudGFsID8gZXhwZXJpbWVudGFsVmVyc2lvbiA6IHZlcnNpb247XG4gICAgICBjb25zdCBtaXNtYXRjaGVzVmVyc2lvbiA9IGV4cGVjdGVkVmVyc2lvbi5jb21wYXJlKHBhY2thZ2VKc29uVmVyc2lvbikgIT09IDA7XG5cbiAgICAgIGlmIChtaXNtYXRjaGVzVmVyc2lvbikge1xuICAgICAgICBMb2cuZXJyb3IoYFRoZSBidWlsdCBwYWNrYWdlIHZlcnNpb24gZG9lcyBub3QgbWF0Y2ggZm9yOiAke3BrZy5uYW1lfS5gKTtcbiAgICAgICAgTG9nLmVycm9yKGAgIEFjdHVhbCB2ZXJzaW9uOiAgICR7cGFja2FnZUpzb25WZXJzaW9ufWApO1xuICAgICAgICBMb2cuZXJyb3IoYCAgRXhwZWN0ZWQgdmVyc2lvbjogJHtleHBlY3RlZFZlcnNpb259YCk7XG4gICAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19