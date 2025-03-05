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
            name: `v${releaseNotes.version}`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsUUFBUSxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDOUMsT0FBTyxJQUFJLEVBQUUsRUFBQyxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFHaEMsT0FBTyxFQUFDLGdDQUFnQyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFMUUsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxZQUFZLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUNMLGtCQUFrQixFQUNsQix5QkFBeUIsRUFDekIsbUJBQW1CLEdBQ3BCLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEMsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFL0MsT0FBTyxFQUFDLFlBQVksRUFBRSw4QkFBOEIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBR3ZGLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RSxPQUFPLEVBQUMsdUJBQXVCLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMxRixPQUFPLEVBQ0wscUNBQXFDLEVBQ3JDLDhCQUE4QixHQUMvQixNQUFNLHlCQUF5QixDQUFDO0FBQ2pDLE9BQU8sRUFDTCwwQkFBMEIsRUFDMUIscUNBQXFDLEdBQ3RD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LENBQUMsdUJBQXVCLGtCQUFrQixFQUFFLENBQUMsQ0FBQztnQkFDdkQsR0FBRyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsZUFBZSxFQUFFLENBQUMsQ0FBQztnQkFDcEQsTUFBTSxJQUFJLHVCQUF1QixFQUFFLENBQUM7WUFDdEMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtwcm9taXNlcyBhcyBmcywgZXhpc3RzU3luY30gZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGgsIHtqb2lufSBmcm9tICdwYXRoJztcbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcblxuaW1wb3J0IHt3b3Jrc3BhY2VSZWxhdGl2ZVBhY2thZ2VKc29uUGF0aH0gZnJvbSAnLi4vLi4vdXRpbHMvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge2lzR2l0aHViQXBpRXJyb3J9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWIuanMnO1xuaW1wb3J0IGdpdGh1Yk1hY3JvcyBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLW1hY3Jvcy5qcyc7XG5pbXBvcnQge1xuICBnZXRGaWxlQ29udGVudHNVcmwsXG4gIGdldExpc3RDb21taXRzSW5CcmFuY2hVcmwsXG4gIGdldFJlcG9zaXRvcnlHaXRVcmwsXG59IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWItdXJscy5qcyc7XG5pbXBvcnQge2dyZWVuLCBMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7QnVpbHRQYWNrYWdlLCBCdWlsdFBhY2thZ2VXaXRoSW5mbywgUmVsZWFzZUNvbmZpZ30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7UmVsZWFzZU5vdGVzLCB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGh9IGZyb20gJy4uL25vdGVzL3JlbGVhc2Utbm90ZXMuanMnO1xuaW1wb3J0IHtOcG1EaXN0VGFnLCBQYWNrYWdlSnNvbn0gZnJvbSAnLi4vdmVyc2lvbmluZy9pbmRleC5qcyc7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7Y3JlYXRlRXhwZXJpbWVudGFsU2VtdmVyfSBmcm9tICcuLi92ZXJzaW9uaW5nL2V4cGVyaW1lbnRhbC12ZXJzaW9ucy5qcyc7XG5pbXBvcnQge05wbUNvbW1hbmR9IGZyb20gJy4uL3ZlcnNpb25pbmcvbnBtLWNvbW1hbmQuanMnO1xuaW1wb3J0IHtnZXRSZWxlYXNlVGFnRm9yVmVyc2lvbn0gZnJvbSAnLi4vdmVyc2lvbmluZy92ZXJzaW9uLXRhZ3MuanMnO1xuaW1wb3J0IHtGYXRhbFJlbGVhc2VBY3Rpb25FcnJvciwgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3J9IGZyb20gJy4vYWN0aW9ucy1lcnJvci5qcyc7XG5pbXBvcnQge1xuICBhbmFseXplQW5kRXh0ZW5kQnVpbHRQYWNrYWdlc1dpdGhJbmZvLFxuICBhc3NlcnRJbnRlZ3JpdHlPZkJ1aWx0UGFja2FnZXMsXG59IGZyb20gJy4vYnVpbHQtcGFja2FnZS1pbmZvLmpzJztcbmltcG9ydCB7XG4gIGdldENvbW1pdE1lc3NhZ2VGb3JSZWxlYXNlLFxuICBnZXRSZWxlYXNlTm90ZUNoZXJyeVBpY2tDb21taXRNZXNzYWdlLFxufSBmcm9tICcuL2NvbW1pdC1tZXNzYWdlLmpzJztcbmltcG9ydCB7Z2l0aHViUmVsZWFzZUJvZHlMaW1pdH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHtFeHRlcm5hbENvbW1hbmRzfSBmcm9tICcuL2V4dGVybmFsLWNvbW1hbmRzLmpzJztcbmltcG9ydCB7cHJvbXB0VG9Jbml0aWF0ZVB1bGxSZXF1ZXN0TWVyZ2V9IGZyb20gJy4vcHJvbXB0LW1lcmdlLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtnbG9ifSBmcm9tICdmYXN0LWdsb2InO1xuaW1wb3J0IHtQbnBtVmVyc2lvbmluZ30gZnJvbSAnLi9wbnBtLXZlcnNpb25pbmcuanMnO1xuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgYSBHaXRodWIgcmVwb3NpdG9yeS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgR2l0aHViUmVwbyB7XG4gIG93bmVyOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIGEgR2l0aHViIHB1bGwgcmVxdWVzdC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHVsbFJlcXVlc3Qge1xuICAvKiogVW5pcXVlIGlkIGZvciB0aGUgcHVsbCByZXF1ZXN0IChpLmUuIHRoZSBQUiBudW1iZXIpLiAqL1xuICBpZDogbnVtYmVyO1xuICAvKiogVVJMIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIHB1bGwgcmVxdWVzdCBpbiBHaXRodWIuICovXG4gIHVybDogc3RyaW5nO1xuICAvKiogRm9yayBjb250YWluaW5nIHRoZSBoZWFkIGJyYW5jaCBvZiB0aGlzIHB1bGwgcmVxdWVzdC4gKi9cbiAgZm9yazogR2l0aHViUmVwbztcbiAgLyoqIEJyYW5jaCBuYW1lIGluIHRoZSBmb3JrIHRoYXQgZGVmaW5lcyB0aGlzIHB1bGwgcmVxdWVzdC4gKi9cbiAgZm9ya0JyYW5jaDogc3RyaW5nO1xufVxuXG4vKiogT3B0aW9ucyB0aGF0IGNhbiBiZSB1c2VkIHRvIGNvbnRyb2wgdGhlIHN0YWdpbmcgb2YgYSBuZXcgdmVyc2lvbi4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3RhZ2luZ09wdGlvbnMge1xuICAvKipcbiAgICogQXMgcGFydCBvZiBzdGFnaW5nLCB0aGUgYHBhY2thZ2UuanNvbmAgY2FuIGJlIHVwZGF0ZWQgYmVmb3JlIHRoZVxuICAgKiBuZXcgdmVyc2lvbiBpcyBzZXQuXG4gICAqIEBzZWUge1JlbGVhc2VBY3Rpb24udXBkYXRlUHJvamVjdFZlcnNpb259XG4gICAqL1xuICB1cGRhdGVQa2dKc29uRm4/OiAocGtnSnNvbjogUGFja2FnZUpzb24pID0+IHZvaWQ7XG59XG5cbi8qKiBDb25zdHJ1Y3RvciB0eXBlIGZvciBpbnN0YW50aWF0aW5nIGEgcmVsZWFzZSBhY3Rpb24gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVsZWFzZUFjdGlvbkNvbnN0cnVjdG9yPFQgZXh0ZW5kcyBSZWxlYXNlQWN0aW9uID0gUmVsZWFzZUFjdGlvbj4ge1xuICAvKiogV2hldGhlciB0aGUgcmVsZWFzZSBhY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZS4gKi9cbiAgaXNBY3RpdmUoYWN0aXZlOiBBY3RpdmVSZWxlYXNlVHJhaW5zLCBjb25maWc6IFJlbGVhc2VDb25maWcpOiBQcm9taXNlPGJvb2xlYW4+O1xuICAvKiogQ29uc3RydWN0cyBhIHJlbGVhc2UgYWN0aW9uLiAqL1xuICBuZXcgKC4uLmFyZ3M6IFtBY3RpdmVSZWxlYXNlVHJhaW5zLCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LCBSZWxlYXNlQ29uZmlnLCBzdHJpbmddKTogVDtcbn1cblxuLyoqXG4gKiBBYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBhIHJlbGVhc2UgYWN0aW9uLiBBIHJlbGVhc2UgYWN0aW9uIGlzIHNlbGVjdGFibGUgYnkgdGhlIGNhcmV0YWtlclxuICogaWYgYWN0aXZlLCBhbmQgY2FuIHBlcmZvcm0gY2hhbmdlcyBmb3IgcmVsZWFzaW5nLCBzdWNoIGFzIHN0YWdpbmcgYSByZWxlYXNlLCBidW1waW5nIHRoZVxuICogdmVyc2lvbiwgY2hlcnJ5LXBpY2tpbmcgdGhlIGNoYW5nZWxvZywgYnJhbmNoaW5nIG9mZiBmcm9tIHRoZSBtYWluIGJyYW5jaC4gZXRjLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgUmVsZWFzZUFjdGlvbiB7XG4gIC8qKiBXaGV0aGVyIHRoZSByZWxlYXNlIGFjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlLiAqL1xuICBzdGF0aWMgaXNBY3RpdmUoX3RyYWluczogQWN0aXZlUmVsZWFzZVRyYWlucywgX2NvbmZpZzogUmVsZWFzZUNvbmZpZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRocm93IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICAvKiogR2V0cyB0aGUgZGVzY3JpcHRpb24gZm9yIGEgcmVsZWFzZSBhY3Rpb24uICovXG4gIGFic3RyYWN0IGdldERlc2NyaXB0aW9uKCk6IFByb21pc2U8c3RyaW5nPjtcbiAgLyoqXG4gICAqIFBlcmZvcm1zIHRoZSBnaXZlbiByZWxlYXNlIGFjdGlvbi5cbiAgICogQHRocm93cyB7VXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3J9IFdoZW4gdGhlIHVzZXIgbWFudWFsbHkgYWJvcnRlZCB0aGUgYWN0aW9uLlxuICAgKiBAdGhyb3dzIHtGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcn0gV2hlbiB0aGUgYWN0aW9uIGhhcyBiZWVuIGFib3J0ZWQgZHVlIHRvIGEgZmF0YWwgZXJyb3IuXG4gICAqL1xuICBhYnN0cmFjdCBwZXJmb3JtKCk6IFByb21pc2U8dm9pZD47XG5cbiAgcHJvdGVjdGVkIHBucG1WZXJzaW9uaW5nID0gbmV3IFBucG1WZXJzaW9uaW5nKCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGFjdGl2ZTogQWN0aXZlUmVsZWFzZVRyYWlucyxcbiAgICBwcm90ZWN0ZWQgZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LFxuICAgIHByb3RlY3RlZCBjb25maWc6IFJlbGVhc2VDb25maWcsXG4gICAgcHJvdGVjdGVkIHByb2plY3REaXI6IHN0cmluZyxcbiAgKSB7fVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHRoZSB2ZXJzaW9uIGluIHRoZSBwcm9qZWN0IHRvcC1sZXZlbCBgcGFja2FnZS5qc29uYCBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0gbmV3VmVyc2lvbiBOZXcgU2VtVmVyIHZlcnNpb24gdG8gYmUgc2V0IGluIHRoZSBmaWxlLlxuICAgKiBAcGFyYW0gYWRkaXRpb25hbFVwZGF0ZUZuIE9wdGlvbmFsIHVwZGF0ZSBmdW5jdGlvbiB0aGF0IHJ1bnMgYmVmb3JlXG4gICAqICAgdGhlIHZlcnNpb24gdXBkYXRlLiBDYW4gYmUgdXNlZCB0byB1cGRhdGUgb3RoZXIgZmllbGRzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHVwZGF0ZVByb2plY3RWZXJzaW9uKFxuICAgIG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgYWRkaXRpb25hbFVwZGF0ZUZuPzogKHBrZ0pzb246IFBhY2thZ2VKc29uKSA9PiB2b2lkLFxuICApIHtcbiAgICBjb25zdCBwa2dKc29uUGF0aCA9IGpvaW4odGhpcy5wcm9qZWN0RGlyLCB3b3Jrc3BhY2VSZWxhdGl2ZVBhY2thZ2VKc29uUGF0aCk7XG4gICAgY29uc3QgcGtnSnNvbiA9IEpTT04ucGFyc2UoYXdhaXQgZnMucmVhZEZpbGUocGtnSnNvblBhdGgsICd1dGY4JykpIGFzIHtcbiAgICAgIHZlcnNpb246IHN0cmluZztcbiAgICAgIFtrZXk6IHN0cmluZ106IGFueTtcbiAgICB9O1xuICAgIGlmIChhZGRpdGlvbmFsVXBkYXRlRm4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgYWRkaXRpb25hbFVwZGF0ZUZuKHBrZ0pzb24pO1xuICAgIH1cbiAgICBwa2dKc29uLnZlcnNpb24gPSBuZXdWZXJzaW9uLmZvcm1hdCgpO1xuICAgIC8vIFdyaXRlIHRoZSBgcGFja2FnZS5qc29uYCBmaWxlLiBOb3RlIHRoYXQgd2UgYWRkIGEgdHJhaWxpbmcgbmV3IGxpbmVcbiAgICAvLyB0byBhdm9pZCB1bm5lY2Vzc2FyeSBkaWZmLiBJREVzIHVzdWFsbHkgYWRkIGEgdHJhaWxpbmcgbmV3IGxpbmUuXG4gICAgYXdhaXQgZnMud3JpdGVGaWxlKHBrZ0pzb25QYXRoLCBgJHtKU09OLnN0cmluZ2lmeShwa2dKc29uLCBudWxsLCAyKX1cXG5gKTtcbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBVcGRhdGVkIHByb2plY3QgdmVyc2lvbiB0byAke3BrZ0pzb24udmVyc2lvbn1gKSk7XG5cbiAgICBpZiAodGhpcy5jb25maWcucnVsZXNKc0ludGVyb3BNb2RlICYmIGV4aXN0c1N5bmMocGF0aC5qb2luKHRoaXMucHJvamVjdERpciwgJy5hc3BlY3QnKSkpIHtcbiAgICAgIGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlQmF6ZWxVcGRhdGVBc3BlY3RMb2NrRmlsZXModGhpcy5wcm9qZWN0RGlyKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBHZXQgdGhlIG1vZGlmaWVkIEFzcGVjdCBsb2NrIGZpbGVzIGlmIGBydWxlc0pzSW50ZXJvcE1vZGVgIGlzIGVuYWJsZWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0QXNwZWN0TG9ja0ZpbGVzKCk6IHN0cmluZ1tdIHtcbiAgICAvLyBUT0RPOiBSZW1vdmUgYWZ0ZXIgYHJ1bGVzX2pzYCBtaWdyYXRpb24gaXMgY29tcGxldGUuXG4gICAgcmV0dXJuIHRoaXMuY29uZmlnLnJ1bGVzSnNJbnRlcm9wTW9kZVxuICAgICAgPyBnbG9iLnN5bmMoWycuYXNwZWN0LyoqJywgJ3BucG0tbG9jay55YW1sJ10sIHtjd2Q6IHRoaXMucHJvamVjdERpcn0pXG4gICAgICA6IFtdO1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIG1vc3QgcmVjZW50IGNvbW1pdCBvZiBhIHNwZWNpZmllZCBicmFuY2guICovXG4gIHByb3RlY3RlZCBhc3luYyBnZXRMYXRlc3RDb21taXRPZkJyYW5jaChicmFuY2hOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHtcbiAgICAgIGRhdGE6IHtjb21taXR9LFxuICAgIH0gPSBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuZ2V0QnJhbmNoKHsuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsIGJyYW5jaDogYnJhbmNoTmFtZX0pO1xuICAgIHJldHVybiBjb21taXQuc2hhO1xuICB9XG5cbiAgLyoqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiByZXZpc2lvbiBpcyBhaGVhZCB0byB0aGUgYmFzZSBieSB0aGUgc3BlY2lmaWVkIGFtb3VudC4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfaXNSZXZpc2lvbkFoZWFkT2ZCYXNlKFxuICAgIGJhc2VSZXZpc2lvbjogc3RyaW5nLFxuICAgIHRhcmdldFJldmlzaW9uOiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRBaGVhZENvdW50OiBudW1iZXIsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGRhdGE6IHthaGVhZF9ieSwgc3RhdHVzfSxcbiAgICB9ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnJlcG9zLmNvbXBhcmVDb21taXRzKHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIGJhc2U6IGJhc2VSZXZpc2lvbixcbiAgICAgIGhlYWQ6IHRhcmdldFJldmlzaW9uLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHN0YXR1cyA9PT0gJ2FoZWFkJyAmJiBhaGVhZF9ieSA9PT0gZXhwZWN0ZWRBaGVhZENvdW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlIGdpdmVuIGNvbW1pdCBoYXMgcGFzc2luZyBhbGwgc3RhdHVzZXMuXG4gICAqXG4gICAqIFVwb24gZXJyb3IsIGEgbGluayB0byB0aGUgYnJhbmNoIGNvbnRhaW5pbmcgdGhlIGNvbW1pdCBpcyBwcmludGVkLFxuICAgKiBhbGxvd2luZyB0aGUgY2FyZXRha2VyIHRvIHF1aWNrbHkgaW5zcGVjdCB0aGUgR2l0SHViIGNvbW1pdCBzdGF0dXMgZmFpbHVyZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgYXNzZXJ0UGFzc2luZ0dpdGh1YlN0YXR1cyhjb21taXRTaGE6IHN0cmluZywgYnJhbmNoTmFtZUZvckVycm9yOiBzdHJpbmcpIHtcbiAgICBjb25zdCB7cmVzdWx0fSA9IGF3YWl0IGdpdGh1Yk1hY3Jvcy5nZXRDb21iaW5lZENoZWNrc0FuZFN0YXR1c2VzRm9yUmVmKHRoaXMuZ2l0LmdpdGh1Yiwge1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgcmVmOiBjb21taXRTaGEsXG4gICAgfSk7XG4gICAgY29uc3QgYnJhbmNoQ29tbWl0c1VybCA9IGdldExpc3RDb21taXRzSW5CcmFuY2hVcmwodGhpcy5naXQsIGJyYW5jaE5hbWVGb3JFcnJvcik7XG5cbiAgICBpZiAocmVzdWx0ID09PSAnZmFpbGluZycgfHwgcmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBMb2cuZXJyb3IoXG4gICAgICAgIGAgIOKcmCAgIENhbm5vdCBzdGFnZSByZWxlYXNlLiBDb21taXQgXCIke2NvbW1pdFNoYX1cIiBkb2VzIG5vdCBwYXNzIGFsbCBnaXRodWIgYCArXG4gICAgICAgICAgJ3N0YXR1cyBjaGVja3MuIFBsZWFzZSBtYWtlIHN1cmUgdGhpcyBjb21taXQgcGFzc2VzIGFsbCBjaGVja3MgYmVmb3JlIHJlLXJ1bm5pbmcuJyxcbiAgICAgICk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIFBsZWFzZSBoYXZlIGEgbG9vayBhdDogJHticmFuY2hDb21taXRzVXJsfWApO1xuXG4gICAgICBpZiAoYXdhaXQgUHJvbXB0LmNvbmZpcm0oe21lc3NhZ2U6ICdEbyB5b3Ugd2FudCB0byBpZ25vcmUgdGhlIEdpdGh1YiBzdGF0dXMgYW5kIHByb2NlZWQ/J30pKSB7XG4gICAgICAgIExvZy53YXJuKFxuICAgICAgICAgICcgIOKaoCAgIFVwc3RyZWFtIGNvbW1pdCBpcyBmYWlsaW5nIENJIGNoZWNrcywgYnV0IHN0YXR1cyBoYXMgYmVlbiBmb3JjaWJseSBpZ25vcmVkLicsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH0gZWxzZSBpZiAocmVzdWx0ID09PSAncGVuZGluZycpIHtcbiAgICAgIExvZy5lcnJvcihcbiAgICAgICAgYCAg4pyYICAgQ29tbWl0IFwiJHtjb21taXRTaGF9XCIgc3RpbGwgaGFzIHBlbmRpbmcgZ2l0aHViIHN0YXR1c2VzIHRoYXQgYCArXG4gICAgICAgICAgJ25lZWQgdG8gc3VjY2VlZCBiZWZvcmUgc3RhZ2luZyBhIHJlbGVhc2UuJyxcbiAgICAgICk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIFBsZWFzZSBoYXZlIGEgbG9vayBhdDogJHticmFuY2hDb21taXRzVXJsfWApO1xuICAgICAgaWYgKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gaWdub3JlIHRoZSBHaXRodWIgc3RhdHVzIGFuZCBwcm9jZWVkPyd9KSkge1xuICAgICAgICBMb2cud2FybignICDimqAgICBVcHN0cmVhbSBjb21taXQgaXMgcGVuZGluZyBDSSwgYnV0IHN0YXR1cyBoYXMgYmVlbiBmb3JjaWJseSBpZ25vcmVkLicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBVcHN0cmVhbSBjb21taXQgaXMgcGFzc2luZyBhbGwgZ2l0aHViIHN0YXR1cyBjaGVja3MuJykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb21wdHMgdGhlIHVzZXIgZm9yIHBvdGVudGlhbCByZWxlYXNlIG5vdGVzIGVkaXRzIHRoYXQgbmVlZCB0byBiZSBtYWRlLiBPbmNlXG4gICAqIGNvbmZpcm1lZCwgYSBuZXcgY29tbWl0IGZvciB0aGUgcmVsZWFzZSBwb2ludCBpcyBjcmVhdGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHdhaXRGb3JFZGl0c0FuZENyZWF0ZVJlbGVhc2VDb21taXQobmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcikge1xuICAgIExvZy53YXJuKFxuICAgICAgJyAg4pqgICAgUGxlYXNlIHJldmlldyB0aGUgY2hhbmdlbG9nIGFuZCBlbnN1cmUgdGhhdCB0aGUgbG9nIGNvbnRhaW5zIG9ubHkgY2hhbmdlcyAnICtcbiAgICAgICAgJ3RoYXQgYXBwbHkgdG8gdGhlIHB1YmxpYyBBUEkgc3VyZmFjZS4nLFxuICAgICk7XG4gICAgTG9nLndhcm4oJyAgICAgIE1hbnVhbCBjaGFuZ2VzIGNhbiBiZSBtYWRlLiBXaGVuIGRvbmUsIHBsZWFzZSBwcm9jZWVkIHdpdGggdGhlIHByb21wdCBiZWxvdy4nKTtcblxuICAgIGlmICghKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gcHJvY2VlZCBhbmQgY29tbWl0IHRoZSBjaGFuZ2VzPyd9KSkpIHtcbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cblxuICAgIC8vIENvbW1pdCBtZXNzYWdlIGZvciB0aGUgcmVsZWFzZSBwb2ludC5cbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gZ2V0Q29tbWl0TWVzc2FnZUZvclJlbGVhc2UobmV3VmVyc2lvbik7XG4gICAgY29uc3QgZmlsZXNUb0NvbW1pdCA9IFtcbiAgICAgIHdvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRoLFxuICAgICAgd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoLFxuICAgICAgLi4udGhpcy5nZXRBc3BlY3RMb2NrRmlsZXMoKSxcbiAgICBdO1xuXG4gICAgLy8gQ3JlYXRlIGEgcmVsZWFzZSBzdGFnaW5nIGNvbW1pdCBpbmNsdWRpbmcgY2hhbmdlbG9nIGFuZCB2ZXJzaW9uIGJ1bXAuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVDb21taXQoY29tbWl0TWVzc2FnZSwgZmlsZXNUb0NvbW1pdCk7XG5cbiAgICAvLyBUaGUgY2FyZXRha2VyIG1heSBoYXZlIGF0dGVtcHRlZCB0byBtYWtlIGFkZGl0aW9uYWwgY2hhbmdlcy4gVGhlc2UgY2hhbmdlcyB3b3VsZFxuICAgIC8vIG5vdCBiZSBjYXB0dXJlZCBpbnRvIHRoZSByZWxlYXNlIGNvbW1pdC4gVGhlIHdvcmtpbmcgZGlyZWN0b3J5IHNob3VsZCByZW1haW4gY2xlYW4sXG4gICAgLy8gbGlrZSB3ZSBhc3N1bWUgaXQgYmVpbmcgY2xlYW4gd2hlbiB3ZSBzdGFydCB0aGUgcmVsZWFzZSBhY3Rpb25zLlxuICAgIGlmICh0aGlzLmdpdC5oYXNVbmNvbW1pdHRlZENoYW5nZXMoKSkge1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIFVucmVsYXRlZCBjaGFuZ2VzIGhhdmUgYmVlbiBtYWRlIGFzIHBhcnQgb2YgdGhlIGNoYW5nZWxvZyBlZGl0aW5nLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCByZWxlYXNlIGNvbW1pdCBmb3I6IFwiJHtuZXdWZXJzaW9ufVwiLmApKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFuIG93bmVkIGZvcmsgZm9yIHRoZSBjb25maWd1cmVkIHByb2plY3Qgb2YgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlci4gQWJvcnRzIHRoZVxuICAgKiBwcm9jZXNzIHdpdGggYW4gZXJyb3IgaWYgbm8gZm9yayBjb3VsZCBiZSBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX2dldEZvcmtPZkF1dGhlbnRpY2F0ZWRVc2VyKCk6IFByb21pc2U8R2l0aHViUmVwbz4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5naXQuZ2V0Rm9ya09mQXV0aGVudGljYXRlZFVzZXIoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHtvd25lciwgbmFtZX0gPSB0aGlzLmdpdC5yZW1vdGVDb25maWc7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVW5hYmxlIHRvIGZpbmQgZm9yayBmb3IgY3VycmVudGx5IGF1dGhlbnRpY2F0ZWQgdXNlci4nKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgUGxlYXNlIGVuc3VyZSB5b3UgY3JlYXRlZCBhIGZvcmsgb2Y6ICR7b3duZXJ9LyR7bmFtZX0uYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKiogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBicmFuY2ggbmFtZSBpcyByZXNlcnZlZCBpbiB0aGUgc3BlY2lmaWVkIHJlcG9zaXRvcnkuICovXG4gIHByaXZhdGUgYXN5bmMgX2lzQnJhbmNoTmFtZVJlc2VydmVkSW5SZXBvKHJlcG86IEdpdGh1YlJlcG8sIG5hbWU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuZ2V0QnJhbmNoKHtvd25lcjogcmVwby5vd25lciwgcmVwbzogcmVwby5uYW1lLCBicmFuY2g6IG5hbWV9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIElmIHRoZSBlcnJvciBoYXMgYSBgc3RhdHVzYCBwcm9wZXJ0eSBzZXQgdG8gYDQwNGAsIHRoZW4gd2Uga25vdyB0aGF0IHRoZSBicmFuY2hcbiAgICAgIC8vIGRvZXMgbm90IGV4aXN0LiBPdGhlcndpc2UsIGl0IG1pZ2h0IGJlIGFuIEFQSSBlcnJvciB0aGF0IHdlIHdhbnQgdG8gcmVwb3J0L3JlLXRocm93LlxuICAgICAgaWYgKGlzR2l0aHViQXBpRXJyb3IoZSkgJiYgZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBGaW5kcyBhIG5vbi1yZXNlcnZlZCBicmFuY2ggbmFtZSBpbiB0aGUgcmVwb3NpdG9yeSB3aXRoIHJlc3BlY3QgdG8gYSBiYXNlIG5hbWUuICovXG4gIHByaXZhdGUgYXN5bmMgX2ZpbmRBdmFpbGFibGVCcmFuY2hOYW1lKHJlcG86IEdpdGh1YlJlcG8sIGJhc2VOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGxldCBjdXJyZW50TmFtZSA9IGJhc2VOYW1lO1xuICAgIGxldCBzdWZmaXhOdW0gPSAwO1xuICAgIHdoaWxlIChhd2FpdCB0aGlzLl9pc0JyYW5jaE5hbWVSZXNlcnZlZEluUmVwbyhyZXBvLCBjdXJyZW50TmFtZSkpIHtcbiAgICAgIHN1ZmZpeE51bSsrO1xuICAgICAgY3VycmVudE5hbWUgPSBgJHtiYXNlTmFtZX1fJHtzdWZmaXhOdW19YDtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnJlbnROYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsb2NhbCBicmFuY2ggZnJvbSB0aGUgY3VycmVudCBHaXQgYEhFQURgLiBXaWxsIG92ZXJyaWRlXG4gICAqIGV4aXN0aW5nIGJyYW5jaGVzIGluIGNhc2Ugb2YgYSBjb2xsaXNpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctcScsICctQicsIGJyYW5jaE5hbWVdKTtcbiAgfVxuXG4gIC8qKiBQdXNoZXMgdGhlIGN1cnJlbnQgR2l0IGBIRUFEYCB0byB0aGUgZ2l2ZW4gcmVtb3RlIGJyYW5jaCBpbiB0aGUgY29uZmlndXJlZCBwcm9qZWN0LiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgcHVzaEhlYWRUb1JlbW90ZUJyYW5jaChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICAvLyBQdXNoIHRoZSBsb2NhbCBgSEVBRGAgdG8gdGhlIHJlbW90ZSBicmFuY2ggaW4gdGhlIGNvbmZpZ3VyZWQgcHJvamVjdC5cbiAgICB0aGlzLmdpdC5ydW4oWydwdXNoJywgJy1xJywgdGhpcy5naXQuZ2V0UmVwb0dpdFVybCgpLCBgSEVBRDpyZWZzL2hlYWRzLyR7YnJhbmNoTmFtZX1gXSk7XG4gIH1cblxuICAvKipcbiAgICogUHVzaGVzIHRoZSBjdXJyZW50IEdpdCBgSEVBRGAgdG8gYSBmb3JrIGZvciB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgaXMgb3duZWQgYnlcbiAgICogdGhlIGF1dGhlbnRpY2F0ZWQgdXNlci4gSWYgdGhlIHNwZWNpZmllZCBicmFuY2ggbmFtZSBleGlzdHMgaW4gdGhlIGZvcmsgYWxyZWFkeSwgYVxuICAgKiB1bmlxdWUgb25lIHdpbGwgYmUgZ2VuZXJhdGVkIGJhc2VkIG9uIHRoZSBwcm9wb3NlZCBuYW1lIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gICAqIEBwYXJhbSBwcm9wb3NlZEJyYW5jaE5hbWUgUHJvcG9zZWQgYnJhbmNoIG5hbWUgZm9yIHRoZSBmb3JrLlxuICAgKiBAcGFyYW0gdHJhY2tMb2NhbEJyYW5jaCBXaGV0aGVyIHRoZSBmb3JrIGJyYW5jaCBzaG91bGQgYmUgdHJhY2tlZCBsb2NhbGx5LiBpLmUuIHdoZXRoZXJcbiAgICogICBhIGxvY2FsIGJyYW5jaCB3aXRoIHJlbW90ZSB0cmFja2luZyBzaG91bGQgYmUgc2V0IHVwLlxuICAgKiBAcmV0dXJucyBUaGUgZm9yayBhbmQgYnJhbmNoIG5hbWUgY29udGFpbmluZyB0aGUgcHVzaGVkIGNoYW5nZXMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9wdXNoSGVhZFRvRm9yayhcbiAgICBwcm9wb3NlZEJyYW5jaE5hbWU6IHN0cmluZyxcbiAgICB0cmFja0xvY2FsQnJhbmNoOiBib29sZWFuLFxuICApOiBQcm9taXNlPHtmb3JrOiBHaXRodWJSZXBvOyBicmFuY2hOYW1lOiBzdHJpbmd9PiB7XG4gICAgY29uc3QgZm9yayA9IGF3YWl0IHRoaXMuX2dldEZvcmtPZkF1dGhlbnRpY2F0ZWRVc2VyKCk7XG4gICAgLy8gQ29tcHV0ZSBhIHJlcG9zaXRvcnkgVVJMIGZvciBwdXNoaW5nIHRvIHRoZSBmb3JrLiBOb3RlIHRoYXQgd2Ugd2FudCB0byByZXNwZWN0XG4gICAgLy8gdGhlIFNTSCBvcHRpb24gZnJvbSB0aGUgZGV2LWluZnJhIGdpdGh1YiBjb25maWd1cmF0aW9uLlxuICAgIGNvbnN0IHJlcG9HaXRVcmwgPSBnZXRSZXBvc2l0b3J5R2l0VXJsKFxuICAgICAgey4uLmZvcmssIHVzZVNzaDogdGhpcy5naXQucmVtb3RlQ29uZmlnLnVzZVNzaH0sXG4gICAgICB0aGlzLmdpdC5naXRodWJUb2tlbixcbiAgICApO1xuICAgIGNvbnN0IGJyYW5jaE5hbWUgPSBhd2FpdCB0aGlzLl9maW5kQXZhaWxhYmxlQnJhbmNoTmFtZShmb3JrLCBwcm9wb3NlZEJyYW5jaE5hbWUpO1xuICAgIGNvbnN0IHB1c2hBcmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIC8vIElmIGEgbG9jYWwgYnJhbmNoIHNob3VsZCB0cmFjayB0aGUgcmVtb3RlIGZvcmsgYnJhbmNoLCBjcmVhdGUgYSBicmFuY2ggbWF0Y2hpbmdcbiAgICAvLyB0aGUgcmVtb3RlIGJyYW5jaC4gTGF0ZXIgd2l0aCB0aGUgYGdpdCBwdXNoYCwgdGhlIHJlbW90ZSBpcyBzZXQgZm9yIHRoZSBicmFuY2guXG4gICAgaWYgKHRyYWNrTG9jYWxCcmFuY2gpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZChicmFuY2hOYW1lKTtcbiAgICAgIHB1c2hBcmdzLnB1c2goJy0tc2V0LXVwc3RyZWFtJyk7XG4gICAgfVxuICAgIC8vIFB1c2ggdGhlIGxvY2FsIGBIRUFEYCB0byB0aGUgcmVtb3RlIGJyYW5jaCBpbiB0aGUgZm9yay5cbiAgICB0aGlzLmdpdC5ydW4oWydwdXNoJywgJy1xJywgcmVwb0dpdFVybCwgYEhFQUQ6cmVmcy9oZWFkcy8ke2JyYW5jaE5hbWV9YCwgLi4ucHVzaEFyZ3NdKTtcbiAgICByZXR1cm4ge2ZvcmssIGJyYW5jaE5hbWV9O1xuICB9XG5cbiAgLyoqXG4gICAqIFB1c2hlcyBjaGFuZ2VzIHRvIGEgZm9yayBmb3IgdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCB0aGF0IGlzIG93bmVkIGJ5IHRoZSBjdXJyZW50bHlcbiAgICogYXV0aGVudGljYXRlZCB1c2VyLiBBIHB1bGwgcmVxdWVzdCBpcyB0aGVuIGNyZWF0ZWQgZm9yIHRoZSBwdXNoZWQgY2hhbmdlcyBvbiB0aGVcbiAgICogY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgdGFyZ2V0cyB0aGUgc3BlY2lmaWVkIHRhcmdldCBicmFuY2guXG4gICAqIEByZXR1cm5zIEFuIG9iamVjdCBkZXNjcmliaW5nIHRoZSBjcmVhdGVkIHB1bGwgcmVxdWVzdC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBwdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgIHRhcmdldEJyYW5jaDogc3RyaW5nLFxuICAgIHByb3Bvc2VkRm9ya0JyYW5jaE5hbWU6IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIGJvZHk/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8UHVsbFJlcXVlc3Q+IHtcbiAgICBjb25zdCByZXBvU2x1ZyA9IGAke3RoaXMuZ2l0LnJlbW90ZVBhcmFtcy5vd25lcn0vJHt0aGlzLmdpdC5yZW1vdGVQYXJhbXMucmVwb31gO1xuICAgIGNvbnN0IHtmb3JrLCBicmFuY2hOYW1lfSA9IGF3YWl0IHRoaXMuX3B1c2hIZWFkVG9Gb3JrKHByb3Bvc2VkRm9ya0JyYW5jaE5hbWUsIHRydWUpO1xuICAgIGNvbnN0IHtkYXRhfSA9IGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5wdWxscy5jcmVhdGUoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgaGVhZDogYCR7Zm9yay5vd25lcn06JHticmFuY2hOYW1lfWAsXG4gICAgICBiYXNlOiB0YXJnZXRCcmFuY2gsXG4gICAgICBib2R5LFxuICAgICAgdGl0bGUsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgbGFiZWxzIHRvIHRoZSBuZXdseSBjcmVhdGVkIFBSIGlmIHByb3ZpZGVkIGluIHRoZSBjb25maWd1cmF0aW9uLlxuICAgIGlmICh0aGlzLmNvbmZpZy5yZWxlYXNlUHJMYWJlbHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLmlzc3Vlcy5hZGRMYWJlbHMoe1xuICAgICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICAgIGlzc3VlX251bWJlcjogZGF0YS5udW1iZXIsXG4gICAgICAgIGxhYmVsczogdGhpcy5jb25maWcucmVsZWFzZVByTGFiZWxzLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCBwdWxsIHJlcXVlc3QgIyR7ZGF0YS5udW1iZXJ9IGluICR7cmVwb1NsdWd9LmApKTtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGRhdGEubnVtYmVyLFxuICAgICAgdXJsOiBkYXRhLmh0bWxfdXJsLFxuICAgICAgZm9yayxcbiAgICAgIGZvcmtCcmFuY2g6IGJyYW5jaE5hbWUsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwZW5kIHJlbGVhc2VzIG5vdGVzIGZvciBhIHZlcnNpb24gcHVibGlzaGVkIGluIGEgZ2l2ZW4gYnJhbmNoIHRvIHRoZSBjaGFuZ2Vsb2cgaW5cbiAgICogdGhlIGN1cnJlbnQgR2l0IGBIRUFEYC4gVGhpcyBpcyB1c2VmdWwgZm9yIGNoZXJyeS1waWNraW5nIHRoZSBjaGFuZ2Vsb2cuXG4gICAqIEByZXR1cm5zIEEgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHJlbGVhc2Ugbm90ZXMgaGF2ZSBiZWVuIHByZXBlbmRlZC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBwcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCByZWxlYXNlTm90ZXMucHJlcGVuZEVudHJ5VG9DaGFuZ2Vsb2dGaWxlKCk7XG4gICAgTG9nLmluZm8oXG4gICAgICBncmVlbihgICDinJMgICBVcGRhdGVkIHRoZSBjaGFuZ2Vsb2cgdG8gY2FwdHVyZSBjaGFuZ2VzIGZvciBcIiR7cmVsZWFzZU5vdGVzLnZlcnNpb259XCIuYCksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBDaGVja3Mgb3V0IGFuIHVwc3RyZWFtIGJyYW5jaCB3aXRoIGEgZGV0YWNoZWQgaGVhZC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNoZWNrb3V0VXBzdHJlYW1CcmFuY2goYnJhbmNoTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5naXQucnVuKFsnZmV0Y2gnLCAnLXEnLCB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksIGJyYW5jaE5hbWVdKTtcbiAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctcScsICdGRVRDSF9IRUFEJywgJy0tZGV0YWNoJ10pO1xuICB9XG5cbiAgLyoqIEluc3RhbGxzIGFsbCBZYXJuIGRlcGVuZGVuY2llcyBpbiB0aGUgY3VycmVudCBicmFuY2guICovXG4gIHByb3RlY3RlZCBhc3luYyBpbnN0YWxsRGVwZW5kZW5jaWVzRm9yQ3VycmVudEJyYW5jaCgpIHtcbiAgICBpZiAoYXdhaXQgdGhpcy5wbnBtVmVyc2lvbmluZy5pc1VzaW5nUG5wbSh0aGlzLnByb2plY3REaXIpKSB7XG4gICAgICBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZVBucG1JbnN0YWxsKHRoaXMucHJvamVjdERpciwgdGhpcy5wbnBtVmVyc2lvbmluZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZU1vZHVsZXNEaXIgPSBqb2luKHRoaXMucHJvamVjdERpciwgJ25vZGVfbW9kdWxlcycpO1xuICAgIC8vIE5vdGU6IFdlIGRlbGV0ZSBhbGwgY29udGVudHMgb2YgdGhlIGBub2RlX21vZHVsZXNgIGZpcnN0LiBUaGlzIGlzIG5lY2Vzc2FyeVxuICAgIC8vIGJlY2F1c2UgWWFybiBjb3VsZCBwcmVzZXJ2ZSBleHRyYW5lb3VzL291dGRhdGVkIG5lc3RlZCBtb2R1bGVzIHRoYXQgd2lsbCBjYXVzZVxuICAgIC8vIHVuZXhwZWN0ZWQgYnVpbGQgZmFpbHVyZXMgd2l0aCB0aGUgTm9kZUpTIEJhemVsIGBAbnBtYCB3b3Jrc3BhY2UgZ2VuZXJhdGlvbi5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3I6IGh0dHBzOi8vZ2l0aHViLmNvbS95YXJucGtnL3lhcm4vaXNzdWVzLzgxNDYuIEV2ZW4gdGhvdWdoXG4gICAgLy8gd2UgbWlnaHQgYmUgYWJsZSB0byBmaXggdGhpcyB3aXRoIFlhcm4gMissIGl0IGlzIHJlYXNvbmFibGUgZW5zdXJpbmcgY2xlYW4gbm9kZSBtb2R1bGVzLlxuICAgIC8vIFRPRE86IFJlbW92ZSB0aGlzIHdoZW4gd2UgdXNlIFlhcm4gMisgaW4gYWxsIEFuZ3VsYXIgcmVwb3NpdG9yaWVzLlxuICAgIGF3YWl0IGZzLnJtKG5vZGVNb2R1bGVzRGlyLCB7Zm9yY2U6IHRydWUsIHJlY3Vyc2l2ZTogdHJ1ZSwgbWF4UmV0cmllczogM30pO1xuICAgIGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlWWFybkluc3RhbGwodGhpcy5wcm9qZWN0RGlyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgY29tbWl0IGZvciB0aGUgc3BlY2lmaWVkIGZpbGVzIHdpdGggdGhlIGdpdmVuIG1lc3NhZ2UuXG4gICAqIEBwYXJhbSBtZXNzYWdlIE1lc3NhZ2UgZm9yIHRoZSBjcmVhdGVkIGNvbW1pdFxuICAgKiBAcGFyYW0gZmlsZXMgTGlzdCBvZiBwcm9qZWN0LXJlbGF0aXZlIGZpbGUgcGF0aHMgdG8gYmUgY29tbWl0dGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNyZWF0ZUNvbW1pdChtZXNzYWdlOiBzdHJpbmcsIGZpbGVzOiBzdHJpbmdbXSkge1xuICAgIC8vIE5vdGU6IGBnaXQgYWRkYCB3b3VsZCBub3QgYmUgbmVlZGVkIGlmIHRoZSBmaWxlcyBhcmUgYWxyZWFkeSBrbm93biB0b1xuICAgIC8vIEdpdCwgYnV0IHRoZSBzcGVjaWZpZWQgZmlsZXMgY291bGQgYWxzbyBiZSBuZXdseSBjcmVhdGVkLCBhbmQgdW5rbm93bi5cbiAgICB0aGlzLmdpdC5ydW4oWydhZGQnLCAuLi5maWxlc10pO1xuICAgIC8vIE5vdGU6IGAtLW5vLXZlcmlmeWAgc2tpcHMgdGhlIG1ham9yaXR5IG9mIGNvbW1pdCBob29rcyBoZXJlLCBidXQgdGhlcmUgYXJlIGhvb2tzXG4gICAgLy8gbGlrZSBgcHJlcGFyZS1jb21taXQtbWVzc2FnZWAgd2hpY2ggc3RpbGwgcnVuLiBXZSBoYXZlIHNldCB0aGUgYEhVU0tZPTBgIGVudmlyb25tZW50XG4gICAgLy8gdmFyaWFibGUgYXQgdGhlIHN0YXJ0IG9mIHRoZSBwdWJsaXNoIGNvbW1hbmQgdG8gaWdub3JlIHN1Y2ggaG9va3MgYXMgd2VsbC5cbiAgICB0aGlzLmdpdC5ydW4oWydjb21taXQnLCAnLXEnLCAnLS1uby12ZXJpZnknLCAnLW0nLCBtZXNzYWdlLCAuLi5maWxlc10pO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyB0aGUgcmVsZWFzZSBvdXRwdXQgZm9yIHRoZSBjdXJyZW50IGJyYW5jaC4gQXNzdW1lcyB0aGUgbm9kZSBtb2R1bGVzXG4gICAqIHRvIGJlIGFscmVhZHkgaW5zdGFsbGVkIGZvciB0aGUgY3VycmVudCBicmFuY2guXG4gICAqXG4gICAqIEByZXR1cm5zIEEgbGlzdCBvZiBidWlsdCByZWxlYXNlIHBhY2thZ2VzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGJ1aWxkUmVsZWFzZUZvckN1cnJlbnRCcmFuY2goKTogUHJvbWlzZTxCdWlsdFBhY2thZ2VXaXRoSW5mb1tdPiB7XG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvIG5vdCBkaXJlY3RseSBjYWxsIHRoZSBidWlsZCBwYWNrYWdlcyBmdW5jdGlvbiBmcm9tIHRoZSByZWxlYXNlXG4gICAgLy8gY29uZmlnLiBXZSBvbmx5IHdhbnQgdG8gYnVpbGQgYW5kIHB1Ymxpc2ggcGFja2FnZXMgdGhhdCBoYXZlIGJlZW4gY29uZmlndXJlZCBpbiB0aGUgZ2l2ZW5cbiAgICAvLyBwdWJsaXNoIGJyYW5jaC4gZS5nLiBjb25zaWRlciB3ZSBwdWJsaXNoIHBhdGNoIHZlcnNpb24gYW5kIGEgbmV3IHBhY2thZ2UgaGFzIGJlZW5cbiAgICAvLyBjcmVhdGVkIGluIHRoZSBgbmV4dGAgYnJhbmNoLiBUaGUgbmV3IHBhY2thZ2Ugd291bGQgbm90IGJlIHBhcnQgb2YgdGhlIHBhdGNoIGJyYW5jaCxcbiAgICAvLyBzbyB3ZSBjYW5ub3QgYnVpbGQgYW5kIHB1Ymxpc2ggaXQuXG4gICAgY29uc3QgYnVpbHRQYWNrYWdlcyA9IGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlUmVsZWFzZUJ1aWxkKFxuICAgICAgdGhpcy5wcm9qZWN0RGlyLFxuICAgICAgdGhpcy5wbnBtVmVyc2lvbmluZyxcbiAgICApO1xuICAgIGNvbnN0IHJlbGVhc2VJbmZvID0gYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlSW5mbyhcbiAgICAgIHRoaXMucHJvamVjdERpcixcbiAgICAgIHRoaXMucG5wbVZlcnNpb25pbmcsXG4gICAgKTtcblxuICAgIC8vIEV4dGVuZCB0aGUgYnVpbHQgcGFja2FnZXMgd2l0aCB0aGVpciBkaXNrIGhhc2ggYW5kIE5QTSBwYWNrYWdlIGluZm9ybWF0aW9uLiBUaGlzIGlzXG4gICAgLy8gaGVscGZ1bCBsYXRlciBmb3IgdmVyaWZ5aW5nIGludGVncml0eSBhbmQgZmlsdGVyaW5nIG91dCBlLmcuIGV4cGVyaW1lbnRhbCBwYWNrYWdlcy5cbiAgICByZXR1cm4gYW5hbHl6ZUFuZEV4dGVuZEJ1aWx0UGFja2FnZXNXaXRoSW5mbyhidWlsdFBhY2thZ2VzLCByZWxlYXNlSW5mby5ucG1QYWNrYWdlcyk7XG4gIH1cblxuICAvKipcbiAgICogU3RhZ2VzIHRoZSBzcGVjaWZpZWQgbmV3IHZlcnNpb24gZm9yIHRoZSBjdXJyZW50IGJyYW5jaCwgYnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCxcbiAgICogdmVyaWZpZXMgaXRzIG91dHB1dCBhbmQgY3JlYXRlcyBhIHB1bGwgcmVxdWVzdCAgdGhhdCB0YXJnZXRzIHRoZSBnaXZlbiBiYXNlIGJyYW5jaC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgYXNzdW1lcyB0aGUgc3RhZ2luZyBicmFuY2ggaXMgYWxyZWFkeSBjaGVja2VkLW91dC5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IHZlcnNpb24gdG8gYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgVmVyc2lvbiB1c2VkIGZvciBjb21wYXJpbmcgd2l0aCB0aGUgY3VycmVudFxuICAgKiAgIGBIRUFEYCBpbiBvcmRlciBidWlsZCB0aGUgcmVsZWFzZSBub3Rlcy5cbiAgICogQHBhcmFtIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoIEJyYW5jaCB0aGUgcHVsbCByZXF1ZXN0IHNob3VsZCB0YXJnZXQuXG4gICAqIEBwYXJhbSBvcHRzIE5vbi1tYW5kYXRvcnkgb3B0aW9ucyBmb3IgY29udHJvbGxpbmcgdGhlIHN0YWdpbmcsIGUuZy5cbiAgICogICBhbGxvd2luZyBmb3IgYWRkaXRpb25hbCBgcGFja2FnZS5qc29uYCBtb2RpZmljYXRpb25zLlxuICAgKiBAcmV0dXJucyBhbiBvYmplY3QgY2FwdHVyaW5nIGFjdGlvbnMgcGVyZm9ybWVkIGFzIHBhcnQgb2Ygc3RhZ2luZy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBzdGFnZVZlcnNpb25Gb3JCcmFuY2hBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzOiBzZW12ZXIuU2VtVmVyLFxuICAgIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoOiBzdHJpbmcsXG4gICAgb3B0cz86IFN0YWdpbmdPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcztcbiAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3Q7XG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdO1xuICB9PiB7XG4gICAgY29uc3QgcmVsZWFzZU5vdGVzQ29tcGFyZVRhZyA9IGdldFJlbGVhc2VUYWdGb3JWZXJzaW9uKGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzKTtcblxuICAgIC8vIEZldGNoIHRoZSBjb21wYXJlIHRhZyBzbyB0aGF0IGNvbW1pdHMgZm9yIHRoZSByZWxlYXNlIG5vdGVzIGNhbiBiZSBkZXRlcm1pbmVkLlxuICAgIC8vIFdlIGZvcmNpYmx5IG92ZXJyaWRlIGV4aXN0aW5nIGxvY2FsIHRhZ3MgdGhhdCBhcmUgbmFtZWQgc2ltaWxhciBhcyB3ZSB3aWxsIGZldGNoXG4gICAgLy8gdGhlIGNvcnJlY3QgdGFnIGZvciByZWxlYXNlIG5vdGVzIGNvbXBhcmlzb24gZnJvbSB0aGUgdXBzdHJlYW0gcmVtb3RlLlxuICAgIHRoaXMuZ2l0LnJ1bihbXG4gICAgICAnZmV0Y2gnLFxuICAgICAgJy0tZm9yY2UnLFxuICAgICAgdGhpcy5naXQuZ2V0UmVwb0dpdFVybCgpLFxuICAgICAgYHJlZnMvdGFncy8ke3JlbGVhc2VOb3Rlc0NvbXBhcmVUYWd9OnJlZnMvdGFncy8ke3JlbGVhc2VOb3Rlc0NvbXBhcmVUYWd9YCxcbiAgICBdKTtcblxuICAgIC8vIEJ1aWxkIHJlbGVhc2Ugbm90ZXMgZm9yIGNvbW1pdHMgZnJvbSBgPHJlbGVhc2VOb3Rlc0NvbXBhcmVUYWc+Li5IRUFEYC5cbiAgICBjb25zdCByZWxlYXNlTm90ZXMgPSBhd2FpdCBSZWxlYXNlTm90ZXMuZm9yUmFuZ2UoXG4gICAgICB0aGlzLmdpdCxcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgICByZWxlYXNlTm90ZXNDb21wYXJlVGFnLFxuICAgICAgJ0hFQUQnLFxuICAgICk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3RWZXJzaW9uKG5ld1ZlcnNpb24sIG9wdHM/LnVwZGF0ZVBrZ0pzb25Gbik7XG4gICAgYXdhaXQgdGhpcy5wcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzKTtcbiAgICBhd2FpdCB0aGlzLndhaXRGb3JFZGl0c0FuZENyZWF0ZVJlbGVhc2VDb21taXQobmV3VmVyc2lvbik7XG5cbiAgICAvLyBJbnN0YWxsIHRoZSBwcm9qZWN0IGRlcGVuZGVuY2llcyBmb3IgdGhlIHB1Ymxpc2ggYnJhbmNoLlxuICAgIGF3YWl0IHRoaXMuaW5zdGFsbERlcGVuZGVuY2llc0ZvckN1cnJlbnRCcmFuY2goKTtcblxuICAgIGNvbnN0IGJ1aWx0UGFja2FnZXNXaXRoSW5mbyA9IGF3YWl0IHRoaXMuYnVpbGRSZWxlYXNlRm9yQ3VycmVudEJyYW5jaCgpO1xuXG4gICAgLy8gUnVuIHJlbGVhc2UgcHJlLWNoZWNrcyAoZS5nLiB2YWxpZGF0aW5nIHRoZSByZWxlYXNlIG91dHB1dCkuXG4gICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlUHJlY2hlY2soXG4gICAgICB0aGlzLnByb2plY3REaXIsXG4gICAgICBuZXdWZXJzaW9uLFxuICAgICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvLFxuICAgICAgdGhpcy5wbnBtVmVyc2lvbmluZyxcbiAgICApO1xuXG4gICAgLy8gVmVyaWZ5IHRoZSBwYWNrYWdlcyBidWlsdCBhcmUgdGhlIGNvcnJlY3QgdmVyc2lvbi5cbiAgICBhd2FpdCB0aGlzLl92ZXJpZnlQYWNrYWdlVmVyc2lvbnMocmVsZWFzZU5vdGVzLnZlcnNpb24sIGJ1aWx0UGFja2FnZXNXaXRoSW5mbyk7XG5cbiAgICBjb25zdCBwdWxsUmVxdWVzdCA9IGF3YWl0IHRoaXMucHVzaENoYW5nZXNUb0ZvcmtBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICAgIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoLFxuICAgICAgYHJlbGVhc2Utc3RhZ2UtJHtuZXdWZXJzaW9ufWAsXG4gICAgICBgQnVtcCB2ZXJzaW9uIHRvIFwidiR7bmV3VmVyc2lvbn1cIiB3aXRoIGNoYW5nZWxvZy5gLFxuICAgICk7XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBSZWxlYXNlIHN0YWdpbmcgcHVsbCByZXF1ZXN0IGhhcyBiZWVuIGNyZWF0ZWQuJykpO1xuXG4gICAgcmV0dXJuIHtyZWxlYXNlTm90ZXMsIHB1bGxSZXF1ZXN0LCBidWlsdFBhY2thZ2VzV2l0aEluZm99O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBvdXQgdGhlIHNwZWNpZmllZCB0YXJnZXQgYnJhbmNoLCB2ZXJpZmllcyBpdHMgQ0kgc3RhdHVzIGFuZCBzdGFnZXNcbiAgICogdGhlIHNwZWNpZmllZCBuZXcgdmVyc2lvbiBpbiBvcmRlciB0byBjcmVhdGUgYSBwdWxsIHJlcXVlc3QuXG4gICAqXG4gICAqIEBwYXJhbSBuZXdWZXJzaW9uIE5ldyB2ZXJzaW9uIHRvIGJlIHN0YWdlZC5cbiAgICogQHBhcmFtIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzIFZlcnNpb24gdXNlZCBmb3IgY29tcGFyaW5nIHdpdGggYEhFQURgIG9mXG4gICAqICAgdGhlIHN0YWdpbmcgYnJhbmNoIGluIG9yZGVyIGJ1aWxkIHRoZSByZWxlYXNlIG5vdGVzLlxuICAgKiBAcGFyYW0gc3RhZ2luZ0JyYW5jaCBCcmFuY2ggd2l0aGluIHRoZSBuZXcgdmVyc2lvbiBzaG91bGQgYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gc3RhZ2luZ09wdGlvbnMgTm9uLW1hbmRhdG9yeSBvcHRpb25zIGZvciBjb250cm9sbGluZyB0aGUgc3RhZ2luZyBvZlxuICAgKiAgIHRoZSBuZXcgdmVyc2lvbi4gZS5nLiBhbGxvd2luZyBmb3IgYWRkaXRpb25hbCBgcGFja2FnZS5qc29uYCBtb2RpZmljYXRpb25zLlxuICAgKiBAcmV0dXJucyBhbiBvYmplY3QgY2FwdHVyaW5nIGFjdGlvbnMgcGVyZm9ybWVkIGFzIHBhcnQgb2Ygc3RhZ2luZy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBjaGVja291dEJyYW5jaEFuZFN0YWdlVmVyc2lvbihcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzOiBzZW12ZXIuU2VtVmVyLFxuICAgIHN0YWdpbmdCcmFuY2g6IHN0cmluZyxcbiAgICBzdGFnaW5nT3B0cz86IFN0YWdpbmdPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcztcbiAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3Q7XG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdO1xuICAgIGJlZm9yZVN0YWdpbmdTaGE6IHN0cmluZztcbiAgfT4ge1xuICAgIC8vIEtlZXAgdHJhY2sgb2YgdGhlIGNvbW1pdCB3aGVyZSB3ZSBzdGFydGVkIHRoZSBzdGFnaW5nIHByb2Nlc3Mgb24uIFRoaXMgd2lsbCBiZSB1c2VkXG4gICAgLy8gbGF0ZXIgdG8gZW5zdXJlIHRoYXQgbm8gY2hhbmdlcywgZXhjZXB0IGZvciB0aGUgdmVyc2lvbiBidW1wIGhhdmUgbGFuZGVkIGFzIHBhcnRcbiAgICAvLyBvZiB0aGUgc3RhZ2luZyB0aW1lIHdpbmRvdyAod2hlcmUgdGhlIGNhcmV0YWtlciBjb3VsZCBhY2NpZGVudGFsbHkgbGFuZCBvdGhlciBzdHVmZikuXG4gICAgY29uc3QgYmVmb3JlU3RhZ2luZ1NoYSA9IGF3YWl0IHRoaXMuZ2V0TGF0ZXN0Q29tbWl0T2ZCcmFuY2goc3RhZ2luZ0JyYW5jaCk7XG5cbiAgICBhd2FpdCB0aGlzLmFzc2VydFBhc3NpbmdHaXRodWJTdGF0dXMoYmVmb3JlU3RhZ2luZ1NoYSwgc3RhZ2luZ0JyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy5jaGVja291dFVwc3RyZWFtQnJhbmNoKHN0YWdpbmdCcmFuY2gpO1xuXG4gICAgY29uc3Qgc3RhZ2luZ0luZm8gPSBhd2FpdCB0aGlzLnN0YWdlVmVyc2lvbkZvckJyYW5jaEFuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgbmV3VmVyc2lvbixcbiAgICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzLFxuICAgICAgc3RhZ2luZ0JyYW5jaCxcbiAgICAgIHN0YWdpbmdPcHRzLFxuICAgICk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uc3RhZ2luZ0luZm8sXG4gICAgICBiZWZvcmVTdGFnaW5nU2hhLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ2hlcnJ5LXBpY2tzIHRoZSByZWxlYXNlIG5vdGVzIG9mIGEgdmVyc2lvbiB0aGF0IGhhdmUgYmVlbiBwdXNoZWQgdG8gYSBnaXZlbiBicmFuY2hcbiAgICogaW50byB0aGUgYG5leHRgIHByaW1hcnkgZGV2ZWxvcG1lbnQgYnJhbmNoLiBBIHB1bGwgcmVxdWVzdCBpcyBjcmVhdGVkIGZvciB0aGlzLlxuICAgKiBAcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzZnVsIGNyZWF0aW9uIG9mIHRoZSBjaGVycnktcGljayBwdWxsIHJlcXVlc3QuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY2hlcnJ5UGlja0NoYW5nZWxvZ0ludG9OZXh0QnJhbmNoKFxuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzLFxuICAgIHN0YWdpbmdCcmFuY2g6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgbmV4dEJyYW5jaCA9IHRoaXMuYWN0aXZlLm5leHQuYnJhbmNoTmFtZTtcbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gZ2V0UmVsZWFzZU5vdGVDaGVycnlQaWNrQ29tbWl0TWVzc2FnZShyZWxlYXNlTm90ZXMudmVyc2lvbik7XG5cbiAgICAvLyBDaGVja291dCB0aGUgbmV4dCBicmFuY2guXG4gICAgYXdhaXQgdGhpcy5jaGVja291dFVwc3RyZWFtQnJhbmNoKG5leHRCcmFuY2gpO1xuXG4gICAgYXdhaXQgdGhpcy5wcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzKTtcblxuICAgIC8vIENyZWF0ZSBhIGNoYW5nZWxvZyBjaGVycnktcGljayBjb21taXQuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVDb21taXQoY29tbWl0TWVzc2FnZSwgW3dvcmtzcGFjZVJlbGF0aXZlQ2hhbmdlbG9nUGF0aF0pO1xuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIENyZWF0ZWQgY2hhbmdlbG9nIGNoZXJyeS1waWNrIGNvbW1pdCBmb3I6IFwiJHtyZWxlYXNlTm90ZXMudmVyc2lvbn1cIi5gKSk7XG5cbiAgICAvLyBDcmVhdGUgYSBjaGVycnktcGljayBwdWxsIHJlcXVlc3QgdGhhdCBzaG91bGQgYmUgbWVyZ2VkIGJ5IHRoZSBjYXJldGFrZXIuXG4gICAgY29uc3QgcHVsbFJlcXVlc3QgPSBhd2FpdCB0aGlzLnB1c2hDaGFuZ2VzVG9Gb3JrQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgICBuZXh0QnJhbmNoLFxuICAgICAgYGNoYW5nZWxvZy1jaGVycnktcGljay0ke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufWAsXG4gICAgICBjb21taXRNZXNzYWdlLFxuICAgICAgYENoZXJyeS1waWNrcyB0aGUgY2hhbmdlbG9nIGZyb20gdGhlIFwiJHtzdGFnaW5nQnJhbmNofVwiIGJyYW5jaCB0byB0aGUgbmV4dCBgICtcbiAgICAgICAgYGJyYW5jaCAoJHtuZXh0QnJhbmNofSkuYCxcbiAgICApO1xuXG4gICAgTG9nLmluZm8oXG4gICAgICBncmVlbihcbiAgICAgICAgYCAg4pyTICAgUHVsbCByZXF1ZXN0IGZvciBjaGVycnktcGlja2luZyB0aGUgY2hhbmdlbG9nIGludG8gXCIke25leHRCcmFuY2h9XCIgYCArXG4gICAgICAgICAgJ2hhcyBiZWVuIGNyZWF0ZWQuJyxcbiAgICAgICksXG4gICAgKTtcblxuICAgIGF3YWl0IHRoaXMucHJvbXB0QW5kV2FpdEZvclB1bGxSZXF1ZXN0TWVyZ2VkKHB1bGxSZXF1ZXN0KTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqIFByb21wdHMgdGhlIHVzZXIgZm9yIG1lcmdpbmcgdGhlIHB1bGwgcmVxdWVzdCwgYW5kIHdhaXRzIGZvciBpdCB0byBiZSBtZXJnZWQuICovXG4gIHByb3RlY3RlZCBhc3luYyBwcm9tcHRBbmRXYWl0Rm9yUHVsbFJlcXVlc3RNZXJnZWQocHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgcHJvbXB0VG9Jbml0aWF0ZVB1bGxSZXF1ZXN0TWVyZ2UodGhpcy5naXQsIHB1bGxSZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgR2l0aHViIHJlbGVhc2UgZm9yIHRoZSBzcGVjaWZpZWQgdmVyc2lvbi4gVGhlIHJlbGVhc2UgaXMgY3JlYXRlZFxuICAgKiBieSB0YWdnaW5nIHRoZSB2ZXJzaW9uIGJ1bXAgY29tbWl0LCBhbmQgYnkgY3JlYXRpbmcgdGhlIHJlbGVhc2UgZW50cnkuXG4gICAqXG4gICAqIEV4cGVjdHMgdGhlIHZlcnNpb24gYnVtcCBjb21taXQgYW5kIGNoYW5nZWxvZyB0byBiZSBhdmFpbGFibGUgaW4gdGhlXG4gICAqIHVwc3RyZWFtIHJlbW90ZS5cbiAgICpcbiAgICogQHBhcmFtIHJlbGVhc2VOb3RlcyBUaGUgcmVsZWFzZSBub3RlcyBmb3IgdGhlIHZlcnNpb24gYmVpbmcgcHVibGlzaGVkLlxuICAgKiBAcGFyYW0gdmVyc2lvbkJ1bXBDb21taXRTaGEgQ29tbWl0IHRoYXQgYnVtcGVkIHRoZSB2ZXJzaW9uLiBUaGUgcmVsZWFzZSB0YWdcbiAgICogICB3aWxsIHBvaW50IHRvIHRoaXMgY29tbWl0LlxuICAgKiBAcGFyYW0gaXNQcmVyZWxlYXNlIFdoZXRoZXIgdGhlIG5ldyB2ZXJzaW9uIGlzIHB1Ymxpc2hlZCBhcyBhIHByZS1yZWxlYXNlLlxuICAgKiBAcGFyYW0gc2hvd0FzTGF0ZXN0T25HaXRIdWIgV2hldGhlciB0aGUgdmVyc2lvbiByZWxlYXNlZCB3aWxsIHJlcHJlc2VudFxuICAgKiAgIHRoZSBcImxhdGVzdFwiIHZlcnNpb24gb2YgdGhlIHByb2plY3QuIEkuZS4gR2l0SHViIHdpbGwgc2hvdyB0aGlzIHZlcnNpb24gYXMgXCJsYXRlc3RcIi5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX2NyZWF0ZUdpdGh1YlJlbGVhc2VGb3JWZXJzaW9uKFxuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzLFxuICAgIHZlcnNpb25CdW1wQ29tbWl0U2hhOiBzdHJpbmcsXG4gICAgaXNQcmVyZWxlYXNlOiBib29sZWFuLFxuICAgIHNob3dBc0xhdGVzdE9uR2l0SHViOiBib29sZWFuLFxuICApIHtcbiAgICBjb25zdCB0YWdOYW1lID0gZ2V0UmVsZWFzZVRhZ0ZvclZlcnNpb24ocmVsZWFzZU5vdGVzLnZlcnNpb24pO1xuICAgIGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5naXQuY3JlYXRlUmVmKHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIHJlZjogYHJlZnMvdGFncy8ke3RhZ05hbWV9YCxcbiAgICAgIHNoYTogdmVyc2lvbkJ1bXBDb21taXRTaGEsXG4gICAgfSk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVGFnZ2VkIHYke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufSByZWxlYXNlIHVwc3RyZWFtLmApKTtcblxuICAgIGxldCByZWxlYXNlQm9keSA9IGF3YWl0IHJlbGVhc2VOb3Rlcy5nZXRHaXRodWJSZWxlYXNlRW50cnkoKTtcblxuICAgIC8vIElmIHRoZSByZWxlYXNlIGJvZHkgZXhjZWVkcyB0aGUgR2l0aHViIGJvZHkgbGltaXQsIHdlIGp1c3QgcHJvdmlkZVxuICAgIC8vIGEgbGluayB0byB0aGUgY2hhbmdlbG9nIGVudHJ5IGluIHRoZSBHaXRodWIgcmVsZWFzZSBlbnRyeS5cbiAgICBpZiAocmVsZWFzZUJvZHkubGVuZ3RoID4gZ2l0aHViUmVsZWFzZUJvZHlMaW1pdCkge1xuICAgICAgY29uc3QgcmVsZWFzZU5vdGVzVXJsID0gYXdhaXQgdGhpcy5fZ2V0R2l0aHViQ2hhbmdlbG9nVXJsRm9yUmVmKHJlbGVhc2VOb3RlcywgdGFnTmFtZSk7XG4gICAgICByZWxlYXNlQm9keSA9XG4gICAgICAgIGBSZWxlYXNlIG5vdGVzIGFyZSB0b28gbGFyZ2UgdG8gYmUgY2FwdHVyZWQgaGVyZS4gYCArXG4gICAgICAgIGBbVmlldyBhbGwgY2hhbmdlcyBoZXJlXSgke3JlbGVhc2VOb3Rlc1VybH0pLmA7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLnJlcG9zLmNyZWF0ZVJlbGVhc2Uoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgbmFtZTogYHYke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufWAsXG4gICAgICB0YWdfbmFtZTogdGFnTmFtZSxcbiAgICAgIHByZXJlbGVhc2U6IGlzUHJlcmVsZWFzZSxcbiAgICAgIG1ha2VfbGF0ZXN0OiBzaG93QXNMYXRlc3RPbkdpdEh1YiA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgICBib2R5OiByZWxlYXNlQm9keSxcbiAgICB9KTtcbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBDcmVhdGVkIHYke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufSByZWxlYXNlIGluIEdpdGh1Yi5gKSk7XG4gIH1cblxuICAvKiogR2V0cyBhIEdpdGh1YiBVUkwgdGhhdCByZXNvbHZlcyB0byB0aGUgcmVsZWFzZSBub3RlcyBpbiB0aGUgZ2l2ZW4gcmVmLiAqL1xuICBwcml2YXRlIGFzeW5jIF9nZXRHaXRodWJDaGFuZ2Vsb2dVcmxGb3JSZWYocmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsIHJlZjogc3RyaW5nKSB7XG4gICAgY29uc3QgYmFzZVVybCA9IGdldEZpbGVDb250ZW50c1VybCh0aGlzLmdpdCwgcmVmLCB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGgpO1xuICAgIGNvbnN0IHVybEZyYWdtZW50ID0gYXdhaXQgcmVsZWFzZU5vdGVzLmdldFVybEZyYWdtZW50Rm9yUmVsZWFzZSgpO1xuICAgIHJldHVybiBgJHtiYXNlVXJsfSMke3VybEZyYWdtZW50fWA7XG4gIH1cblxuICAvKipcbiAgICogUHVibGlzaGVzIHRoZSBnaXZlbiBwYWNrYWdlcyB0byB0aGUgcmVnaXN0cnkgYW5kIG1ha2VzIHRoZSByZWxlYXNlc1xuICAgKiBhdmFpbGFibGUgb24gR2l0SHViLlxuICAgKlxuICAgKiBAcGFyYW0gYnVpbHRQYWNrYWdlc1dpdGhJbmZvIExpc3Qgb2YgYnVpbHQgcGFja2FnZXMgdGhhdCB3aWxsIGJlIHB1Ymxpc2hlZC5cbiAgICogQHBhcmFtIHJlbGVhc2VOb3RlcyBUaGUgcmVsZWFzZSBub3RlcyBmb3IgdGhlIHZlcnNpb24gYmVpbmcgcHVibGlzaGVkLlxuICAgKiBAcGFyYW0gYmVmb3JlU3RhZ2luZ1NoYSBDb21taXQgU0hBIHRoYXQgaXMgZXhwZWN0ZWQgdG8gYmUgdGhlIG1vc3QgcmVjZW50IG9uZSBhZnRlclxuICAgKiAgIHRoZSBhY3R1YWwgdmVyc2lvbiBidW1wIGNvbW1pdC4gVGhpcyBleGlzdHMgdG8gZW5zdXJlIHRoYXQgY2FyZXRha2VycyBkbyBub3QgbGFuZFxuICAgKiAgIGFkZGl0aW9uYWwgY2hhbmdlcyBhZnRlciB0aGUgcmVsZWFzZSBvdXRwdXQgaGFzIGJlZW4gYnVpbHQgbG9jYWxseS5cbiAgICogQHBhcmFtIHB1Ymxpc2hCcmFuY2ggTmFtZSBvZiB0aGUgYnJhbmNoIHRoYXQgY29udGFpbnMgdGhlIG5ldyB2ZXJzaW9uLlxuICAgKiBAcGFyYW0gbnBtRGlzdFRhZyBOUE0gZGlzdCB0YWcgd2hlcmUgdGhlIHZlcnNpb24gc2hvdWxkIGJlIHB1Ymxpc2hlZCB0by5cbiAgICogQHBhcmFtIGFkZGl0aW9uYWxPcHRpb25zIEFkZGl0aW9uYWwgb3B0aW9ucyBuZWVkZWQgZm9yIHB1Ymxpc2hpbmcgYSByZWxlYXNlLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHB1Ymxpc2goXG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdLFxuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzLFxuICAgIGJlZm9yZVN0YWdpbmdTaGE6IHN0cmluZyxcbiAgICBwdWJsaXNoQnJhbmNoOiBzdHJpbmcsXG4gICAgbnBtRGlzdFRhZzogTnBtRGlzdFRhZyxcbiAgICBhZGRpdGlvbmFsT3B0aW9uczoge3Nob3dBc0xhdGVzdE9uR2l0SHViOiBib29sZWFufSxcbiAgKSB7XG4gICAgY29uc3QgdmVyc2lvbkJ1bXBDb21taXRTaGEgPSBhd2FpdCB0aGlzLmdldExhdGVzdENvbW1pdE9mQnJhbmNoKHB1Ymxpc2hCcmFuY2gpO1xuXG4gICAgLy8gRW5zdXJlIHRoZSBsYXRlc3QgY29tbWl0IGluIHRoZSBwdWJsaXNoIGJyYW5jaCBpcyB0aGUgYnVtcCBjb21taXQuXG4gICAgaWYgKCEoYXdhaXQgdGhpcy5faXNDb21taXRGb3JWZXJzaW9uU3RhZ2luZyhyZWxlYXNlTm90ZXMudmVyc2lvbiwgdmVyc2lvbkJ1bXBDb21taXRTaGEpKSkge1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIExhdGVzdCBjb21taXQgaW4gXCIke3B1Ymxpc2hCcmFuY2h9XCIgYnJhbmNoIGlzIG5vdCBhIHN0YWdpbmcgY29tbWl0LmApO1xuICAgICAgTG9nLmVycm9yKCcgICAgICBQbGVhc2UgbWFrZSBzdXJlIHRoZSBzdGFnaW5nIHB1bGwgcmVxdWVzdCBoYXMgYmVlbiBtZXJnZWQuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICAvLyBFbnN1cmUgbm8gY29tbWl0cyBoYXZlIGxhbmRlZCBzaW5jZSB3ZSBzdGFydGVkIHRoZSBzdGFnaW5nIHByb2Nlc3MuIFRoaXMgd291bGQgc2lnbmlmeVxuICAgIC8vIHRoYXQgdGhlIGxvY2FsbHktYnVpbHQgcmVsZWFzZSBwYWNrYWdlcyBhcmUgbm90IG1hdGNoaW5nIHdpdGggdGhlIHJlbGVhc2UgY29tbWl0IG9uIEdpdEh1Yi5cbiAgICAvLyBOb3RlOiBXZSBleHBlY3QgdGhlIHZlcnNpb24gYnVtcCBjb21taXQgdG8gYmUgYWhlYWQgYnkgKipvbmUqKiBjb21taXQuIFRoaXMgbWVhbnMgaXQnc1xuICAgIC8vIHRoZSBkaXJlY3QgcGFyZW50IG9mIHRoZSBjb21taXQgdGhhdCB3YXMgbGF0ZXN0IHdoZW4gd2Ugc3RhcnRlZCB0aGUgc3RhZ2luZy5cbiAgICBpZiAoIShhd2FpdCB0aGlzLl9pc1JldmlzaW9uQWhlYWRPZkJhc2UoYmVmb3JlU3RhZ2luZ1NoYSwgdmVyc2lvbkJ1bXBDb21taXRTaGEsIDEpKSkge1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIFVuZXhwZWN0ZWQgYWRkaXRpb25hbCBjb21taXRzIGhhdmUgbGFuZGVkIHdoaWxlIHN0YWdpbmcgdGhlIHJlbGVhc2UuYCk7XG4gICAgICBMb2cuZXJyb3IoJyAgICAgIFBsZWFzZSByZXZlcnQgdGhlIGJ1bXAgY29tbWl0IGFuZCByZXRyeSwgb3IgY3V0IGEgbmV3IHZlcnNpb24gb24gdG9wLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuXG4gICAgLy8gQmVmb3JlIHB1Ymxpc2hpbmcsIHdlIHdhbnQgdG8gZW5zdXJlIHRoYXQgdGhlIGxvY2FsbHktYnVpbHQgcGFja2FnZXMgd2VcbiAgICAvLyBidWlsdCBpbiB0aGUgc3RhZ2luZyBwaGFzZSBoYXZlIG5vdCBiZWVuIG1vZGlmaWVkIGFjY2lkZW50YWxseS5cbiAgICBhd2FpdCBhc3NlcnRJbnRlZ3JpdHlPZkJ1aWx0UGFja2FnZXMoYnVpbHRQYWNrYWdlc1dpdGhJbmZvKTtcblxuICAgIC8vIENyZWF0ZSBhIEdpdGh1YiByZWxlYXNlIGZvciB0aGUgbmV3IHZlcnNpb24uXG4gICAgYXdhaXQgdGhpcy5fY3JlYXRlR2l0aHViUmVsZWFzZUZvclZlcnNpb24oXG4gICAgICByZWxlYXNlTm90ZXMsXG4gICAgICB2ZXJzaW9uQnVtcENvbW1pdFNoYSxcbiAgICAgIG5wbURpc3RUYWcgPT09ICduZXh0JyxcbiAgICAgIGFkZGl0aW9uYWxPcHRpb25zLnNob3dBc0xhdGVzdE9uR2l0SHViLFxuICAgICk7XG5cbiAgICAvLyBXYWxrIHRocm91Z2ggYWxsIGJ1aWx0IHBhY2thZ2VzIGFuZCBwdWJsaXNoIHRoZW0gdG8gTlBNLlxuICAgIGZvciAoY29uc3QgcGtnIG9mIGJ1aWx0UGFja2FnZXNXaXRoSW5mbykge1xuICAgICAgYXdhaXQgdGhpcy5fcHVibGlzaEJ1aWx0UGFja2FnZVRvTnBtKHBrZywgbnBtRGlzdFRhZyk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oJyAg4pyTICAgUHVibGlzaGVkIGFsbCBwYWNrYWdlcyBzdWNjZXNzZnVsbHknKSk7XG4gIH1cblxuICAvKiogUHVibGlzaGVzIHRoZSBnaXZlbiBidWlsdCBwYWNrYWdlIHRvIE5QTSB3aXRoIHRoZSBzcGVjaWZpZWQgTlBNIGRpc3QgdGFnLiAqL1xuICBwcml2YXRlIGFzeW5jIF9wdWJsaXNoQnVpbHRQYWNrYWdlVG9OcG0ocGtnOiBCdWlsdFBhY2thZ2UsIG5wbURpc3RUYWc6IE5wbURpc3RUYWcpIHtcbiAgICBMb2cuZGVidWcoYFN0YXJ0aW5nIHB1Ymxpc2ggb2YgXCIke3BrZy5uYW1lfVwiLmApO1xuICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcihgUHVibGlzaGluZyBcIiR7cGtnLm5hbWV9XCJgKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBOcG1Db21tYW5kLnB1Ymxpc2gocGtnLm91dHB1dFBhdGgsIG5wbURpc3RUYWcsIHRoaXMuY29uZmlnLnB1Ymxpc2hSZWdpc3RyeSk7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBTdWNjZXNzZnVsbHkgcHVibGlzaGVkIFwiJHtwa2cubmFtZX0uYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBwdWJsaXNoaW5nIFwiJHtwa2cubmFtZX1cIi5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gY29tbWl0IHJlcHJlc2VudHMgYSBzdGFnaW5nIGNvbW1pdCBmb3IgdGhlIHNwZWNpZmllZCB2ZXJzaW9uLiAqL1xuICBwcml2YXRlIGFzeW5jIF9pc0NvbW1pdEZvclZlcnNpb25TdGFnaW5nKHZlcnNpb246IHNlbXZlci5TZW1WZXIsIGNvbW1pdFNoYTogc3RyaW5nKSB7XG4gICAgY29uc3Qge2RhdGF9ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnJlcG9zLmdldENvbW1pdCh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICByZWY6IGNvbW1pdFNoYSxcbiAgICB9KTtcbiAgICByZXR1cm4gZGF0YS5jb21taXQubWVzc2FnZS5zdGFydHNXaXRoKGdldENvbW1pdE1lc3NhZ2VGb3JSZWxlYXNlKHZlcnNpb24pKTtcbiAgfVxuXG4gIC8vIFRPRE86IFJlbW92ZSB0aGlzIGNoZWNrIGFuZCBydW4gaXQgYXMgcGFydCBvZiBjb21tb24gcmVsZWFzZSB2YWxpZGF0aW9uLlxuICAvKiogVmVyaWZ5IHRoZSB2ZXJzaW9uIG9mIGVhY2ggZ2VuZXJhdGVkIHBhY2thZ2UgZXhhY3QgbWF0Y2hlcyB0aGUgc3BlY2lmaWVkIHZlcnNpb24uICovXG4gIHByaXZhdGUgYXN5bmMgX3ZlcmlmeVBhY2thZ2VWZXJzaW9ucyh2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyLCBwYWNrYWdlczogQnVpbHRQYWNrYWdlV2l0aEluZm9bXSkge1xuICAgIC8vIEV4cGVyaW1lbnRhbCBlcXVpdmFsZW50IHZlcnNpb24gZm9yIHBhY2thZ2VzLlxuICAgIGNvbnN0IGV4cGVyaW1lbnRhbFZlcnNpb24gPSBjcmVhdGVFeHBlcmltZW50YWxTZW12ZXIodmVyc2lvbik7XG5cbiAgICBmb3IgKGNvbnN0IHBrZyBvZiBwYWNrYWdlcykge1xuICAgICAgY29uc3Qge3ZlcnNpb246IHBhY2thZ2VKc29uVmVyc2lvbn0gPSBKU09OLnBhcnNlKFxuICAgICAgICBhd2FpdCBmcy5yZWFkRmlsZShqb2luKHBrZy5vdXRwdXRQYXRoLCAncGFja2FnZS5qc29uJyksICd1dGY4JyksXG4gICAgICApIGFzIHt2ZXJzaW9uOiBzdHJpbmc7IFtrZXk6IHN0cmluZ106IGFueX07XG5cbiAgICAgIGNvbnN0IGV4cGVjdGVkVmVyc2lvbiA9IHBrZy5leHBlcmltZW50YWwgPyBleHBlcmltZW50YWxWZXJzaW9uIDogdmVyc2lvbjtcbiAgICAgIGNvbnN0IG1pc21hdGNoZXNWZXJzaW9uID0gZXhwZWN0ZWRWZXJzaW9uLmNvbXBhcmUocGFja2FnZUpzb25WZXJzaW9uKSAhPT0gMDtcblxuICAgICAgaWYgKG1pc21hdGNoZXNWZXJzaW9uKSB7XG4gICAgICAgIExvZy5lcnJvcihgVGhlIGJ1aWx0IHBhY2thZ2UgdmVyc2lvbiBkb2VzIG5vdCBtYXRjaCBmb3I6ICR7cGtnLm5hbWV9LmApO1xuICAgICAgICBMb2cuZXJyb3IoYCAgQWN0dWFsIHZlcnNpb246ICAgJHtwYWNrYWdlSnNvblZlcnNpb259YCk7XG4gICAgICAgIExvZy5lcnJvcihgICBFeHBlY3RlZCB2ZXJzaW9uOiAke2V4cGVjdGVkVmVyc2lvbn1gKTtcbiAgICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=