import { assertValidGithubConfig, getConfig } from '../../utils/config';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client';
import { setRepoMergeMode } from '../../utils/git/repository-merge-mode';
import { green, Log, bold } from '../../utils/logging';
export async function setMergeModeRelease() {
    try {
        await setRepoReleaserTeamToOnlyCurrentUser();
        await setRepoMergeMode('release');
        Log.info(green('  ✔  Repository is set for release'));
    }
    catch (err) {
        Log.error('  ✘  Failed to setup of repository for release');
        if (err instanceof Error) {
            Log.info(err.message);
            Log.debug(err.stack);
            return;
        }
        Log.info(err);
    }
}
async function setRepoReleaserTeamToOnlyCurrentUser() {
    const git = await AuthenticatedGitClient.get();
    const config = await getConfig([assertValidGithubConfig]);
    const group = `${config.github.name}-releaser`;
    const login = await git.github.users.getAuthenticated().then(({ data }) => data.login);
    const membership = await git.github.teams
        .getMembershipForUserInOrg({
        org: git.remoteConfig.owner,
        team_slug: group,
        username: login,
    })
        .then(({ data }) => data.role, () => undefined);
    if (membership !== 'maintainer') {
        Log.info(`Unable to update membership in ${bold(group)}`);
        Log.info(`Please reach out to dev-infra for assistance.`);
        throw '';
    }
    const members = new Set(await git.github.teams
        .listMembersInOrg({
        org: git.remoteConfig.owner,
        team_slug: group,
    })
        .then(({ data }) => data.map(({ login }) => login)));
    Log.debug(`Current membership for ${group}:`);
    for (const member of members) {
        Log.debug(`  - ${member}`);
    }
    members.delete(login);
    await Promise.all(Array.from(members).map(async (username) => {
        if (username === login) {
            return;
        }
        await git.github.teams.removeMembershipForUserInOrg({
            org: git.remoteConfig.owner,
            team_slug: group,
            username,
        });
        Log.debug(`Removed ${username} from ${group}.`);
    }));
}
//# sourceMappingURL=release.js.map