import { readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ChildProcess } from '../../utils/child-process.js';
import { Log } from '../../utils/logging.js';
import { Spinner } from '../../utils/spinner.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { getYarnPathFromNpmGlobalBinaries } from '../../utils/resolve-yarn-bin.js';
import { getRepositoryGitUrl } from '../../utils/git/github-urls.js';
async function builder(argv) {
    return addGithubTokenOption(argv);
}
const useYarnPathEnv = {
    ...process.env,
    YARN_IGNORE_PATH: '0',
};
const skipHuskyEnv = {
    ...process.env,
    HUSKY: '0',
};
async function handler() {
    const yarnGlobalBin = (await getYarnPathFromNpmGlobalBinaries()) ?? 'yarn';
    const git = await AuthenticatedGitClient.get();
    const mainBranchName = git.mainBranchName;
    const originalBranchOrRef = git.getCurrentBranchOrRevision();
    if (git.hasUncommittedChanges()) {
        Log.error('Found changes in the local repository. Make sure there are no uncommitted files.');
        process.exitCode = 1;
        return;
    }
    const spinner = new Spinner('');
    try {
        spinner.update(`Fetching the latest primary branch from upstream: "${mainBranchName}"`);
        git.run(['fetch', '-q', git.getRepoGitUrl(), mainBranchName]);
        git.checkout('FETCH_HEAD', false);
        spinner.update('Removing previous yarn version.');
        const yarnReleasesDir = join(git.baseDir, '.yarn/releases');
        readdirSync(yarnReleasesDir).forEach((file) => unlinkSync(join(yarnReleasesDir, file)));
        spinner.update('Updating yarn version.');
        ChildProcess.spawnSync(yarnGlobalBin, ['policies', 'set-version', 'latest']);
        spinner.update('Confirming the version of yarn was updated.');
        const newYarnVersion = ChildProcess.spawnSync(yarnGlobalBin, ['-v'], {
            env: useYarnPathEnv,
        }).stdout.trim();
        if (git.run(['status', '--porcelain']).stdout.length === 0) {
            spinner.complete();
            Log.error('Yarn already up to date');
            process.exitCode = 0;
            return;
        }
        const title = `build: update to yarn v${newYarnVersion}`;
        const body = `Update to the latest version of yarn, ${newYarnVersion}.`;
        const commitMessage = `${title}\n\n${body}`;
        const branchName = `yarn-update-v${newYarnVersion}`;
        const userFork = await git.getForkOfAuthenticatedUser();
        const { owner: localOwner } = userFork;
        spinner.update('Staging yarn vendoring files and creating commit');
        git.run(['add', '.yarn/releases/**', '.yarnrc']);
        git.run(['commit', '-q', '--no-verify', '-m', commitMessage], { env: skipHuskyEnv });
        spinner.update('Pushing commit changes to github.');
        git.run([
            'push',
            '-q',
            getRepositoryGitUrl(userFork, git.githubToken),
            '--force-with-lease',
            `HEAD:refs/heads/${branchName}`,
        ]);
        spinner.update('Creating a PR for the changes.');
        const { number } = (await git.github.pulls.create({
            ...git.remoteParams,
            title,
            body,
            base: mainBranchName,
            head: `${localOwner}:${branchName}`,
        })).data;
        spinner.complete();
        Log.info(`Created PR #${number} to update to yarn v${newYarnVersion}`);
    }
    catch (e) {
        spinner.complete();
        Log.error('Aborted yarn update do to errors:');
        Log.error(e);
        process.exitCode = 1;
        git.checkout(originalBranchOrRef, true);
    }
    finally {
        git.checkout(originalBranchOrRef, true);
    }
}
export const UpdateYarnCommandModule = {
    builder,
    handler,
    command: 'update-yarn',
    describe: 'Automatically update the vendored yarn version in the repository and create a PR',
};
//# sourceMappingURL=cli.js.map