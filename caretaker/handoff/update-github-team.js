import { Prompt } from '../../utils/prompt.js';
import { getConfig, assertValidCaretakerConfig, assertValidGithubConfig, } from '../../utils/config.js';
import { green, Log } from '../../utils/logging.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
export async function updateCaretakerTeamViaPrompt() {
    const config = await getConfig([assertValidCaretakerConfig, assertValidGithubConfig]);
    const caretakerGroup = `${config.github.name}-caretaker`;
    const releaserGroup = `${config.github.name}-releaser`;
    const caretakerGroupRoster = `${config.github.name}-caretaker-roster`;
    const caretakerGroupEmeaRoster = `${config.github.name}-caretaker-roster-emea`;
    const current = new Set(await getGroupMembers(caretakerGroup));
    const roster = await getGroupMembers(caretakerGroupRoster);
    const emeaRoster = await getGroupMembers(caretakerGroupEmeaRoster);
    if (roster.length === 0) {
        return Log.error(`  ✘  Unable to retrieve members of the group: ${caretakerGroupRoster}`);
    }
    const selected = new Set(await Prompt.checkbox({
        choices: roster.map((member) => ({
            value: member,
            checked: current.has(member),
        })),
        message: 'Select 2 caretakers for the upcoming rotation (primary and secondary, http://go/ng-caretakers):',
        validate: (value) => {
            if (value.length !== 2) {
                return 'Please select exactly 2 caretakers for the upcoming rotation.';
            }
            return true;
        },
    }));
    if (config.caretaker.hasEmeaCaretaker) {
        selected.add(await Prompt.select({
            choices: emeaRoster.map((value) => ({ value })),
            message: 'Select EMEA caretaker (http://go/ng-caretaker-schedule-emea)',
        }));
    }
    if (!(await Prompt.confirm({ default: true, message: 'Are you sure?' }))) {
        return Log.warn('  ⚠  Skipping caretaker group update.');
    }
    if (JSON.stringify(Array.from(selected).sort()) === JSON.stringify(Array.from(current).sort())) {
        return Log.info(green('  ✔  Caretaker group already up to date.'));
    }
    try {
        await setGithubTeam(caretakerGroup, Array.from(selected));
        await setGithubTeam(releaserGroup, Array.from(selected));
    }
    catch {
        return Log.error('  ✘  Failed to update caretaker group.');
    }
    Log.info(green('  ✔  Successfully updated caretaker group'));
}
async function getGroupMembers(group) {
    const git = await AuthenticatedGitClient.get();
    try {
        return await git.github.teams
            .listMembersInOrg({
            org: git.remoteConfig.owner,
            team_slug: group,
        })
            .then(({ data }) => data.map((member) => member.login));
    }
    catch (e) {
        Log.debug(e);
        return [];
    }
}
async function setGithubTeam(group, members) {
    const git = await AuthenticatedGitClient.get();
    const fullSlug = `${git.remoteConfig.owner}/${group}`;
    const current = (await getGroupMembers(group)) || [];
    const removed = current.filter((login) => !members.includes(login));
    const add = async (username) => {
        Log.debug(`Adding ${username} to ${fullSlug}.`);
        await git.github.teams.addOrUpdateMembershipForUserInOrg({
            org: git.remoteConfig.owner,
            team_slug: group,
            username,
            role: 'maintainer',
        });
    };
    const remove = async (username) => {
        Log.debug(`Removing ${username} from ${fullSlug}.`);
        await git.github.teams.removeMembershipForUserInOrg({
            org: git.remoteConfig.owner,
            team_slug: group,
            username,
        });
    };
    Log.debug(`Github Team: ${fullSlug}`);
    Log.debug(`Current Membership: ${current.join(', ')}`);
    Log.debug(`New Membership:     ${members.join(', ')}`);
    Log.debug(`Removed:            ${removed.join(', ')}`);
    await Promise.all(members.map(add));
    await Promise.all(removed.map(remove));
    Log.debug(green(`Successfully updated ${fullSlug}`));
}
//# sourceMappingURL=update-github-team.js.map