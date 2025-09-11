import { Prompt } from '../../utils/prompt.js';
import { getConfig, assertValidCaretakerConfig } from '../../utils/config.js';
import { green, Log } from '../../utils/logging.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
export async function updateCaretakerTeamViaPrompt() {
    const config = await getConfig([assertValidCaretakerConfig]);
    const { caretakerGroup } = config.caretaker;
    if (caretakerGroup === undefined) {
        throw Error('`caretakerGroup` is not defined in the `caretaker` config');
    }
    const current = new Set(await getGroupMembers(caretakerGroup));
    const [roster, emeaRoster] = await Promise.all([
        getGroupMembers(`${caretakerGroup}-roster`),
        getGroupMembers(`${caretakerGroup}-roster-emea`),
    ]);
    if (emeaRoster === null) {
        Log.debug(`  Unable to retrieve members of the group: ${caretakerGroup}-roster-emea`);
    }
    if (roster === null) {
        Log.error(`  ✘  Unable to retrieve members of the group: ${caretakerGroup}-roster`);
        return;
    }
    const selectedPrimaryAndSecondary = await Prompt.checkbox({
        choices: roster.map((member) => ({
            value: member,
            checked: current.has(member),
        })),
        message: 'Select 2 caretakers for the upcoming rotation (primary and secondary):',
        validate: (value) => {
            if (value.length !== 2) {
                return 'Please select exactly 2 caretakers for the upcoming rotation.';
            }
            return true;
        },
    });
    let selectedEmea = '';
    if (emeaRoster !== null) {
        const emeaOptions = emeaRoster
            .filter((m) => !selectedPrimaryAndSecondary.includes(m))
            .map((member) => ({
            value: member,
            name: `${member} (EMEA)`,
            checked: current.has(member),
        }));
        selectedEmea = await Prompt.select({
            choices: emeaOptions,
            message: 'Select EMEA caretaker',
        });
        const confirmation = await Prompt.confirm({
            default: true,
            message: 'Are you sure?',
        });
        if (confirmation === false) {
            Log.warn('  ⚠  Skipping caretaker group update.');
            return;
        }
    }
    const selectedSorted = [...selectedPrimaryAndSecondary, selectedEmea].filter((_) => !!_).sort();
    const currentSorted = Array.from(current).sort();
    if (JSON.stringify(selectedSorted) === JSON.stringify(currentSorted)) {
        Log.info(green('  ✔  Caretaker group already up to date.'));
        return;
    }
    try {
        await setCaretakerGroup(caretakerGroup, selectedSorted);
    }
    catch {
        Log.error('  ✘  Failed to update caretaker group.');
        return;
    }
    Log.info(green('  ✔  Successfully updated caretaker group'));
}
async function getGroupMembers(group) {
    const git = await AuthenticatedGitClient.get();
    try {
        return (await git.github.teams.listMembersInOrg({
            org: git.remoteConfig.owner,
            team_slug: group,
        })).data
            .filter((_) => !!_)
            .map((member) => member.login);
    }
    catch (e) {
        Log.debug(e);
        return null;
    }
}
async function setCaretakerGroup(group, members) {
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
    Log.debug.group(`Caretaker Group: ${fullSlug}`);
    Log.debug(`Current Membership: ${current.join(', ')}`);
    Log.debug(`New Membership:     ${members.join(', ')}`);
    Log.debug(`Removed:            ${removed.join(', ')}`);
    Log.debug.groupEnd();
    await Promise.all(members.map(add));
    await Promise.all(removed.map(remove));
    Log.debug(green(`Successfully updated ${fullSlug}`));
}
//# sourceMappingURL=update-github-team.js.map