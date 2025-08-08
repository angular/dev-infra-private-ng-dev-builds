import { DryRunError, isDryRun } from '../dry-run.js';
import { assertValidGithubConfig, getConfig } from '../config.js';
import { spawnSync } from 'child_process';
import { Log } from '../logging.js';
import { GithubClient } from './github.js';
import { getRepositoryGitUrl } from './github-urls.js';
import { determineRepoBaseDirFromCwd } from '../repo-directory.js';
export class GitCommandError extends Error {
    constructor(client, unsanitizedArgs) {
        super(`Command failed: git ${client.sanitizeConsoleOutput(unsanitizedArgs.join(' '))}`);
    }
}
export class GitClient {
    constructor(config, baseDir = determineRepoBaseDirFromCwd()) {
        this.baseDir = baseDir;
        this.github = new GithubClient();
        this.gitBinPath = 'git';
        this.config = config;
        this.remoteConfig = config.github;
        this.remoteParams = { owner: config.github.owner, repo: config.github.name };
        this.mainBranchName = config.github.mainBranchName;
    }
    run(args, options) {
        const result = this.runGraceful(args, options);
        if (result.status !== 0) {
            throw new GitCommandError(this, args);
        }
        return result;
    }
    runGraceful(args, options = {}) {
        const gitCommand = args[0];
        if (isDryRun() && gitCommand === 'push') {
            Log.debug(`"git push" is not able to be run in dryRun mode.`);
            throw new DryRunError();
        }
        args = ['-c', 'credential.helper=', ...args];
        Log.debug('Executing: git', this.sanitizeConsoleOutput(args.join(' ')));
        const result = spawnSync(this.gitBinPath, args, {
            cwd: this.baseDir,
            stdio: 'pipe',
            ...options,
            encoding: 'utf8',
        });
        Log.debug(`Status: ${result.status}, Error: ${!!result.error}, Signal: ${result.signal}`);
        if (result.status !== 0 && result.stderr !== null) {
            process.stderr.write(this.sanitizeConsoleOutput(result.stderr));
        }
        Log.debug('Stdout:', result.stdout);
        Log.debug('Stderr:', result.stderr);
        Log.debug('Process Error:', result.error);
        if (result.error !== undefined) {
            process.stderr.write(this.sanitizeConsoleOutput(result.error.message));
        }
        return result;
    }
    getRepoGitUrl() {
        return getRepositoryGitUrl(this.remoteConfig);
    }
    hasCommit(branchName, sha) {
        return this.run(['branch', branchName, '--contains', sha]).stdout !== '';
    }
    isShallowRepo() {
        return this.run(['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true';
    }
    getCurrentBranchOrRevision() {
        const branchName = this.run(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
        if (branchName === 'HEAD') {
            return this.run(['rev-parse', 'HEAD']).stdout.trim();
        }
        return branchName;
    }
    hasUncommittedChanges() {
        this.runGraceful(['update-index', '-q', '--refresh']);
        return this.runGraceful(['diff-index', '--quiet', 'HEAD']).status !== 0;
    }
    checkout(branchOrRevision, cleanState) {
        if (cleanState) {
            this.runGraceful(['am', '--abort'], { stdio: 'ignore' });
            this.runGraceful(['cherry-pick', '--abort'], { stdio: 'ignore' });
            this.runGraceful(['rebase', '--abort'], { stdio: 'ignore' });
            this.runGraceful(['reset', '--hard'], { stdio: 'ignore' });
        }
        return this.runGraceful(['checkout', branchOrRevision], { stdio: 'ignore' }).status === 0;
    }
    allChangesFilesSince(shaOrRef = 'HEAD') {
        return Array.from(new Set([
            ...gitOutputAsArray(this.runGraceful(['diff', '--name-only', '--diff-filter=d', shaOrRef])),
            ...gitOutputAsArray(this.runGraceful(['ls-files', '--others', '--exclude-standard'])),
        ]));
    }
    allStagedFiles() {
        return gitOutputAsArray(this.runGraceful(['diff', '--name-only', '--diff-filter=ACM', '--staged']));
    }
    allFiles() {
        return gitOutputAsArray(this.runGraceful(['ls-files']));
    }
    sanitizeConsoleOutput(value) {
        return value;
    }
    static async get() {
        if (GitClient._unauthenticatedInstance === null) {
            GitClient._unauthenticatedInstance = (async () => {
                return new GitClient(await getConfig([assertValidGithubConfig]));
            })();
        }
        return GitClient._unauthenticatedInstance;
    }
}
GitClient._unauthenticatedInstance = null;
function gitOutputAsArray(gitCommandResult) {
    return gitCommandResult.stdout
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => !!x);
}
//# sourceMappingURL=git-client.js.map