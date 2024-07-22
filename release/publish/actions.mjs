/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { promises as fs } from 'fs';
import { join } from 'path';
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
        // Create a release staging commit including changelog and version bump.
        await this.createCommit(commitMessage, [
            workspaceRelativePackageJsonPath,
            workspaceRelativeChangelogPath,
        ]);
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
        const builtPackages = await ExternalCommands.invokeReleaseBuild(this.projectDir);
        const releaseInfo = await ExternalCommands.invokeReleaseInfo(this.projectDir);
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
        await ExternalCommands.invokeReleasePrecheck(this.projectDir, newVersion, builtPackagesWithInfo);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsUUFBUSxJQUFJLEVBQUUsRUFBQyxNQUFNLElBQUksQ0FBQztBQUNsQyxPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBRzFCLE9BQU8sRUFBQyxnQ0FBZ0MsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBRTFFLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBQzNELE9BQU8sWUFBWSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFDTCxrQkFBa0IsRUFDbEIseUJBQXlCLEVBQ3pCLG1CQUFtQixHQUNwQixNQUFNLGdDQUFnQyxDQUFDO0FBQ3hDLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRS9DLE9BQU8sRUFBQyxZQUFZLEVBQUUsOEJBQThCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUd2RixPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNoRixPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDeEQsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDdEUsT0FBTyxFQUFDLHVCQUF1QixFQUFFLDZCQUE2QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDMUYsT0FBTyxFQUNMLHFDQUFxQyxFQUNyQyw4QkFBOEIsR0FDL0IsTUFBTSx5QkFBeUIsQ0FBQztBQUNqQyxPQUFPLEVBQ0wsMEJBQTBCLEVBQzFCLHFDQUFxQyxHQUN0QyxNQUFNLHFCQUFxQixDQUFDO0FB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QUFHLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztnQkFDeEUsR0FBRyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO2dCQUN2RCxHQUFHLENBQUMsS0FBSyxDQUFDLHVCQUF1QixlQUFlLEVBQUUsQ0FBQyxDQUFDO2dCQUNwRCxNQUFNLElBQUksdUJBQXVCLEVBQUUsQ0FBQztZQUN0QyxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3Byb21pc2VzIGFzIGZzfSBmcm9tICdmcyc7XG5pbXBvcnQge2pvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG5pbXBvcnQge3dvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRofSBmcm9tICcuLi8uLi91dGlscy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7aXNHaXRodWJBcGlFcnJvcn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi5qcyc7XG5pbXBvcnQgZ2l0aHViTWFjcm9zIGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWItbWFjcm9zLmpzJztcbmltcG9ydCB7XG4gIGdldEZpbGVDb250ZW50c1VybCxcbiAgZ2V0TGlzdENvbW1pdHNJbkJyYW5jaFVybCxcbiAgZ2V0UmVwb3NpdG9yeUdpdFVybCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi11cmxzLmpzJztcbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1NwaW5uZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXIuanMnO1xuaW1wb3J0IHtCdWlsdFBhY2thZ2UsIEJ1aWx0UGFja2FnZVdpdGhJbmZvLCBSZWxlYXNlQ29uZmlnfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtSZWxlYXNlTm90ZXMsIHdvcmtzcGFjZVJlbGF0aXZlQ2hhbmdlbG9nUGF0aH0gZnJvbSAnLi4vbm90ZXMvcmVsZWFzZS1ub3Rlcy5qcyc7XG5pbXBvcnQge05wbURpc3RUYWcsIFBhY2thZ2VKc29ufSBmcm9tICcuLi92ZXJzaW9uaW5nL2luZGV4LmpzJztcbmltcG9ydCB7QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMuanMnO1xuaW1wb3J0IHtjcmVhdGVFeHBlcmltZW50YWxTZW12ZXJ9IGZyb20gJy4uL3ZlcnNpb25pbmcvZXhwZXJpbWVudGFsLXZlcnNpb25zLmpzJztcbmltcG9ydCB7TnBtQ29tbWFuZH0gZnJvbSAnLi4vdmVyc2lvbmluZy9ucG0tY29tbWFuZC5qcyc7XG5pbXBvcnQge2dldFJlbGVhc2VUYWdGb3JWZXJzaW9ufSBmcm9tICcuLi92ZXJzaW9uaW5nL3ZlcnNpb24tdGFncy5qcyc7XG5pbXBvcnQge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yLCBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcn0gZnJvbSAnLi9hY3Rpb25zLWVycm9yLmpzJztcbmltcG9ydCB7XG4gIGFuYWx5emVBbmRFeHRlbmRCdWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gIGFzc2VydEludGVncml0eU9mQnVpbHRQYWNrYWdlcyxcbn0gZnJvbSAnLi9idWlsdC1wYWNrYWdlLWluZm8uanMnO1xuaW1wb3J0IHtcbiAgZ2V0Q29tbWl0TWVzc2FnZUZvclJlbGVhc2UsXG4gIGdldFJlbGVhc2VOb3RlQ2hlcnJ5UGlja0NvbW1pdE1lc3NhZ2UsXG59IGZyb20gJy4vY29tbWl0LW1lc3NhZ2UuanMnO1xuaW1wb3J0IHtnaXRodWJSZWxlYXNlQm9keUxpbWl0fSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQge0V4dGVybmFsQ29tbWFuZHN9IGZyb20gJy4vZXh0ZXJuYWwtY29tbWFuZHMuanMnO1xuaW1wb3J0IHtwcm9tcHRUb0luaXRpYXRlUHVsbFJlcXVlc3RNZXJnZX0gZnJvbSAnLi9wcm9tcHQtbWVyZ2UuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyBhIEdpdGh1YiByZXBvc2l0b3J5LiAqL1xuZXhwb3J0IGludGVyZmFjZSBHaXRodWJSZXBvIHtcbiAgb3duZXI6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xufVxuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgYSBHaXRodWIgcHVsbCByZXF1ZXN0LiAqL1xuZXhwb3J0IGludGVyZmFjZSBQdWxsUmVxdWVzdCB7XG4gIC8qKiBVbmlxdWUgaWQgZm9yIHRoZSBwdWxsIHJlcXVlc3QgKGkuZS4gdGhlIFBSIG51bWJlcikuICovXG4gIGlkOiBudW1iZXI7XG4gIC8qKiBVUkwgdGhhdCByZXNvbHZlcyB0byB0aGUgcHVsbCByZXF1ZXN0IGluIEdpdGh1Yi4gKi9cbiAgdXJsOiBzdHJpbmc7XG4gIC8qKiBGb3JrIGNvbnRhaW5pbmcgdGhlIGhlYWQgYnJhbmNoIG9mIHRoaXMgcHVsbCByZXF1ZXN0LiAqL1xuICBmb3JrOiBHaXRodWJSZXBvO1xuICAvKiogQnJhbmNoIG5hbWUgaW4gdGhlIGZvcmsgdGhhdCBkZWZpbmVzIHRoaXMgcHVsbCByZXF1ZXN0LiAqL1xuICBmb3JrQnJhbmNoOiBzdHJpbmc7XG59XG5cbi8qKiBPcHRpb25zIHRoYXQgY2FuIGJlIHVzZWQgdG8gY29udHJvbCB0aGUgc3RhZ2luZyBvZiBhIG5ldyB2ZXJzaW9uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdGFnaW5nT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBBcyBwYXJ0IG9mIHN0YWdpbmcsIHRoZSBgcGFja2FnZS5qc29uYCBjYW4gYmUgdXBkYXRlZCBiZWZvcmUgdGhlXG4gICAqIG5ldyB2ZXJzaW9uIGlzIHNldC5cbiAgICogQHNlZSB7UmVsZWFzZUFjdGlvbi51cGRhdGVQcm9qZWN0VmVyc2lvbn1cbiAgICovXG4gIHVwZGF0ZVBrZ0pzb25Gbj86IChwa2dKc29uOiBQYWNrYWdlSnNvbikgPT4gdm9pZDtcbn1cblxuLyoqIENvbnN0cnVjdG9yIHR5cGUgZm9yIGluc3RhbnRpYXRpbmcgYSByZWxlYXNlIGFjdGlvbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZWxlYXNlQWN0aW9uQ29uc3RydWN0b3I8VCBleHRlbmRzIFJlbGVhc2VBY3Rpb24gPSBSZWxlYXNlQWN0aW9uPiB7XG4gIC8qKiBXaGV0aGVyIHRoZSByZWxlYXNlIGFjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlLiAqL1xuICBpc0FjdGl2ZShhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMsIGNvbmZpZzogUmVsZWFzZUNvbmZpZyk6IFByb21pc2U8Ym9vbGVhbj47XG4gIC8qKiBDb25zdHJ1Y3RzIGEgcmVsZWFzZSBhY3Rpb24uICovXG4gIG5ldyAoLi4uYXJnczogW0FjdGl2ZVJlbGVhc2VUcmFpbnMsIEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsIFJlbGVhc2VDb25maWcsIHN0cmluZ10pOiBUO1xufVxuXG4vKipcbiAqIEFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIGEgcmVsZWFzZSBhY3Rpb24uIEEgcmVsZWFzZSBhY3Rpb24gaXMgc2VsZWN0YWJsZSBieSB0aGUgY2FyZXRha2VyXG4gKiBpZiBhY3RpdmUsIGFuZCBjYW4gcGVyZm9ybSBjaGFuZ2VzIGZvciByZWxlYXNpbmcsIHN1Y2ggYXMgc3RhZ2luZyBhIHJlbGVhc2UsIGJ1bXBpbmcgdGhlXG4gKiB2ZXJzaW9uLCBjaGVycnktcGlja2luZyB0aGUgY2hhbmdlbG9nLCBicmFuY2hpbmcgb2ZmIGZyb20gdGhlIG1haW4gYnJhbmNoLiBldGMuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBSZWxlYXNlQWN0aW9uIHtcbiAgLyoqIFdoZXRoZXIgdGhlIHJlbGVhc2UgYWN0aW9uIGlzIGN1cnJlbnRseSBhY3RpdmUuICovXG4gIHN0YXRpYyBpc0FjdGl2ZShfdHJhaW5zOiBBY3RpdmVSZWxlYXNlVHJhaW5zLCBfY29uZmlnOiBSZWxlYXNlQ29uZmlnKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdGhyb3cgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSByZWxlYXNlIGFjdGlvbi4gKi9cbiAgYWJzdHJhY3QgZ2V0RGVzY3JpcHRpb24oKTogUHJvbWlzZTxzdHJpbmc+O1xuICAvKipcbiAgICogUGVyZm9ybXMgdGhlIGdpdmVuIHJlbGVhc2UgYWN0aW9uLlxuICAgKiBAdGhyb3dzIHtVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcn0gV2hlbiB0aGUgdXNlciBtYW51YWxseSBhYm9ydGVkIHRoZSBhY3Rpb24uXG4gICAqIEB0aHJvd3Mge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yfSBXaGVuIHRoZSBhY3Rpb24gaGFzIGJlZW4gYWJvcnRlZCBkdWUgdG8gYSBmYXRhbCBlcnJvci5cbiAgICovXG4gIGFic3RyYWN0IHBlcmZvcm0oKTogUHJvbWlzZTx2b2lkPjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgYWN0aXZlOiBBY3RpdmVSZWxlYXNlVHJhaW5zLFxuICAgIHByb3RlY3RlZCBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgcHJvdGVjdGVkIGNvbmZpZzogUmVsZWFzZUNvbmZpZyxcbiAgICBwcm90ZWN0ZWQgcHJvamVjdERpcjogc3RyaW5nLFxuICApIHt9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIHZlcnNpb24gaW4gdGhlIHByb2plY3QgdG9wLWxldmVsIGBwYWNrYWdlLmpzb25gIGZpbGUuXG4gICAqXG4gICAqIEBwYXJhbSBuZXdWZXJzaW9uIE5ldyBTZW1WZXIgdmVyc2lvbiB0byBiZSBzZXQgaW4gdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBhZGRpdGlvbmFsVXBkYXRlRm4gT3B0aW9uYWwgdXBkYXRlIGZ1bmN0aW9uIHRoYXQgcnVucyBiZWZvcmVcbiAgICogICB0aGUgdmVyc2lvbiB1cGRhdGUuIENhbiBiZSB1c2VkIHRvIHVwZGF0ZSBvdGhlciBmaWVsZHMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgdXBkYXRlUHJvamVjdFZlcnNpb24oXG4gICAgbmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBhZGRpdGlvbmFsVXBkYXRlRm4/OiAocGtnSnNvbjogUGFja2FnZUpzb24pID0+IHZvaWQsXG4gICkge1xuICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gam9pbih0aGlzLnByb2plY3REaXIsIHdvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRoKTtcbiAgICBjb25zdCBwa2dKc29uID0gSlNPTi5wYXJzZShhd2FpdCBmcy5yZWFkRmlsZShwa2dKc29uUGF0aCwgJ3V0ZjgnKSkgYXMge1xuICAgICAgdmVyc2lvbjogc3RyaW5nO1xuICAgICAgW2tleTogc3RyaW5nXTogYW55O1xuICAgIH07XG4gICAgaWYgKGFkZGl0aW9uYWxVcGRhdGVGbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhZGRpdGlvbmFsVXBkYXRlRm4ocGtnSnNvbik7XG4gICAgfVxuICAgIHBrZ0pzb24udmVyc2lvbiA9IG5ld1ZlcnNpb24uZm9ybWF0KCk7XG4gICAgLy8gV3JpdGUgdGhlIGBwYWNrYWdlLmpzb25gIGZpbGUuIE5vdGUgdGhhdCB3ZSBhZGQgYSB0cmFpbGluZyBuZXcgbGluZVxuICAgIC8vIHRvIGF2b2lkIHVubmVjZXNzYXJ5IGRpZmYuIElERXMgdXN1YWxseSBhZGQgYSB0cmFpbGluZyBuZXcgbGluZS5cbiAgICBhd2FpdCBmcy53cml0ZUZpbGUocGtnSnNvblBhdGgsIGAke0pTT04uc3RyaW5naWZ5KHBrZ0pzb24sIG51bGwsIDIpfVxcbmApO1xuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFVwZGF0ZWQgcHJvamVjdCB2ZXJzaW9uIHRvICR7cGtnSnNvbi52ZXJzaW9ufWApKTtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBtb3N0IHJlY2VudCBjb21taXQgb2YgYSBzcGVjaWZpZWQgYnJhbmNoLiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgZ2V0TGF0ZXN0Q29tbWl0T2ZCcmFuY2goYnJhbmNoTmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCB7XG4gICAgICBkYXRhOiB7Y29tbWl0fSxcbiAgICB9ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnJlcG9zLmdldEJyYW5jaCh7Li4udGhpcy5naXQucmVtb3RlUGFyYW1zLCBicmFuY2g6IGJyYW5jaE5hbWV9KTtcbiAgICByZXR1cm4gY29tbWl0LnNoYTtcbiAgfVxuXG4gIC8qKiBDaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gcmV2aXNpb24gaXMgYWhlYWQgdG8gdGhlIGJhc2UgYnkgdGhlIHNwZWNpZmllZCBhbW91bnQuICovXG4gIHByaXZhdGUgYXN5bmMgX2lzUmV2aXNpb25BaGVhZE9mQmFzZShcbiAgICBiYXNlUmV2aXNpb246IHN0cmluZyxcbiAgICB0YXJnZXRSZXZpc2lvbjogc3RyaW5nLFxuICAgIGV4cGVjdGVkQWhlYWRDb3VudDogbnVtYmVyLFxuICApIHtcbiAgICBjb25zdCB7XG4gICAgICBkYXRhOiB7YWhlYWRfYnksIHN0YXR1c30sXG4gICAgfSA9IGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5yZXBvcy5jb21wYXJlQ29tbWl0cyh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBiYXNlOiBiYXNlUmV2aXNpb24sXG4gICAgICBoZWFkOiB0YXJnZXRSZXZpc2lvbixcbiAgICB9KTtcblxuICAgIHJldHVybiBzdGF0dXMgPT09ICdhaGVhZCcgJiYgYWhlYWRfYnkgPT09IGV4cGVjdGVkQWhlYWRDb3VudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBWZXJpZmllcyB0aGF0IHRoZSBnaXZlbiBjb21taXQgaGFzIHBhc3NpbmcgYWxsIHN0YXR1c2VzLlxuICAgKlxuICAgKiBVcG9uIGVycm9yLCBhIGxpbmsgdG8gdGhlIGJyYW5jaCBjb250YWluaW5nIHRoZSBjb21taXQgaXMgcHJpbnRlZCxcbiAgICogYWxsb3dpbmcgdGhlIGNhcmV0YWtlciB0byBxdWlja2x5IGluc3BlY3QgdGhlIEdpdEh1YiBjb21taXQgc3RhdHVzIGZhaWx1cmVzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGFzc2VydFBhc3NpbmdHaXRodWJTdGF0dXMoY29tbWl0U2hhOiBzdHJpbmcsIGJyYW5jaE5hbWVGb3JFcnJvcjogc3RyaW5nKSB7XG4gICAgY29uc3Qge3Jlc3VsdH0gPSBhd2FpdCBnaXRodWJNYWNyb3MuZ2V0Q29tYmluZWRDaGVja3NBbmRTdGF0dXNlc0ZvclJlZih0aGlzLmdpdC5naXRodWIsIHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIHJlZjogY29tbWl0U2hhLFxuICAgIH0pO1xuICAgIGNvbnN0IGJyYW5jaENvbW1pdHNVcmwgPSBnZXRMaXN0Q29tbWl0c0luQnJhbmNoVXJsKHRoaXMuZ2l0LCBicmFuY2hOYW1lRm9yRXJyb3IpO1xuXG4gICAgaWYgKHJlc3VsdCA9PT0gJ2ZhaWxpbmcnIHx8IHJlc3VsdCA9PT0gbnVsbCkge1xuICAgICAgTG9nLmVycm9yKFxuICAgICAgICBgICDinJggICBDYW5ub3Qgc3RhZ2UgcmVsZWFzZS4gQ29tbWl0IFwiJHtjb21taXRTaGF9XCIgZG9lcyBub3QgcGFzcyBhbGwgZ2l0aHViIGAgK1xuICAgICAgICAgICdzdGF0dXMgY2hlY2tzLiBQbGVhc2UgbWFrZSBzdXJlIHRoaXMgY29tbWl0IHBhc3NlcyBhbGwgY2hlY2tzIGJlZm9yZSByZS1ydW5uaW5nLicsXG4gICAgICApO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgaGF2ZSBhIGxvb2sgYXQ6ICR7YnJhbmNoQ29tbWl0c1VybH1gKTtcblxuICAgICAgaWYgKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gaWdub3JlIHRoZSBHaXRodWIgc3RhdHVzIGFuZCBwcm9jZWVkPyd9KSkge1xuICAgICAgICBMb2cud2FybihcbiAgICAgICAgICAnICDimqAgICBVcHN0cmVhbSBjb21taXQgaXMgZmFpbGluZyBDSSBjaGVja3MsIGJ1dCBzdGF0dXMgaGFzIGJlZW4gZm9yY2libHkgaWdub3JlZC4nLFxuICAgICAgICApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9IGVsc2UgaWYgKHJlc3VsdCA9PT0gJ3BlbmRpbmcnKSB7XG4gICAgICBMb2cuZXJyb3IoXG4gICAgICAgIGAgIOKcmCAgIENvbW1pdCBcIiR7Y29tbWl0U2hhfVwiIHN0aWxsIGhhcyBwZW5kaW5nIGdpdGh1YiBzdGF0dXNlcyB0aGF0IGAgK1xuICAgICAgICAgICduZWVkIHRvIHN1Y2NlZWQgYmVmb3JlIHN0YWdpbmcgYSByZWxlYXNlLicsXG4gICAgICApO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgaGF2ZSBhIGxvb2sgYXQ6ICR7YnJhbmNoQ29tbWl0c1VybH1gKTtcbiAgICAgIGlmIChhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogJ0RvIHlvdSB3YW50IHRvIGlnbm9yZSB0aGUgR2l0aHViIHN0YXR1cyBhbmQgcHJvY2VlZD8nfSkpIHtcbiAgICAgICAgTG9nLndhcm4oJyAg4pqgICAgVXBzdHJlYW0gY29tbWl0IGlzIHBlbmRpbmcgQ0ksIGJ1dCBzdGF0dXMgaGFzIGJlZW4gZm9yY2libHkgaWdub3JlZC4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IFVzZXJBYm9ydGVkUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oJyAg4pyTICAgVXBzdHJlYW0gY29tbWl0IGlzIHBhc3NpbmcgYWxsIGdpdGh1YiBzdGF0dXMgY2hlY2tzLicpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9tcHRzIHRoZSB1c2VyIGZvciBwb3RlbnRpYWwgcmVsZWFzZSBub3RlcyBlZGl0cyB0aGF0IG5lZWQgdG8gYmUgbWFkZS4gT25jZVxuICAgKiBjb25maXJtZWQsIGEgbmV3IGNvbW1pdCBmb3IgdGhlIHJlbGVhc2UgcG9pbnQgaXMgY3JlYXRlZC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyB3YWl0Rm9yRWRpdHNBbmRDcmVhdGVSZWxlYXNlQ29tbWl0KG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIpIHtcbiAgICBMb2cud2FybihcbiAgICAgICcgIOKaoCAgIFBsZWFzZSByZXZpZXcgdGhlIGNoYW5nZWxvZyBhbmQgZW5zdXJlIHRoYXQgdGhlIGxvZyBjb250YWlucyBvbmx5IGNoYW5nZXMgJyArXG4gICAgICAgICd0aGF0IGFwcGx5IHRvIHRoZSBwdWJsaWMgQVBJIHN1cmZhY2UuJyxcbiAgICApO1xuICAgIExvZy53YXJuKCcgICAgICBNYW51YWwgY2hhbmdlcyBjYW4gYmUgbWFkZS4gV2hlbiBkb25lLCBwbGVhc2UgcHJvY2VlZCB3aXRoIHRoZSBwcm9tcHQgYmVsb3cuJyk7XG5cbiAgICBpZiAoIShhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogJ0RvIHlvdSB3YW50IHRvIHByb2NlZWQgYW5kIGNvbW1pdCB0aGUgY2hhbmdlcz8nfSkpKSB7XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICAvLyBDb21taXQgbWVzc2FnZSBmb3IgdGhlIHJlbGVhc2UgcG9pbnQuXG4gICAgY29uc3QgY29tbWl0TWVzc2FnZSA9IGdldENvbW1pdE1lc3NhZ2VGb3JSZWxlYXNlKG5ld1ZlcnNpb24pO1xuXG4gICAgLy8gQ3JlYXRlIGEgcmVsZWFzZSBzdGFnaW5nIGNvbW1pdCBpbmNsdWRpbmcgY2hhbmdlbG9nIGFuZCB2ZXJzaW9uIGJ1bXAuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVDb21taXQoY29tbWl0TWVzc2FnZSwgW1xuICAgICAgd29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGgsXG4gICAgICB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGgsXG4gICAgXSk7XG5cbiAgICAvLyBUaGUgY2FyZXRha2VyIG1heSBoYXZlIGF0dGVtcHRlZCB0byBtYWtlIGFkZGl0aW9uYWwgY2hhbmdlcy4gVGhlc2UgY2hhbmdlcyB3b3VsZFxuICAgIC8vIG5vdCBiZSBjYXB0dXJlZCBpbnRvIHRoZSByZWxlYXNlIGNvbW1pdC4gVGhlIHdvcmtpbmcgZGlyZWN0b3J5IHNob3VsZCByZW1haW4gY2xlYW4sXG4gICAgLy8gbGlrZSB3ZSBhc3N1bWUgaXQgYmVpbmcgY2xlYW4gd2hlbiB3ZSBzdGFydCB0aGUgcmVsZWFzZSBhY3Rpb25zLlxuICAgIGlmICh0aGlzLmdpdC5oYXNVbmNvbW1pdHRlZENoYW5nZXMoKSkge1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIFVucmVsYXRlZCBjaGFuZ2VzIGhhdmUgYmVlbiBtYWRlIGFzIHBhcnQgb2YgdGhlIGNoYW5nZWxvZyBlZGl0aW5nLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCByZWxlYXNlIGNvbW1pdCBmb3I6IFwiJHtuZXdWZXJzaW9ufVwiLmApKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFuIG93bmVkIGZvcmsgZm9yIHRoZSBjb25maWd1cmVkIHByb2plY3Qgb2YgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlci4gQWJvcnRzIHRoZVxuICAgKiBwcm9jZXNzIHdpdGggYW4gZXJyb3IgaWYgbm8gZm9yayBjb3VsZCBiZSBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX2dldEZvcmtPZkF1dGhlbnRpY2F0ZWRVc2VyKCk6IFByb21pc2U8R2l0aHViUmVwbz4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5naXQuZ2V0Rm9ya09mQXV0aGVudGljYXRlZFVzZXIoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHtvd25lciwgbmFtZX0gPSB0aGlzLmdpdC5yZW1vdGVDb25maWc7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVW5hYmxlIHRvIGZpbmQgZm9yayBmb3IgY3VycmVudGx5IGF1dGhlbnRpY2F0ZWQgdXNlci4nKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgUGxlYXNlIGVuc3VyZSB5b3UgY3JlYXRlZCBhIGZvcmsgb2Y6ICR7b3duZXJ9LyR7bmFtZX0uYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKiogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBicmFuY2ggbmFtZSBpcyByZXNlcnZlZCBpbiB0aGUgc3BlY2lmaWVkIHJlcG9zaXRvcnkuICovXG4gIHByaXZhdGUgYXN5bmMgX2lzQnJhbmNoTmFtZVJlc2VydmVkSW5SZXBvKHJlcG86IEdpdGh1YlJlcG8sIG5hbWU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuZ2V0QnJhbmNoKHtvd25lcjogcmVwby5vd25lciwgcmVwbzogcmVwby5uYW1lLCBicmFuY2g6IG5hbWV9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIElmIHRoZSBlcnJvciBoYXMgYSBgc3RhdHVzYCBwcm9wZXJ0eSBzZXQgdG8gYDQwNGAsIHRoZW4gd2Uga25vdyB0aGF0IHRoZSBicmFuY2hcbiAgICAgIC8vIGRvZXMgbm90IGV4aXN0LiBPdGhlcndpc2UsIGl0IG1pZ2h0IGJlIGFuIEFQSSBlcnJvciB0aGF0IHdlIHdhbnQgdG8gcmVwb3J0L3JlLXRocm93LlxuICAgICAgaWYgKGlzR2l0aHViQXBpRXJyb3IoZSkgJiYgZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBGaW5kcyBhIG5vbi1yZXNlcnZlZCBicmFuY2ggbmFtZSBpbiB0aGUgcmVwb3NpdG9yeSB3aXRoIHJlc3BlY3QgdG8gYSBiYXNlIG5hbWUuICovXG4gIHByaXZhdGUgYXN5bmMgX2ZpbmRBdmFpbGFibGVCcmFuY2hOYW1lKHJlcG86IEdpdGh1YlJlcG8sIGJhc2VOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGxldCBjdXJyZW50TmFtZSA9IGJhc2VOYW1lO1xuICAgIGxldCBzdWZmaXhOdW0gPSAwO1xuICAgIHdoaWxlIChhd2FpdCB0aGlzLl9pc0JyYW5jaE5hbWVSZXNlcnZlZEluUmVwbyhyZXBvLCBjdXJyZW50TmFtZSkpIHtcbiAgICAgIHN1ZmZpeE51bSsrO1xuICAgICAgY3VycmVudE5hbWUgPSBgJHtiYXNlTmFtZX1fJHtzdWZmaXhOdW19YDtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnJlbnROYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsb2NhbCBicmFuY2ggZnJvbSB0aGUgY3VycmVudCBHaXQgYEhFQURgLiBXaWxsIG92ZXJyaWRlXG4gICAqIGV4aXN0aW5nIGJyYW5jaGVzIGluIGNhc2Ugb2YgYSBjb2xsaXNpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctcScsICctQicsIGJyYW5jaE5hbWVdKTtcbiAgfVxuXG4gIC8qKiBQdXNoZXMgdGhlIGN1cnJlbnQgR2l0IGBIRUFEYCB0byB0aGUgZ2l2ZW4gcmVtb3RlIGJyYW5jaCBpbiB0aGUgY29uZmlndXJlZCBwcm9qZWN0LiAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgcHVzaEhlYWRUb1JlbW90ZUJyYW5jaChicmFuY2hOYW1lOiBzdHJpbmcpIHtcbiAgICAvLyBQdXNoIHRoZSBsb2NhbCBgSEVBRGAgdG8gdGhlIHJlbW90ZSBicmFuY2ggaW4gdGhlIGNvbmZpZ3VyZWQgcHJvamVjdC5cbiAgICB0aGlzLmdpdC5ydW4oWydwdXNoJywgJy1xJywgdGhpcy5naXQuZ2V0UmVwb0dpdFVybCgpLCBgSEVBRDpyZWZzL2hlYWRzLyR7YnJhbmNoTmFtZX1gXSk7XG4gIH1cblxuICAvKipcbiAgICogUHVzaGVzIHRoZSBjdXJyZW50IEdpdCBgSEVBRGAgdG8gYSBmb3JrIGZvciB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgaXMgb3duZWQgYnlcbiAgICogdGhlIGF1dGhlbnRpY2F0ZWQgdXNlci4gSWYgdGhlIHNwZWNpZmllZCBicmFuY2ggbmFtZSBleGlzdHMgaW4gdGhlIGZvcmsgYWxyZWFkeSwgYVxuICAgKiB1bmlxdWUgb25lIHdpbGwgYmUgZ2VuZXJhdGVkIGJhc2VkIG9uIHRoZSBwcm9wb3NlZCBuYW1lIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gICAqIEBwYXJhbSBwcm9wb3NlZEJyYW5jaE5hbWUgUHJvcG9zZWQgYnJhbmNoIG5hbWUgZm9yIHRoZSBmb3JrLlxuICAgKiBAcGFyYW0gdHJhY2tMb2NhbEJyYW5jaCBXaGV0aGVyIHRoZSBmb3JrIGJyYW5jaCBzaG91bGQgYmUgdHJhY2tlZCBsb2NhbGx5LiBpLmUuIHdoZXRoZXJcbiAgICogICBhIGxvY2FsIGJyYW5jaCB3aXRoIHJlbW90ZSB0cmFja2luZyBzaG91bGQgYmUgc2V0IHVwLlxuICAgKiBAcmV0dXJucyBUaGUgZm9yayBhbmQgYnJhbmNoIG5hbWUgY29udGFpbmluZyB0aGUgcHVzaGVkIGNoYW5nZXMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9wdXNoSGVhZFRvRm9yayhcbiAgICBwcm9wb3NlZEJyYW5jaE5hbWU6IHN0cmluZyxcbiAgICB0cmFja0xvY2FsQnJhbmNoOiBib29sZWFuLFxuICApOiBQcm9taXNlPHtmb3JrOiBHaXRodWJSZXBvOyBicmFuY2hOYW1lOiBzdHJpbmd9PiB7XG4gICAgY29uc3QgZm9yayA9IGF3YWl0IHRoaXMuX2dldEZvcmtPZkF1dGhlbnRpY2F0ZWRVc2VyKCk7XG4gICAgLy8gQ29tcHV0ZSBhIHJlcG9zaXRvcnkgVVJMIGZvciBwdXNoaW5nIHRvIHRoZSBmb3JrLiBOb3RlIHRoYXQgd2Ugd2FudCB0byByZXNwZWN0XG4gICAgLy8gdGhlIFNTSCBvcHRpb24gZnJvbSB0aGUgZGV2LWluZnJhIGdpdGh1YiBjb25maWd1cmF0aW9uLlxuICAgIGNvbnN0IHJlcG9HaXRVcmwgPSBnZXRSZXBvc2l0b3J5R2l0VXJsKFxuICAgICAgey4uLmZvcmssIHVzZVNzaDogdGhpcy5naXQucmVtb3RlQ29uZmlnLnVzZVNzaH0sXG4gICAgICB0aGlzLmdpdC5naXRodWJUb2tlbixcbiAgICApO1xuICAgIGNvbnN0IGJyYW5jaE5hbWUgPSBhd2FpdCB0aGlzLl9maW5kQXZhaWxhYmxlQnJhbmNoTmFtZShmb3JrLCBwcm9wb3NlZEJyYW5jaE5hbWUpO1xuICAgIGNvbnN0IHB1c2hBcmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIC8vIElmIGEgbG9jYWwgYnJhbmNoIHNob3VsZCB0cmFjayB0aGUgcmVtb3RlIGZvcmsgYnJhbmNoLCBjcmVhdGUgYSBicmFuY2ggbWF0Y2hpbmdcbiAgICAvLyB0aGUgcmVtb3RlIGJyYW5jaC4gTGF0ZXIgd2l0aCB0aGUgYGdpdCBwdXNoYCwgdGhlIHJlbW90ZSBpcyBzZXQgZm9yIHRoZSBicmFuY2guXG4gICAgaWYgKHRyYWNrTG9jYWxCcmFuY2gpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZChicmFuY2hOYW1lKTtcbiAgICAgIHB1c2hBcmdzLnB1c2goJy0tc2V0LXVwc3RyZWFtJyk7XG4gICAgfVxuICAgIC8vIFB1c2ggdGhlIGxvY2FsIGBIRUFEYCB0byB0aGUgcmVtb3RlIGJyYW5jaCBpbiB0aGUgZm9yay5cbiAgICB0aGlzLmdpdC5ydW4oWydwdXNoJywgJy1xJywgcmVwb0dpdFVybCwgYEhFQUQ6cmVmcy9oZWFkcy8ke2JyYW5jaE5hbWV9YCwgLi4ucHVzaEFyZ3NdKTtcbiAgICByZXR1cm4ge2ZvcmssIGJyYW5jaE5hbWV9O1xuICB9XG5cbiAgLyoqXG4gICAqIFB1c2hlcyBjaGFuZ2VzIHRvIGEgZm9yayBmb3IgdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCB0aGF0IGlzIG93bmVkIGJ5IHRoZSBjdXJyZW50bHlcbiAgICogYXV0aGVudGljYXRlZCB1c2VyLiBBIHB1bGwgcmVxdWVzdCBpcyB0aGVuIGNyZWF0ZWQgZm9yIHRoZSBwdXNoZWQgY2hhbmdlcyBvbiB0aGVcbiAgICogY29uZmlndXJlZCBwcm9qZWN0IHRoYXQgdGFyZ2V0cyB0aGUgc3BlY2lmaWVkIHRhcmdldCBicmFuY2guXG4gICAqIEByZXR1cm5zIEFuIG9iamVjdCBkZXNjcmliaW5nIHRoZSBjcmVhdGVkIHB1bGwgcmVxdWVzdC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBwdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgIHRhcmdldEJyYW5jaDogc3RyaW5nLFxuICAgIHByb3Bvc2VkRm9ya0JyYW5jaE5hbWU6IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIGJvZHk/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8UHVsbFJlcXVlc3Q+IHtcbiAgICBjb25zdCByZXBvU2x1ZyA9IGAke3RoaXMuZ2l0LnJlbW90ZVBhcmFtcy5vd25lcn0vJHt0aGlzLmdpdC5yZW1vdGVQYXJhbXMucmVwb31gO1xuICAgIGNvbnN0IHtmb3JrLCBicmFuY2hOYW1lfSA9IGF3YWl0IHRoaXMuX3B1c2hIZWFkVG9Gb3JrKHByb3Bvc2VkRm9ya0JyYW5jaE5hbWUsIHRydWUpO1xuICAgIGNvbnN0IHtkYXRhfSA9IGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5wdWxscy5jcmVhdGUoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgaGVhZDogYCR7Zm9yay5vd25lcn06JHticmFuY2hOYW1lfWAsXG4gICAgICBiYXNlOiB0YXJnZXRCcmFuY2gsXG4gICAgICBib2R5LFxuICAgICAgdGl0bGUsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgbGFiZWxzIHRvIHRoZSBuZXdseSBjcmVhdGVkIFBSIGlmIHByb3ZpZGVkIGluIHRoZSBjb25maWd1cmF0aW9uLlxuICAgIGlmICh0aGlzLmNvbmZpZy5yZWxlYXNlUHJMYWJlbHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLmlzc3Vlcy5hZGRMYWJlbHMoe1xuICAgICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICAgIGlzc3VlX251bWJlcjogZGF0YS5udW1iZXIsXG4gICAgICAgIGxhYmVsczogdGhpcy5jb25maWcucmVsZWFzZVByTGFiZWxzLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCBwdWxsIHJlcXVlc3QgIyR7ZGF0YS5udW1iZXJ9IGluICR7cmVwb1NsdWd9LmApKTtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGRhdGEubnVtYmVyLFxuICAgICAgdXJsOiBkYXRhLmh0bWxfdXJsLFxuICAgICAgZm9yayxcbiAgICAgIGZvcmtCcmFuY2g6IGJyYW5jaE5hbWUsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwZW5kIHJlbGVhc2VzIG5vdGVzIGZvciBhIHZlcnNpb24gcHVibGlzaGVkIGluIGEgZ2l2ZW4gYnJhbmNoIHRvIHRoZSBjaGFuZ2Vsb2cgaW5cbiAgICogdGhlIGN1cnJlbnQgR2l0IGBIRUFEYC4gVGhpcyBpcyB1c2VmdWwgZm9yIGNoZXJyeS1waWNraW5nIHRoZSBjaGFuZ2Vsb2cuXG4gICAqIEByZXR1cm5zIEEgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHJlbGVhc2Ugbm90ZXMgaGF2ZSBiZWVuIHByZXBlbmRlZC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBwcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCByZWxlYXNlTm90ZXMucHJlcGVuZEVudHJ5VG9DaGFuZ2Vsb2dGaWxlKCk7XG4gICAgTG9nLmluZm8oXG4gICAgICBncmVlbihgICDinJMgICBVcGRhdGVkIHRoZSBjaGFuZ2Vsb2cgdG8gY2FwdHVyZSBjaGFuZ2VzIGZvciBcIiR7cmVsZWFzZU5vdGVzLnZlcnNpb259XCIuYCksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBDaGVja3Mgb3V0IGFuIHVwc3RyZWFtIGJyYW5jaCB3aXRoIGEgZGV0YWNoZWQgaGVhZC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNoZWNrb3V0VXBzdHJlYW1CcmFuY2goYnJhbmNoTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5naXQucnVuKFsnZmV0Y2gnLCAnLXEnLCB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksIGJyYW5jaE5hbWVdKTtcbiAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctcScsICdGRVRDSF9IRUFEJywgJy0tZGV0YWNoJ10pO1xuICB9XG5cbiAgLyoqIEluc3RhbGxzIGFsbCBZYXJuIGRlcGVuZGVuY2llcyBpbiB0aGUgY3VycmVudCBicmFuY2guICovXG4gIHByb3RlY3RlZCBhc3luYyBpbnN0YWxsRGVwZW5kZW5jaWVzRm9yQ3VycmVudEJyYW5jaCgpIHtcbiAgICBjb25zdCBub2RlTW9kdWxlc0RpciA9IGpvaW4odGhpcy5wcm9qZWN0RGlyLCAnbm9kZV9tb2R1bGVzJyk7XG4gICAgLy8gTm90ZTogV2UgZGVsZXRlIGFsbCBjb250ZW50cyBvZiB0aGUgYG5vZGVfbW9kdWxlc2AgZmlyc3QuIFRoaXMgaXMgbmVjZXNzYXJ5XG4gICAgLy8gYmVjYXVzZSBZYXJuIGNvdWxkIHByZXNlcnZlIGV4dHJhbmVvdXMvb3V0ZGF0ZWQgbmVzdGVkIG1vZHVsZXMgdGhhdCB3aWxsIGNhdXNlXG4gICAgLy8gdW5leHBlY3RlZCBidWlsZCBmYWlsdXJlcyB3aXRoIHRoZSBOb2RlSlMgQmF6ZWwgYEBucG1gIHdvcmtzcGFjZSBnZW5lcmF0aW9uLlxuICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvcjogaHR0cHM6Ly9naXRodWIuY29tL3lhcm5wa2cveWFybi9pc3N1ZXMvODE0Ni4gRXZlbiB0aG91Z2hcbiAgICAvLyB3ZSBtaWdodCBiZSBhYmxlIHRvIGZpeCB0aGlzIHdpdGggWWFybiAyKywgaXQgaXMgcmVhc29uYWJsZSBlbnN1cmluZyBjbGVhbiBub2RlIG1vZHVsZXMuXG4gICAgLy8gVE9ETzogUmVtb3ZlIHRoaXMgd2hlbiB3ZSB1c2UgWWFybiAyKyBpbiBhbGwgQW5ndWxhciByZXBvc2l0b3JpZXMuXG4gICAgYXdhaXQgZnMucm0obm9kZU1vZHVsZXNEaXIsIHtmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzfSk7XG4gICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VZYXJuSW5zdGFsbCh0aGlzLnByb2plY3REaXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBjb21taXQgZm9yIHRoZSBzcGVjaWZpZWQgZmlsZXMgd2l0aCB0aGUgZ2l2ZW4gbWVzc2FnZS5cbiAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSBmb3IgdGhlIGNyZWF0ZWQgY29tbWl0XG4gICAqIEBwYXJhbSBmaWxlcyBMaXN0IG9mIHByb2plY3QtcmVsYXRpdmUgZmlsZSBwYXRocyB0byBiZSBjb21taXR0ZWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgY3JlYXRlQ29tbWl0KG1lc3NhZ2U6IHN0cmluZywgZmlsZXM6IHN0cmluZ1tdKSB7XG4gICAgLy8gTm90ZTogYGdpdCBhZGRgIHdvdWxkIG5vdCBiZSBuZWVkZWQgaWYgdGhlIGZpbGVzIGFyZSBhbHJlYWR5IGtub3duIHRvXG4gICAgLy8gR2l0LCBidXQgdGhlIHNwZWNpZmllZCBmaWxlcyBjb3VsZCBhbHNvIGJlIG5ld2x5IGNyZWF0ZWQsIGFuZCB1bmtub3duLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ2FkZCcsIC4uLmZpbGVzXSk7XG4gICAgLy8gTm90ZTogYC0tbm8tdmVyaWZ5YCBza2lwcyB0aGUgbWFqb3JpdHkgb2YgY29tbWl0IGhvb2tzIGhlcmUsIGJ1dCB0aGVyZSBhcmUgaG9va3NcbiAgICAvLyBsaWtlIGBwcmVwYXJlLWNvbW1pdC1tZXNzYWdlYCB3aGljaCBzdGlsbCBydW4uIFdlIGhhdmUgc2V0IHRoZSBgSFVTS1k9MGAgZW52aXJvbm1lbnRcbiAgICAvLyB2YXJpYWJsZSBhdCB0aGUgc3RhcnQgb2YgdGhlIHB1Ymxpc2ggY29tbWFuZCB0byBpZ25vcmUgc3VjaCBob29rcyBhcyB3ZWxsLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ2NvbW1pdCcsICctcScsICctLW5vLXZlcmlmeScsICctbScsIG1lc3NhZ2UsIC4uLmZpbGVzXSk7XG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCBmb3IgdGhlIGN1cnJlbnQgYnJhbmNoLiBBc3N1bWVzIHRoZSBub2RlIG1vZHVsZXNcbiAgICogdG8gYmUgYWxyZWFkeSBpbnN0YWxsZWQgZm9yIHRoZSBjdXJyZW50IGJyYW5jaC5cbiAgICpcbiAgICogQHJldHVybnMgQSBsaXN0IG9mIGJ1aWx0IHJlbGVhc2UgcGFja2FnZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgYnVpbGRSZWxlYXNlRm9yQ3VycmVudEJyYW5jaCgpOiBQcm9taXNlPEJ1aWx0UGFja2FnZVdpdGhJbmZvW10+IHtcbiAgICAvLyBOb3RlIHRoYXQgd2UgZG8gbm90IGRpcmVjdGx5IGNhbGwgdGhlIGJ1aWxkIHBhY2thZ2VzIGZ1bmN0aW9uIGZyb20gdGhlIHJlbGVhc2VcbiAgICAvLyBjb25maWcuIFdlIG9ubHkgd2FudCB0byBidWlsZCBhbmQgcHVibGlzaCBwYWNrYWdlcyB0aGF0IGhhdmUgYmVlbiBjb25maWd1cmVkIGluIHRoZSBnaXZlblxuICAgIC8vIHB1Ymxpc2ggYnJhbmNoLiBlLmcuIGNvbnNpZGVyIHdlIHB1Ymxpc2ggcGF0Y2ggdmVyc2lvbiBhbmQgYSBuZXcgcGFja2FnZSBoYXMgYmVlblxuICAgIC8vIGNyZWF0ZWQgaW4gdGhlIGBuZXh0YCBicmFuY2guIFRoZSBuZXcgcGFja2FnZSB3b3VsZCBub3QgYmUgcGFydCBvZiB0aGUgcGF0Y2ggYnJhbmNoLFxuICAgIC8vIHNvIHdlIGNhbm5vdCBidWlsZCBhbmQgcHVibGlzaCBpdC5cbiAgICBjb25zdCBidWlsdFBhY2thZ2VzID0gYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlQnVpbGQodGhpcy5wcm9qZWN0RGlyKTtcbiAgICBjb25zdCByZWxlYXNlSW5mbyA9IGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlUmVsZWFzZUluZm8odGhpcy5wcm9qZWN0RGlyKTtcblxuICAgIC8vIEV4dGVuZCB0aGUgYnVpbHQgcGFja2FnZXMgd2l0aCB0aGVpciBkaXNrIGhhc2ggYW5kIE5QTSBwYWNrYWdlIGluZm9ybWF0aW9uLiBUaGlzIGlzXG4gICAgLy8gaGVscGZ1bCBsYXRlciBmb3IgdmVyaWZ5aW5nIGludGVncml0eSBhbmQgZmlsdGVyaW5nIG91dCBlLmcuIGV4cGVyaW1lbnRhbCBwYWNrYWdlcy5cbiAgICByZXR1cm4gYW5hbHl6ZUFuZEV4dGVuZEJ1aWx0UGFja2FnZXNXaXRoSW5mbyhidWlsdFBhY2thZ2VzLCByZWxlYXNlSW5mby5ucG1QYWNrYWdlcyk7XG4gIH1cblxuICAvKipcbiAgICogU3RhZ2VzIHRoZSBzcGVjaWZpZWQgbmV3IHZlcnNpb24gZm9yIHRoZSBjdXJyZW50IGJyYW5jaCwgYnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCxcbiAgICogdmVyaWZpZXMgaXRzIG91dHB1dCBhbmQgY3JlYXRlcyBhIHB1bGwgcmVxdWVzdCAgdGhhdCB0YXJnZXRzIHRoZSBnaXZlbiBiYXNlIGJyYW5jaC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgYXNzdW1lcyB0aGUgc3RhZ2luZyBicmFuY2ggaXMgYWxyZWFkeSBjaGVja2VkLW91dC5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IHZlcnNpb24gdG8gYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgVmVyc2lvbiB1c2VkIGZvciBjb21wYXJpbmcgd2l0aCB0aGUgY3VycmVudFxuICAgKiAgIGBIRUFEYCBpbiBvcmRlciBidWlsZCB0aGUgcmVsZWFzZSBub3Rlcy5cbiAgICogQHBhcmFtIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoIEJyYW5jaCB0aGUgcHVsbCByZXF1ZXN0IHNob3VsZCB0YXJnZXQuXG4gICAqIEBwYXJhbSBvcHRzIE5vbi1tYW5kYXRvcnkgb3B0aW9ucyBmb3IgY29udHJvbGxpbmcgdGhlIHN0YWdpbmcsIGUuZy5cbiAgICogICBhbGxvd2luZyBmb3IgYWRkaXRpb25hbCBgcGFja2FnZS5qc29uYCBtb2RpZmljYXRpb25zLlxuICAgKiBAcmV0dXJucyBhbiBvYmplY3QgY2FwdHVyaW5nIGFjdGlvbnMgcGVyZm9ybWVkIGFzIHBhcnQgb2Ygc3RhZ2luZy5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBzdGFnZVZlcnNpb25Gb3JCcmFuY2hBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzOiBzZW12ZXIuU2VtVmVyLFxuICAgIHB1bGxSZXF1ZXN0VGFyZ2V0QnJhbmNoOiBzdHJpbmcsXG4gICAgb3B0cz86IFN0YWdpbmdPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICByZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcztcbiAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3Q7XG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdO1xuICB9PiB7XG4gICAgY29uc3QgcmVsZWFzZU5vdGVzQ29tcGFyZVRhZyA9IGdldFJlbGVhc2VUYWdGb3JWZXJzaW9uKGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzKTtcblxuICAgIC8vIEZldGNoIHRoZSBjb21wYXJlIHRhZyBzbyB0aGF0IGNvbW1pdHMgZm9yIHRoZSByZWxlYXNlIG5vdGVzIGNhbiBiZSBkZXRlcm1pbmVkLlxuICAgIC8vIFdlIGZvcmNpYmx5IG92ZXJyaWRlIGV4aXN0aW5nIGxvY2FsIHRhZ3MgdGhhdCBhcmUgbmFtZWQgc2ltaWxhciBhcyB3ZSB3aWxsIGZldGNoXG4gICAgLy8gdGhlIGNvcnJlY3QgdGFnIGZvciByZWxlYXNlIG5vdGVzIGNvbXBhcmlzb24gZnJvbSB0aGUgdXBzdHJlYW0gcmVtb3RlLlxuICAgIHRoaXMuZ2l0LnJ1bihbXG4gICAgICAnZmV0Y2gnLFxuICAgICAgJy0tZm9yY2UnLFxuICAgICAgdGhpcy5naXQuZ2V0UmVwb0dpdFVybCgpLFxuICAgICAgYHJlZnMvdGFncy8ke3JlbGVhc2VOb3Rlc0NvbXBhcmVUYWd9OnJlZnMvdGFncy8ke3JlbGVhc2VOb3Rlc0NvbXBhcmVUYWd9YCxcbiAgICBdKTtcblxuICAgIC8vIEJ1aWxkIHJlbGVhc2Ugbm90ZXMgZm9yIGNvbW1pdHMgZnJvbSBgPHJlbGVhc2VOb3Rlc0NvbXBhcmVUYWc+Li5IRUFEYC5cbiAgICBjb25zdCByZWxlYXNlTm90ZXMgPSBhd2FpdCBSZWxlYXNlTm90ZXMuZm9yUmFuZ2UoXG4gICAgICB0aGlzLmdpdCxcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgICByZWxlYXNlTm90ZXNDb21wYXJlVGFnLFxuICAgICAgJ0hFQUQnLFxuICAgICk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3RWZXJzaW9uKG5ld1ZlcnNpb24sIG9wdHM/LnVwZGF0ZVBrZ0pzb25Gbik7XG4gICAgYXdhaXQgdGhpcy5wcmVwZW5kUmVsZWFzZU5vdGVzVG9DaGFuZ2Vsb2cocmVsZWFzZU5vdGVzKTtcbiAgICBhd2FpdCB0aGlzLndhaXRGb3JFZGl0c0FuZENyZWF0ZVJlbGVhc2VDb21taXQobmV3VmVyc2lvbik7XG5cbiAgICAvLyBJbnN0YWxsIHRoZSBwcm9qZWN0IGRlcGVuZGVuY2llcyBmb3IgdGhlIHB1Ymxpc2ggYnJhbmNoLlxuICAgIGF3YWl0IHRoaXMuaW5zdGFsbERlcGVuZGVuY2llc0ZvckN1cnJlbnRCcmFuY2goKTtcblxuICAgIGNvbnN0IGJ1aWx0UGFja2FnZXNXaXRoSW5mbyA9IGF3YWl0IHRoaXMuYnVpbGRSZWxlYXNlRm9yQ3VycmVudEJyYW5jaCgpO1xuXG4gICAgLy8gUnVuIHJlbGVhc2UgcHJlLWNoZWNrcyAoZS5nLiB2YWxpZGF0aW5nIHRoZSByZWxlYXNlIG91dHB1dCkuXG4gICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VSZWxlYXNlUHJlY2hlY2soXG4gICAgICB0aGlzLnByb2plY3REaXIsXG4gICAgICBuZXdWZXJzaW9uLFxuICAgICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvLFxuICAgICk7XG5cbiAgICAvLyBWZXJpZnkgdGhlIHBhY2thZ2VzIGJ1aWx0IGFyZSB0aGUgY29ycmVjdCB2ZXJzaW9uLlxuICAgIGF3YWl0IHRoaXMuX3ZlcmlmeVBhY2thZ2VWZXJzaW9ucyhyZWxlYXNlTm90ZXMudmVyc2lvbiwgYnVpbHRQYWNrYWdlc1dpdGhJbmZvKTtcblxuICAgIGNvbnN0IHB1bGxSZXF1ZXN0ID0gYXdhaXQgdGhpcy5wdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgcHVsbFJlcXVlc3RUYXJnZXRCcmFuY2gsXG4gICAgICBgcmVsZWFzZS1zdGFnZS0ke25ld1ZlcnNpb259YCxcbiAgICAgIGBCdW1wIHZlcnNpb24gdG8gXCJ2JHtuZXdWZXJzaW9ufVwiIHdpdGggY2hhbmdlbG9nLmAsXG4gICAgKTtcblxuICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIFJlbGVhc2Ugc3RhZ2luZyBwdWxsIHJlcXVlc3QgaGFzIGJlZW4gY3JlYXRlZC4nKSk7XG5cbiAgICByZXR1cm4ge3JlbGVhc2VOb3RlcywgcHVsbFJlcXVlc3QsIGJ1aWx0UGFja2FnZXNXaXRoSW5mb307XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIG91dCB0aGUgc3BlY2lmaWVkIHRhcmdldCBicmFuY2gsIHZlcmlmaWVzIGl0cyBDSSBzdGF0dXMgYW5kIHN0YWdlc1xuICAgKiB0aGUgc3BlY2lmaWVkIG5ldyB2ZXJzaW9uIGluIG9yZGVyIHRvIGNyZWF0ZSBhIHB1bGwgcmVxdWVzdC5cbiAgICpcbiAgICogQHBhcmFtIG5ld1ZlcnNpb24gTmV3IHZlcnNpb24gdG8gYmUgc3RhZ2VkLlxuICAgKiBAcGFyYW0gY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgVmVyc2lvbiB1c2VkIGZvciBjb21wYXJpbmcgd2l0aCBgSEVBRGAgb2ZcbiAgICogICB0aGUgc3RhZ2luZyBicmFuY2ggaW4gb3JkZXIgYnVpbGQgdGhlIHJlbGVhc2Ugbm90ZXMuXG4gICAqIEBwYXJhbSBzdGFnaW5nQnJhbmNoIEJyYW5jaCB3aXRoaW4gdGhlIG5ldyB2ZXJzaW9uIHNob3VsZCBiZSBzdGFnZWQuXG4gICAqIEBwYXJhbSBzdGFnaW5nT3B0aW9ucyBOb24tbWFuZGF0b3J5IG9wdGlvbnMgZm9yIGNvbnRyb2xsaW5nIHRoZSBzdGFnaW5nIG9mXG4gICAqICAgdGhlIG5ldyB2ZXJzaW9uLiBlLmcuIGFsbG93aW5nIGZvciBhZGRpdGlvbmFsIGBwYWNrYWdlLmpzb25gIG1vZGlmaWNhdGlvbnMuXG4gICAqIEByZXR1cm5zIGFuIG9iamVjdCBjYXB0dXJpbmcgYWN0aW9ucyBwZXJmb3JtZWQgYXMgcGFydCBvZiBzdGFnaW5nLlxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGNoZWNrb3V0QnJhbmNoQW5kU3RhZ2VWZXJzaW9uKFxuICAgIG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXM6IHNlbXZlci5TZW1WZXIsXG4gICAgc3RhZ2luZ0JyYW5jaDogc3RyaW5nLFxuICAgIHN0YWdpbmdPcHRzPzogU3RhZ2luZ09wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIHJlbGVhc2VOb3RlczogUmVsZWFzZU5vdGVzO1xuICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdDtcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW107XG4gICAgYmVmb3JlU3RhZ2luZ1NoYTogc3RyaW5nO1xuICB9PiB7XG4gICAgLy8gS2VlcCB0cmFjayBvZiB0aGUgY29tbWl0IHdoZXJlIHdlIHN0YXJ0ZWQgdGhlIHN0YWdpbmcgcHJvY2VzcyBvbi4gVGhpcyB3aWxsIGJlIHVzZWRcbiAgICAvLyBsYXRlciB0byBlbnN1cmUgdGhhdCBubyBjaGFuZ2VzLCBleGNlcHQgZm9yIHRoZSB2ZXJzaW9uIGJ1bXAgaGF2ZSBsYW5kZWQgYXMgcGFydFxuICAgIC8vIG9mIHRoZSBzdGFnaW5nIHRpbWUgd2luZG93ICh3aGVyZSB0aGUgY2FyZXRha2VyIGNvdWxkIGFjY2lkZW50YWxseSBsYW5kIG90aGVyIHN0dWZmKS5cbiAgICBjb25zdCBiZWZvcmVTdGFnaW5nU2hhID0gYXdhaXQgdGhpcy5nZXRMYXRlc3RDb21taXRPZkJyYW5jaChzdGFnaW5nQnJhbmNoKTtcblxuICAgIGF3YWl0IHRoaXMuYXNzZXJ0UGFzc2luZ0dpdGh1YlN0YXR1cyhiZWZvcmVTdGFnaW5nU2hhLCBzdGFnaW5nQnJhbmNoKTtcbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2goc3RhZ2luZ0JyYW5jaCk7XG5cbiAgICBjb25zdCBzdGFnaW5nSW5mbyA9IGF3YWl0IHRoaXMuc3RhZ2VWZXJzaW9uRm9yQnJhbmNoQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgICBuZXdWZXJzaW9uLFxuICAgICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMsXG4gICAgICBzdGFnaW5nQnJhbmNoLFxuICAgICAgc3RhZ2luZ09wdHMsXG4gICAgKTtcblxuICAgIHJldHVybiB7XG4gICAgICAuLi5zdGFnaW5nSW5mbyxcbiAgICAgIGJlZm9yZVN0YWdpbmdTaGEsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVycnktcGlja3MgdGhlIHJlbGVhc2Ugbm90ZXMgb2YgYSB2ZXJzaW9uIHRoYXQgaGF2ZSBiZWVuIHB1c2hlZCB0byBhIGdpdmVuIGJyYW5jaFxuICAgKiBpbnRvIHRoZSBgbmV4dGAgcHJpbWFyeSBkZXZlbG9wbWVudCBicmFuY2guIEEgcHVsbCByZXF1ZXN0IGlzIGNyZWF0ZWQgZm9yIHRoaXMuXG4gICAqIEByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3NmdWwgY3JlYXRpb24gb2YgdGhlIGNoZXJyeS1waWNrIHB1bGwgcmVxdWVzdC5cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBjaGVycnlQaWNrQ2hhbmdlbG9nSW50b05leHRCcmFuY2goXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgc3RhZ2luZ0JyYW5jaDogc3RyaW5nLFxuICApOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBuZXh0QnJhbmNoID0gdGhpcy5hY3RpdmUubmV4dC5icmFuY2hOYW1lO1xuICAgIGNvbnN0IGNvbW1pdE1lc3NhZ2UgPSBnZXRSZWxlYXNlTm90ZUNoZXJyeVBpY2tDb21taXRNZXNzYWdlKHJlbGVhc2VOb3Rlcy52ZXJzaW9uKTtcblxuICAgIC8vIENoZWNrb3V0IHRoZSBuZXh0IGJyYW5jaC5cbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2gobmV4dEJyYW5jaCk7XG5cbiAgICBhd2FpdCB0aGlzLnByZXBlbmRSZWxlYXNlTm90ZXNUb0NoYW5nZWxvZyhyZWxlYXNlTm90ZXMpO1xuXG4gICAgLy8gQ3JlYXRlIGEgY2hhbmdlbG9nIGNoZXJyeS1waWNrIGNvbW1pdC5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbW1pdChjb21taXRNZXNzYWdlLCBbd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoXSk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgQ3JlYXRlZCBjaGFuZ2Vsb2cgY2hlcnJ5LXBpY2sgY29tbWl0IGZvcjogXCIke3JlbGVhc2VOb3Rlcy52ZXJzaW9ufVwiLmApKTtcblxuICAgIC8vIENyZWF0ZSBhIGNoZXJyeS1waWNrIHB1bGwgcmVxdWVzdCB0aGF0IHNob3VsZCBiZSBtZXJnZWQgYnkgdGhlIGNhcmV0YWtlci5cbiAgICBjb25zdCBwdWxsUmVxdWVzdCA9IGF3YWl0IHRoaXMucHVzaENoYW5nZXNUb0ZvcmtBbmRDcmVhdGVQdWxsUmVxdWVzdChcbiAgICAgIG5leHRCcmFuY2gsXG4gICAgICBgY2hhbmdlbG9nLWNoZXJyeS1waWNrLSR7cmVsZWFzZU5vdGVzLnZlcnNpb259YCxcbiAgICAgIGNvbW1pdE1lc3NhZ2UsXG4gICAgICBgQ2hlcnJ5LXBpY2tzIHRoZSBjaGFuZ2Vsb2cgZnJvbSB0aGUgXCIke3N0YWdpbmdCcmFuY2h9XCIgYnJhbmNoIHRvIHRoZSBuZXh0IGAgK1xuICAgICAgICBgYnJhbmNoICgke25leHRCcmFuY2h9KS5gLFxuICAgICk7XG5cbiAgICBMb2cuaW5mbyhcbiAgICAgIGdyZWVuKFxuICAgICAgICBgICDinJMgICBQdWxsIHJlcXVlc3QgZm9yIGNoZXJyeS1waWNraW5nIHRoZSBjaGFuZ2Vsb2cgaW50byBcIiR7bmV4dEJyYW5jaH1cIiBgICtcbiAgICAgICAgICAnaGFzIGJlZW4gY3JlYXRlZC4nLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgYXdhaXQgdGhpcy5wcm9tcHRBbmRXYWl0Rm9yUHVsbFJlcXVlc3RNZXJnZWQocHVsbFJlcXVlc3QpO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKiogUHJvbXB0cyB0aGUgdXNlciBmb3IgbWVyZ2luZyB0aGUgcHVsbCByZXF1ZXN0LCBhbmQgd2FpdHMgZm9yIGl0IHRvIGJlIG1lcmdlZC4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIHByb21wdEFuZFdhaXRGb3JQdWxsUmVxdWVzdE1lcmdlZChwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBwcm9tcHRUb0luaXRpYXRlUHVsbFJlcXVlc3RNZXJnZSh0aGlzLmdpdCwgcHVsbFJlcXVlc3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBHaXRodWIgcmVsZWFzZSBmb3IgdGhlIHNwZWNpZmllZCB2ZXJzaW9uLiBUaGUgcmVsZWFzZSBpcyBjcmVhdGVkXG4gICAqIGJ5IHRhZ2dpbmcgdGhlIHZlcnNpb24gYnVtcCBjb21taXQsIGFuZCBieSBjcmVhdGluZyB0aGUgcmVsZWFzZSBlbnRyeS5cbiAgICpcbiAgICogRXhwZWN0cyB0aGUgdmVyc2lvbiBidW1wIGNvbW1pdCBhbmQgY2hhbmdlbG9nIHRvIGJlIGF2YWlsYWJsZSBpbiB0aGVcbiAgICogdXBzdHJlYW0gcmVtb3RlLlxuICAgKlxuICAgKiBAcGFyYW0gcmVsZWFzZU5vdGVzIFRoZSByZWxlYXNlIG5vdGVzIGZvciB0aGUgdmVyc2lvbiBiZWluZyBwdWJsaXNoZWQuXG4gICAqIEBwYXJhbSB2ZXJzaW9uQnVtcENvbW1pdFNoYSBDb21taXQgdGhhdCBidW1wZWQgdGhlIHZlcnNpb24uIFRoZSByZWxlYXNlIHRhZ1xuICAgKiAgIHdpbGwgcG9pbnQgdG8gdGhpcyBjb21taXQuXG4gICAqIEBwYXJhbSBpc1ByZXJlbGVhc2UgV2hldGhlciB0aGUgbmV3IHZlcnNpb24gaXMgcHVibGlzaGVkIGFzIGEgcHJlLXJlbGVhc2UuXG4gICAqIEBwYXJhbSBzaG93QXNMYXRlc3RPbkdpdEh1YiBXaGV0aGVyIHRoZSB2ZXJzaW9uIHJlbGVhc2VkIHdpbGwgcmVwcmVzZW50XG4gICAqICAgdGhlIFwibGF0ZXN0XCIgdmVyc2lvbiBvZiB0aGUgcHJvamVjdC4gSS5lLiBHaXRIdWIgd2lsbCBzaG93IHRoaXMgdmVyc2lvbiBhcyBcImxhdGVzdFwiLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfY3JlYXRlR2l0aHViUmVsZWFzZUZvclZlcnNpb24oXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgdmVyc2lvbkJ1bXBDb21taXRTaGE6IHN0cmluZyxcbiAgICBpc1ByZXJlbGVhc2U6IGJvb2xlYW4sXG4gICAgc2hvd0FzTGF0ZXN0T25HaXRIdWI6IGJvb2xlYW4sXG4gICkge1xuICAgIGNvbnN0IHRhZ05hbWUgPSBnZXRSZWxlYXNlVGFnRm9yVmVyc2lvbihyZWxlYXNlTm90ZXMudmVyc2lvbik7XG4gICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLmdpdC5jcmVhdGVSZWYoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgcmVmOiBgcmVmcy90YWdzLyR7dGFnTmFtZX1gLFxuICAgICAgc2hhOiB2ZXJzaW9uQnVtcENvbW1pdFNoYSxcbiAgICB9KTtcbiAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBUYWdnZWQgdiR7cmVsZWFzZU5vdGVzLnZlcnNpb259IHJlbGVhc2UgdXBzdHJlYW0uYCkpO1xuXG4gICAgbGV0IHJlbGVhc2VCb2R5ID0gYXdhaXQgcmVsZWFzZU5vdGVzLmdldEdpdGh1YlJlbGVhc2VFbnRyeSgpO1xuXG4gICAgLy8gSWYgdGhlIHJlbGVhc2UgYm9keSBleGNlZWRzIHRoZSBHaXRodWIgYm9keSBsaW1pdCwgd2UganVzdCBwcm92aWRlXG4gICAgLy8gYSBsaW5rIHRvIHRoZSBjaGFuZ2Vsb2cgZW50cnkgaW4gdGhlIEdpdGh1YiByZWxlYXNlIGVudHJ5LlxuICAgIGlmIChyZWxlYXNlQm9keS5sZW5ndGggPiBnaXRodWJSZWxlYXNlQm9keUxpbWl0KSB7XG4gICAgICBjb25zdCByZWxlYXNlTm90ZXNVcmwgPSBhd2FpdCB0aGlzLl9nZXRHaXRodWJDaGFuZ2Vsb2dVcmxGb3JSZWYocmVsZWFzZU5vdGVzLCB0YWdOYW1lKTtcbiAgICAgIHJlbGVhc2VCb2R5ID1cbiAgICAgICAgYFJlbGVhc2Ugbm90ZXMgYXJlIHRvbyBsYXJnZSB0byBiZSBjYXB0dXJlZCBoZXJlLiBgICtcbiAgICAgICAgYFtWaWV3IGFsbCBjaGFuZ2VzIGhlcmVdKCR7cmVsZWFzZU5vdGVzVXJsfSkuYDtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuY3JlYXRlUmVsZWFzZSh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBuYW1lOiBgdiR7cmVsZWFzZU5vdGVzLnZlcnNpb259YCxcbiAgICAgIHRhZ19uYW1lOiB0YWdOYW1lLFxuICAgICAgcHJlcmVsZWFzZTogaXNQcmVyZWxlYXNlLFxuICAgICAgbWFrZV9sYXRlc3Q6IHNob3dBc0xhdGVzdE9uR2l0SHViID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgIGJvZHk6IHJlbGVhc2VCb2R5LFxuICAgIH0pO1xuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIENyZWF0ZWQgdiR7cmVsZWFzZU5vdGVzLnZlcnNpb259IHJlbGVhc2UgaW4gR2l0aHViLmApKTtcbiAgfVxuXG4gIC8qKiBHZXRzIGEgR2l0aHViIFVSTCB0aGF0IHJlc29sdmVzIHRvIHRoZSByZWxlYXNlIG5vdGVzIGluIHRoZSBnaXZlbiByZWYuICovXG4gIHByaXZhdGUgYXN5bmMgX2dldEdpdGh1YkNoYW5nZWxvZ1VybEZvclJlZihyZWxlYXNlTm90ZXM6IFJlbGVhc2VOb3RlcywgcmVmOiBzdHJpbmcpIHtcbiAgICBjb25zdCBiYXNlVXJsID0gZ2V0RmlsZUNvbnRlbnRzVXJsKHRoaXMuZ2l0LCByZWYsIHdvcmtzcGFjZVJlbGF0aXZlQ2hhbmdlbG9nUGF0aCk7XG4gICAgY29uc3QgdXJsRnJhZ21lbnQgPSBhd2FpdCByZWxlYXNlTm90ZXMuZ2V0VXJsRnJhZ21lbnRGb3JSZWxlYXNlKCk7XG4gICAgcmV0dXJuIGAke2Jhc2VVcmx9IyR7dXJsRnJhZ21lbnR9YDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdWJsaXNoZXMgdGhlIGdpdmVuIHBhY2thZ2VzIHRvIHRoZSByZWdpc3RyeSBhbmQgbWFrZXMgdGhlIHJlbGVhc2VzXG4gICAqIGF2YWlsYWJsZSBvbiBHaXRIdWIuXG4gICAqXG4gICAqIEBwYXJhbSBidWlsdFBhY2thZ2VzV2l0aEluZm8gTGlzdCBvZiBidWlsdCBwYWNrYWdlcyB0aGF0IHdpbGwgYmUgcHVibGlzaGVkLlxuICAgKiBAcGFyYW0gcmVsZWFzZU5vdGVzIFRoZSByZWxlYXNlIG5vdGVzIGZvciB0aGUgdmVyc2lvbiBiZWluZyBwdWJsaXNoZWQuXG4gICAqIEBwYXJhbSBiZWZvcmVTdGFnaW5nU2hhIENvbW1pdCBTSEEgdGhhdCBpcyBleHBlY3RlZCB0byBiZSB0aGUgbW9zdCByZWNlbnQgb25lIGFmdGVyXG4gICAqICAgdGhlIGFjdHVhbCB2ZXJzaW9uIGJ1bXAgY29tbWl0LiBUaGlzIGV4aXN0cyB0byBlbnN1cmUgdGhhdCBjYXJldGFrZXJzIGRvIG5vdCBsYW5kXG4gICAqICAgYWRkaXRpb25hbCBjaGFuZ2VzIGFmdGVyIHRoZSByZWxlYXNlIG91dHB1dCBoYXMgYmVlbiBidWlsdCBsb2NhbGx5LlxuICAgKiBAcGFyYW0gcHVibGlzaEJyYW5jaCBOYW1lIG9mIHRoZSBicmFuY2ggdGhhdCBjb250YWlucyB0aGUgbmV3IHZlcnNpb24uXG4gICAqIEBwYXJhbSBucG1EaXN0VGFnIE5QTSBkaXN0IHRhZyB3aGVyZSB0aGUgdmVyc2lvbiBzaG91bGQgYmUgcHVibGlzaGVkIHRvLlxuICAgKiBAcGFyYW0gYWRkaXRpb25hbE9wdGlvbnMgQWRkaXRpb25hbCBvcHRpb25zIG5lZWRlZCBmb3IgcHVibGlzaGluZyBhIHJlbGVhc2UuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgcHVibGlzaChcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW10sXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgYmVmb3JlU3RhZ2luZ1NoYTogc3RyaW5nLFxuICAgIHB1Ymxpc2hCcmFuY2g6IHN0cmluZyxcbiAgICBucG1EaXN0VGFnOiBOcG1EaXN0VGFnLFxuICAgIGFkZGl0aW9uYWxPcHRpb25zOiB7c2hvd0FzTGF0ZXN0T25HaXRIdWI6IGJvb2xlYW59LFxuICApIHtcbiAgICBjb25zdCB2ZXJzaW9uQnVtcENvbW1pdFNoYSA9IGF3YWl0IHRoaXMuZ2V0TGF0ZXN0Q29tbWl0T2ZCcmFuY2gocHVibGlzaEJyYW5jaCk7XG5cbiAgICAvLyBFbnN1cmUgdGhlIGxhdGVzdCBjb21taXQgaW4gdGhlIHB1Ymxpc2ggYnJhbmNoIGlzIHRoZSBidW1wIGNvbW1pdC5cbiAgICBpZiAoIShhd2FpdCB0aGlzLl9pc0NvbW1pdEZvclZlcnNpb25TdGFnaW5nKHJlbGVhc2VOb3Rlcy52ZXJzaW9uLCB2ZXJzaW9uQnVtcENvbW1pdFNoYSkpKSB7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgTGF0ZXN0IGNvbW1pdCBpbiBcIiR7cHVibGlzaEJyYW5jaH1cIiBicmFuY2ggaXMgbm90IGEgc3RhZ2luZyBjb21taXQuYCk7XG4gICAgICBMb2cuZXJyb3IoJyAgICAgIFBsZWFzZSBtYWtlIHN1cmUgdGhlIHN0YWdpbmcgcHVsbCByZXF1ZXN0IGhhcyBiZWVuIG1lcmdlZC4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cblxuICAgIC8vIEVuc3VyZSBubyBjb21taXRzIGhhdmUgbGFuZGVkIHNpbmNlIHdlIHN0YXJ0ZWQgdGhlIHN0YWdpbmcgcHJvY2Vzcy4gVGhpcyB3b3VsZCBzaWduaWZ5XG4gICAgLy8gdGhhdCB0aGUgbG9jYWxseS1idWlsdCByZWxlYXNlIHBhY2thZ2VzIGFyZSBub3QgbWF0Y2hpbmcgd2l0aCB0aGUgcmVsZWFzZSBjb21taXQgb24gR2l0SHViLlxuICAgIC8vIE5vdGU6IFdlIGV4cGVjdCB0aGUgdmVyc2lvbiBidW1wIGNvbW1pdCB0byBiZSBhaGVhZCBieSAqKm9uZSoqIGNvbW1pdC4gVGhpcyBtZWFucyBpdCdzXG4gICAgLy8gdGhlIGRpcmVjdCBwYXJlbnQgb2YgdGhlIGNvbW1pdCB0aGF0IHdhcyBsYXRlc3Qgd2hlbiB3ZSBzdGFydGVkIHRoZSBzdGFnaW5nLlxuICAgIGlmICghKGF3YWl0IHRoaXMuX2lzUmV2aXNpb25BaGVhZE9mQmFzZShiZWZvcmVTdGFnaW5nU2hhLCB2ZXJzaW9uQnVtcENvbW1pdFNoYSwgMSkpKSB7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgVW5leHBlY3RlZCBhZGRpdGlvbmFsIGNvbW1pdHMgaGF2ZSBsYW5kZWQgd2hpbGUgc3RhZ2luZyB0aGUgcmVsZWFzZS5gKTtcbiAgICAgIExvZy5lcnJvcignICAgICAgUGxlYXNlIHJldmVydCB0aGUgYnVtcCBjb21taXQgYW5kIHJldHJ5LCBvciBjdXQgYSBuZXcgdmVyc2lvbiBvbiB0b3AuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICAvLyBCZWZvcmUgcHVibGlzaGluZywgd2Ugd2FudCB0byBlbnN1cmUgdGhhdCB0aGUgbG9jYWxseS1idWlsdCBwYWNrYWdlcyB3ZVxuICAgIC8vIGJ1aWx0IGluIHRoZSBzdGFnaW5nIHBoYXNlIGhhdmUgbm90IGJlZW4gbW9kaWZpZWQgYWNjaWRlbnRhbGx5LlxuICAgIGF3YWl0IGFzc2VydEludGVncml0eU9mQnVpbHRQYWNrYWdlcyhidWlsdFBhY2thZ2VzV2l0aEluZm8pO1xuXG4gICAgLy8gQ3JlYXRlIGEgR2l0aHViIHJlbGVhc2UgZm9yIHRoZSBuZXcgdmVyc2lvbi5cbiAgICBhd2FpdCB0aGlzLl9jcmVhdGVHaXRodWJSZWxlYXNlRm9yVmVyc2lvbihcbiAgICAgIHJlbGVhc2VOb3RlcyxcbiAgICAgIHZlcnNpb25CdW1wQ29tbWl0U2hhLFxuICAgICAgbnBtRGlzdFRhZyA9PT0gJ25leHQnLFxuICAgICAgYWRkaXRpb25hbE9wdGlvbnMuc2hvd0FzTGF0ZXN0T25HaXRIdWIsXG4gICAgKTtcblxuICAgIC8vIFdhbGsgdGhyb3VnaCBhbGwgYnVpbHQgcGFja2FnZXMgYW5kIHB1Ymxpc2ggdGhlbSB0byBOUE0uXG4gICAgZm9yIChjb25zdCBwa2cgb2YgYnVpbHRQYWNrYWdlc1dpdGhJbmZvKSB7XG4gICAgICBhd2FpdCB0aGlzLl9wdWJsaXNoQnVpbHRQYWNrYWdlVG9OcG0ocGtnLCBucG1EaXN0VGFnKTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBQdWJsaXNoZWQgYWxsIHBhY2thZ2VzIHN1Y2Nlc3NmdWxseScpKTtcbiAgfVxuXG4gIC8qKiBQdWJsaXNoZXMgdGhlIGdpdmVuIGJ1aWx0IHBhY2thZ2UgdG8gTlBNIHdpdGggdGhlIHNwZWNpZmllZCBOUE0gZGlzdCB0YWcuICovXG4gIHByaXZhdGUgYXN5bmMgX3B1Ymxpc2hCdWlsdFBhY2thZ2VUb05wbShwa2c6IEJ1aWx0UGFja2FnZSwgbnBtRGlzdFRhZzogTnBtRGlzdFRhZykge1xuICAgIExvZy5kZWJ1ZyhgU3RhcnRpbmcgcHVibGlzaCBvZiBcIiR7cGtnLm5hbWV9XCIuYCk7XG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKGBQdWJsaXNoaW5nIFwiJHtwa2cubmFtZX1cImApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IE5wbUNvbW1hbmQucHVibGlzaChwa2cub3V0cHV0UGF0aCwgbnBtRGlzdFRhZywgdGhpcy5jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFN1Y2Nlc3NmdWxseSBwdWJsaXNoZWQgXCIke3BrZy5uYW1lfS5gKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHB1Ymxpc2hpbmcgXCIke3BrZy5uYW1lfVwiLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIENoZWNrcyB3aGV0aGVyIHRoZSBnaXZlbiBjb21taXQgcmVwcmVzZW50cyBhIHN0YWdpbmcgY29tbWl0IGZvciB0aGUgc3BlY2lmaWVkIHZlcnNpb24uICovXG4gIHByaXZhdGUgYXN5bmMgX2lzQ29tbWl0Rm9yVmVyc2lvblN0YWdpbmcodmVyc2lvbjogc2VtdmVyLlNlbVZlciwgY29tbWl0U2hhOiBzdHJpbmcpIHtcbiAgICBjb25zdCB7ZGF0YX0gPSBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuZ2V0Q29tbWl0KHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIHJlZjogY29tbWl0U2hhLFxuICAgIH0pO1xuICAgIHJldHVybiBkYXRhLmNvbW1pdC5tZXNzYWdlLnN0YXJ0c1dpdGgoZ2V0Q29tbWl0TWVzc2FnZUZvclJlbGVhc2UodmVyc2lvbikpO1xuICB9XG5cbiAgLy8gVE9ETzogUmVtb3ZlIHRoaXMgY2hlY2sgYW5kIHJ1biBpdCBhcyBwYXJ0IG9mIGNvbW1vbiByZWxlYXNlIHZhbGlkYXRpb24uXG4gIC8qKiBWZXJpZnkgdGhlIHZlcnNpb24gb2YgZWFjaCBnZW5lcmF0ZWQgcGFja2FnZSBleGFjdCBtYXRjaGVzIHRoZSBzcGVjaWZpZWQgdmVyc2lvbi4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfdmVyaWZ5UGFja2FnZVZlcnNpb25zKHZlcnNpb246IHNlbXZlci5TZW1WZXIsIHBhY2thZ2VzOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdKSB7XG4gICAgLy8gRXhwZXJpbWVudGFsIGVxdWl2YWxlbnQgdmVyc2lvbiBmb3IgcGFja2FnZXMuXG4gICAgY29uc3QgZXhwZXJpbWVudGFsVmVyc2lvbiA9IGNyZWF0ZUV4cGVyaW1lbnRhbFNlbXZlcih2ZXJzaW9uKTtcblxuICAgIGZvciAoY29uc3QgcGtnIG9mIHBhY2thZ2VzKSB7XG4gICAgICBjb25zdCB7dmVyc2lvbjogcGFja2FnZUpzb25WZXJzaW9ufSA9IEpTT04ucGFyc2UoXG4gICAgICAgIGF3YWl0IGZzLnJlYWRGaWxlKGpvaW4ocGtnLm91dHB1dFBhdGgsICdwYWNrYWdlLmpzb24nKSwgJ3V0ZjgnKSxcbiAgICAgICkgYXMge3ZlcnNpb246IHN0cmluZzsgW2tleTogc3RyaW5nXTogYW55fTtcblxuICAgICAgY29uc3QgZXhwZWN0ZWRWZXJzaW9uID0gcGtnLmV4cGVyaW1lbnRhbCA/IGV4cGVyaW1lbnRhbFZlcnNpb24gOiB2ZXJzaW9uO1xuICAgICAgY29uc3QgbWlzbWF0Y2hlc1ZlcnNpb24gPSBleHBlY3RlZFZlcnNpb24uY29tcGFyZShwYWNrYWdlSnNvblZlcnNpb24pICE9PSAwO1xuXG4gICAgICBpZiAobWlzbWF0Y2hlc1ZlcnNpb24pIHtcbiAgICAgICAgTG9nLmVycm9yKGBUaGUgYnVpbHQgcGFja2FnZSB2ZXJzaW9uIGRvZXMgbm90IG1hdGNoIGZvcjogJHtwa2cubmFtZX0uYCk7XG4gICAgICAgIExvZy5lcnJvcihgICBBY3R1YWwgdmVyc2lvbjogICAke3BhY2thZ2VKc29uVmVyc2lvbn1gKTtcbiAgICAgICAgTG9nLmVycm9yKGAgIEV4cGVjdGVkIHZlcnNpb246ICR7ZXhwZWN0ZWRWZXJzaW9ufWApO1xuICAgICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==