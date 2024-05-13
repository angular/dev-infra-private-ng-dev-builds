/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
/** Environment object enabling the usage of yarn-path to determine the new version. */
const useYarnPathEnv = {
    ...process.env,
    YARN_IGNORE_PATH: '0',
};
/** Environment object to prevent running husky workflow. */
const skipHuskyEnv = {
    ...process.env,
    HUSKY: '0',
};
async function handler() {
    /**
     * Process command that refers to the global Yarn installation.
     *
     * Note that we intend to use the global Yarn command here as this allows us to let Yarn
     * respect the `.yarnrc` file, allowing us to check if the update has completed properly.
     * Just using `yarn` does not necessarily resolve to the global Yarn version as Yarn-initiated
     * sub-processes will have a modified `process.env.PATH` that directly points to the Yarn
     * version that spawned the sub-process.
     */
    const yarnGlobalBin = (await getYarnPathFromNpmGlobalBinaries()) ?? 'yarn';
    /** Instance of the local git client. */
    const git = await AuthenticatedGitClient.get();
    /** The main branch name of the repository. */
    const mainBranchName = git.mainBranchName;
    /** The original branch or ref before the command was invoked. */
    const originalBranchOrRef = git.getCurrentBranchOrRevision();
    if (git.hasUncommittedChanges()) {
        Log.error('Found changes in the local repository. Make sure there are no uncommitted files.');
        process.exitCode = 1;
        return;
    }
    /** A spinner instance. */
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
        /** The title for the PR. */
        const title = `build: update to yarn v${newYarnVersion}`;
        /** The body for the PR. */
        const body = `Update to the latest version of yarn, ${newYarnVersion}.`;
        /** The commit message for the change. */
        const commitMessage = `${title}\n\n${body}`;
        /** The name of the branch to use on remote. */
        const branchName = `yarn-update-v${newYarnVersion}`;
        /** The fork of the user */
        const userFork = await git.getForkOfAuthenticatedUser();
        /** The name of the owner for remote branch on Github. */
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
/** CLI command module. */
export const UpdateYarnCommandModule = {
    builder,
    handler,
    command: 'update-yarn',
    describe: 'Automatically update the vendored yarn version in the repository and create a PR',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L21pc2MvdXBkYXRlLXlhcm4vY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxXQUFXLEVBQUUsVUFBVSxFQUFDLE1BQU0sSUFBSSxDQUFDO0FBQzNDLE9BQU8sRUFBQyxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFFMUIsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBRTFELE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFDckUsT0FBTyxFQUFDLGdDQUFnQyxFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFDakYsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFbkUsS0FBSyxVQUFVLE9BQU8sQ0FBQyxJQUFVO0lBQy9CLE9BQU8sb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQUVELHVGQUF1RjtBQUN2RixNQUFNLGNBQWMsR0FBRztJQUNyQixHQUFHLE9BQU8sQ0FBQyxHQUFHO0lBQ2QsZ0JBQWdCLEVBQUUsR0FBRztDQUN0QixDQUFDO0FBRUYsNERBQTREO0FBQzVELE1BQU0sWUFBWSxHQUFHO0lBQ25CLEdBQUcsT0FBTyxDQUFDLEdBQUc7SUFDZCxLQUFLLEVBQUUsR0FBRztDQUNYLENBQUM7QUFFRixLQUFLLFVBQVUsT0FBTztJQUNwQjs7Ozs7Ozs7T0FRRztJQUNILE1BQU0sYUFBYSxHQUFHLENBQUMsTUFBTSxnQ0FBZ0MsRUFBRSxDQUFDLElBQUksTUFB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O1FBQ3JCLEdBQUcsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDMUMsQ0FBQztZQUFTLENBQUM7UUFDVCxHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzFDLENBQUM7QUFDSCxDQUFDO0FBRUQsMEJBQTBCO0FBQzFCLE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFrQjtJQUNwRCxPQUFPO0lBQ1AsT0FBTztJQUNQLE9BQU8sRUFBRSxhQUFhO0lBQ3RCLFFBQVEsRUFBRSxrRkFBa0Y7Q0FDN0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3JlYWRkaXJTeW5jLCB1bmxpbmtTeW5jfSBmcm9tICdmcyc7XG5pbXBvcnQge2pvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtBcmd2LCBDb21tYW5kTW9kdWxlfSBmcm9tICd5YXJncyc7XG5pbXBvcnQge0NoaWxkUHJvY2Vzc30gZnJvbSAnLi4vLi4vdXRpbHMvY2hpbGQtcHJvY2Vzcy5qcyc7XG5cbmltcG9ydCB7TG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHthZGRHaXRodWJUb2tlbk9wdGlvbn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi15YXJncy5qcyc7XG5pbXBvcnQge2dldFlhcm5QYXRoRnJvbU5wbUdsb2JhbEJpbmFyaWVzfSBmcm9tICcuLi8uLi91dGlscy9yZXNvbHZlLXlhcm4tYmluLmpzJztcbmltcG9ydCB7Z2V0UmVwb3NpdG9yeUdpdFVybH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi11cmxzLmpzJztcblxuYXN5bmMgZnVuY3Rpb24gYnVpbGRlcihhcmd2OiBBcmd2KSB7XG4gIHJldHVybiBhZGRHaXRodWJUb2tlbk9wdGlvbihhcmd2KTtcbn1cblxuLyoqIEVudmlyb25tZW50IG9iamVjdCBlbmFibGluZyB0aGUgdXNhZ2Ugb2YgeWFybi1wYXRoIHRvIGRldGVybWluZSB0aGUgbmV3IHZlcnNpb24uICovXG5jb25zdCB1c2VZYXJuUGF0aEVudiA9IHtcbiAgLi4ucHJvY2Vzcy5lbnYsXG4gIFlBUk5fSUdOT1JFX1BBVEg6ICcwJyxcbn07XG5cbi8qKiBFbnZpcm9ubWVudCBvYmplY3QgdG8gcHJldmVudCBydW5uaW5nIGh1c2t5IHdvcmtmbG93LiAqL1xuY29uc3Qgc2tpcEh1c2t5RW52ID0ge1xuICAuLi5wcm9jZXNzLmVudixcbiAgSFVTS1k6ICcwJyxcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoKSB7XG4gIC8qKlxuICAgKiBQcm9jZXNzIGNvbW1hbmQgdGhhdCByZWZlcnMgdG8gdGhlIGdsb2JhbCBZYXJuIGluc3RhbGxhdGlvbi5cbiAgICpcbiAgICogTm90ZSB0aGF0IHdlIGludGVuZCB0byB1c2UgdGhlIGdsb2JhbCBZYXJuIGNvbW1hbmQgaGVyZSBhcyB0aGlzIGFsbG93cyB1cyB0byBsZXQgWWFyblxuICAgKiByZXNwZWN0IHRoZSBgLnlhcm5yY2AgZmlsZSwgYWxsb3dpbmcgdXMgdG8gY2hlY2sgaWYgdGhlIHVwZGF0ZSBoYXMgY29tcGxldGVkIHByb3Blcmx5LlxuICAgKiBKdXN0IHVzaW5nIGB5YXJuYCBkb2VzIG5vdCBuZWNlc3NhcmlseSByZXNvbHZlIHRvIHRoZSBnbG9iYWwgWWFybiB2ZXJzaW9uIGFzIFlhcm4taW5pdGlhdGVkXG4gICAqIHN1Yi1wcm9jZXNzZXMgd2lsbCBoYXZlIGEgbW9kaWZpZWQgYHByb2Nlc3MuZW52LlBBVEhgIHRoYXQgZGlyZWN0bHkgcG9pbnRzIHRvIHRoZSBZYXJuXG4gICAqIHZlcnNpb24gdGhhdCBzcGF3bmVkIHRoZSBzdWItcHJvY2Vzcy5cbiAgICovXG4gIGNvbnN0IHlhcm5HbG9iYWxCaW4gPSAoYXdhaXQgZ2V0WWFyblBhdGhGcm9tTnBtR2xvYmFsQmluYXJpZXMoKSkgPz8gJ3lhcm4nO1xuICAvKiogSW5zdGFuY2Ugb2YgdGhlIGxvY2FsIGdpdCBjbGllbnQuICovXG4gIGNvbnN0IGdpdCA9IGF3YWl0IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuZ2V0KCk7XG4gIC8qKiBUaGUgbWFpbiBicmFuY2ggbmFtZSBvZiB0aGUgcmVwb3NpdG9yeS4gKi9cbiAgY29uc3QgbWFpbkJyYW5jaE5hbWUgPSBnaXQubWFpbkJyYW5jaE5hbWU7XG4gIC8qKiBUaGUgb3JpZ2luYWwgYnJhbmNoIG9yIHJlZiBiZWZvcmUgdGhlIGNvbW1hbmQgd2FzIGludm9rZWQuICovXG4gIGNvbnN0IG9yaWdpbmFsQnJhbmNoT3JSZWYgPSBnaXQuZ2V0Q3VycmVudEJyYW5jaE9yUmV2aXNpb24oKTtcblxuICBpZiAoZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgTG9nLmVycm9yKCdGb3VuZCBjaGFuZ2VzIGluIHRoZSBsb2NhbCByZXBvc2l0b3J5LiBNYWtlIHN1cmUgdGhlcmUgYXJlIG5vIHVuY29tbWl0dGVkIGZpbGVzLicpO1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8qKiBBIHNwaW5uZXIgaW5zdGFuY2UuICovXG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcignJyk7XG4gIHRyeSB7XG4gICAgc3Bpbm5lci51cGRhdGUoYEZldGNoaW5nIHRoZSBsYXRlc3QgcHJpbWFyeSBicmFuY2ggZnJvbSB1cHN0cmVhbTogXCIke21haW5CcmFuY2hOYW1lfVwiYCk7XG4gICAgZ2l0LnJ1bihbJ2ZldGNoJywgJy1xJywgZ2l0LmdldFJlcG9HaXRVcmwoKSwgbWFpbkJyYW5jaE5hbWVdKTtcbiAgICBnaXQuY2hlY2tvdXQoJ0ZFVENIX0hFQUQnLCBmYWxzZSk7XG5cbiAgICBzcGlubmVyLnVwZGF0ZSgnUmVtb3ZpbmcgcHJldmlvdXMgeWFybiB2ZXJzaW9uLicpO1xuICAgIGNvbnN0IHlhcm5SZWxlYXNlc0RpciA9IGpvaW4oZ2l0LmJhc2VEaXIsICcueWFybi9yZWxlYXNlcycpO1xuICAgIHJlYWRkaXJTeW5jKHlhcm5SZWxlYXNlc0RpcikuZm9yRWFjaCgoZmlsZSkgPT4gdW5saW5rU3luYyhqb2luKHlhcm5SZWxlYXNlc0RpciwgZmlsZSkpKTtcblxuICAgIHNwaW5uZXIudXBkYXRlKCdVcGRhdGluZyB5YXJuIHZlcnNpb24uJyk7XG4gICAgQ2hpbGRQcm9jZXNzLnNwYXduU3luYyh5YXJuR2xvYmFsQmluLCBbJ3BvbGljaWVzJywgJ3NldC12ZXJzaW9uJywgJ2xhdGVzdCddKTtcblxuICAgIHNwaW5uZXIudXBkYXRlKCdDb25maXJtaW5nIHRoZSB2ZXJzaW9uIG9mIHlhcm4gd2FzIHVwZGF0ZWQuJyk7XG5cbiAgICBjb25zdCBuZXdZYXJuVmVyc2lvbiA9IENoaWxkUHJvY2Vzcy5zcGF3blN5bmMoeWFybkdsb2JhbEJpbiwgWyctdiddLCB7XG4gICAgICBlbnY6IHVzZVlhcm5QYXRoRW52LFxuICAgIH0pLnN0ZG91dC50cmltKCk7XG5cbiAgICBpZiAoZ2l0LnJ1bihbJ3N0YXR1cycsICctLXBvcmNlbGFpbiddKS5zdGRvdXQubGVuZ3RoID09PSAwKSB7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuZXJyb3IoJ1lhcm4gYWxyZWFkeSB1cCB0byBkYXRlJyk7XG4gICAgICBwcm9jZXNzLmV4aXRDb2RlID0gMDtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLyoqIFRoZSB0aXRsZSBmb3IgdGhlIFBSLiAqL1xuICAgIGNvbnN0IHRpdGxlID0gYGJ1aWxkOiB1cGRhdGUgdG8geWFybiB2JHtuZXdZYXJuVmVyc2lvbn1gO1xuICAgIC8qKiBUaGUgYm9keSBmb3IgdGhlIFBSLiAqL1xuICAgIGNvbnN0IGJvZHkgPSBgVXBkYXRlIHRvIHRoZSBsYXRlc3QgdmVyc2lvbiBvZiB5YXJuLCAke25ld1lhcm5WZXJzaW9ufS5gO1xuICAgIC8qKiBUaGUgY29tbWl0IG1lc3NhZ2UgZm9yIHRoZSBjaGFuZ2UuICovXG4gICAgY29uc3QgY29tbWl0TWVzc2FnZSA9IGAke3RpdGxlfVxcblxcbiR7Ym9keX1gO1xuICAgIC8qKiBUaGUgbmFtZSBvZiB0aGUgYnJhbmNoIHRvIHVzZSBvbiByZW1vdGUuICovXG4gICAgY29uc3QgYnJhbmNoTmFtZSA9IGB5YXJuLXVwZGF0ZS12JHtuZXdZYXJuVmVyc2lvbn1gO1xuICAgIC8qKiBUaGUgZm9yayBvZiB0aGUgdXNlciAqL1xuICAgIGNvbnN0IHVzZXJGb3JrID0gYXdhaXQgZ2l0LmdldEZvcmtPZkF1dGhlbnRpY2F0ZWRVc2VyKCk7XG4gICAgLyoqIFRoZSBuYW1lIG9mIHRoZSBvd25lciBmb3IgcmVtb3RlIGJyYW5jaCBvbiBHaXRodWIuICovXG4gICAgY29uc3Qge293bmVyOiBsb2NhbE93bmVyfSA9IHVzZXJGb3JrO1xuXG4gICAgc3Bpbm5lci51cGRhdGUoJ1N0YWdpbmcgeWFybiB2ZW5kb3JpbmcgZmlsZXMgYW5kIGNyZWF0aW5nIGNvbW1pdCcpO1xuICAgIGdpdC5ydW4oWydhZGQnLCAnLnlhcm4vcmVsZWFzZXMvKionLCAnLnlhcm5yYyddKTtcbiAgICBnaXQucnVuKFsnY29tbWl0JywgJy1xJywgJy0tbm8tdmVyaWZ5JywgJy1tJywgY29tbWl0TWVzc2FnZV0sIHtlbnY6IHNraXBIdXNreUVudn0pO1xuXG4gICAgc3Bpbm5lci51cGRhdGUoJ1B1c2hpbmcgY29tbWl0IGNoYW5nZXMgdG8gZ2l0aHViLicpO1xuICAgIGdpdC5ydW4oW1xuICAgICAgJ3B1c2gnLFxuICAgICAgJy1xJyxcbiAgICAgIGdldFJlcG9zaXRvcnlHaXRVcmwodXNlckZvcmssIGdpdC5naXRodWJUb2tlbiksXG4gICAgICAnLS1mb3JjZS13aXRoLWxlYXNlJyxcbiAgICAgIGBIRUFEOnJlZnMvaGVhZHMvJHticmFuY2hOYW1lfWAsXG4gICAgXSk7XG5cbiAgICBzcGlubmVyLnVwZGF0ZSgnQ3JlYXRpbmcgYSBQUiBmb3IgdGhlIGNoYW5nZXMuJyk7XG4gICAgY29uc3Qge251bWJlcn0gPSAoXG4gICAgICBhd2FpdCBnaXQuZ2l0aHViLnB1bGxzLmNyZWF0ZSh7XG4gICAgICAgIC4uLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBib2R5LFxuICAgICAgICBiYXNlOiBtYWluQnJhbmNoTmFtZSxcbiAgICAgICAgaGVhZDogYCR7bG9jYWxPd25lcn06JHticmFuY2hOYW1lfWAsXG4gICAgICB9KVxuICAgICkuZGF0YTtcblxuICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICBMb2cuaW5mbyhgQ3JlYXRlZCBQUiAjJHtudW1iZXJ9IHRvIHVwZGF0ZSB0byB5YXJuIHYke25ld1lhcm5WZXJzaW9ufWApO1xuICB9IGNhdGNoIChlKSB7XG4gICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgIExvZy5lcnJvcignQWJvcnRlZCB5YXJuIHVwZGF0ZSBkbyB0byBlcnJvcnM6Jyk7XG4gICAgTG9nLmVycm9yKGUpO1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICAgIGdpdC5jaGVja291dChvcmlnaW5hbEJyYW5jaE9yUmVmLCB0cnVlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBnaXQuY2hlY2tvdXQob3JpZ2luYWxCcmFuY2hPclJlZiwgdHJ1ZSk7XG4gIH1cbn1cblxuLyoqIENMSSBjb21tYW5kIG1vZHVsZS4gKi9cbmV4cG9ydCBjb25zdCBVcGRhdGVZYXJuQ29tbWFuZE1vZHVsZTogQ29tbWFuZE1vZHVsZSA9IHtcbiAgYnVpbGRlcixcbiAgaGFuZGxlcixcbiAgY29tbWFuZDogJ3VwZGF0ZS15YXJuJyxcbiAgZGVzY3JpYmU6ICdBdXRvbWF0aWNhbGx5IHVwZGF0ZSB0aGUgdmVuZG9yZWQgeWFybiB2ZXJzaW9uIGluIHRoZSByZXBvc2l0b3J5IGFuZCBjcmVhdGUgYSBQUicsXG59O1xuIl19