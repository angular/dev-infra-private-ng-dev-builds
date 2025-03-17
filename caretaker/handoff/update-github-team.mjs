/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Prompt } from '../../utils/prompt.js';
import { getConfig, assertValidCaretakerConfig } from '../../utils/config.js';
import { green, Log } from '../../utils/logging.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
/** Update the Github caretaker group, using a prompt to obtain the new caretaker group members.  */
export async function updateCaretakerTeamViaPrompt() {
    /** Caretaker specific configuration. */
    const config = await getConfig([assertValidCaretakerConfig]);
    const { caretakerGroup } = config.caretaker;
    if (caretakerGroup === undefined) {
        throw Error('`caretakerGroup` is not defined in the `caretaker` config');
    }
    /** The list of current members in the group. */
    const current = new Set(await getGroupMembers(caretakerGroup));
    const [roster, emeaRoster] = await Promise.all([
        getGroupMembers(`${caretakerGroup}-roster`),
        getGroupMembers(`${caretakerGroup}-roster-emea`),
    ]);
    /** The list of users selected to be members of the caretaker group. */
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
    const emeaOptions = emeaRoster
        // Do not show members that are already selected as primary/secondary.
        .filter((m) => !selectedPrimaryAndSecondary.includes(m))
        .map((member) => ({
        value: member,
        name: `${member} (EMEA)`,
        checked: current.has(member),
    }));
    const selectedEmea = await Prompt.select({
        choices: emeaOptions,
        message: 'Select EMEA caretaker',
    });
    /** Whether the user positively confirmed the selected made. */
    const confirmation = await Prompt.confirm({
        default: true,
        message: 'Are you sure?',
    });
    if (confirmation === false) {
        Log.warn('  ⚠  Skipping caretaker group update.');
        return;
    }
    const selectedSorted = [...selectedPrimaryAndSecondary, selectedEmea].sort();
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
/** Retrieve the current list of members for the provided group. */
async function getGroupMembers(group) {
    /** The authenticated GitClient instance. */
    const git = await AuthenticatedGitClient.get();
    return (await git.github.teams.listMembersInOrg({
        org: git.remoteConfig.owner,
        team_slug: group,
    })).data
        .filter((_) => !!_)
        .map((member) => member.login);
}
async function setCaretakerGroup(group, members) {
    /** The authenticated GitClient instance. */
    const git = await AuthenticatedGitClient.get();
    /** The full name of the group <org>/<group name>. */
    const fullSlug = `${git.remoteConfig.owner}/${group}`;
    /** The list of current members of the group. */
    const current = await getGroupMembers(group);
    /** The list of users to be removed from the group. */
    const removed = current.filter((login) => !members.includes(login));
    /** Add a user to the group. */
    const add = async (username) => {
        Log.debug(`Adding ${username} to ${fullSlug}.`);
        await git.github.teams.addOrUpdateMembershipForUserInOrg({
            org: git.remoteConfig.owner,
            team_slug: group,
            username,
            role: 'maintainer',
        });
    };
    /** Remove a user from the group. */
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
    // Add members before removing to prevent the account performing the action from removing their
    // permissions to change the group membership early.
    await Promise.all(members.map(add));
    await Promise.all(removed.map(remove));
    Log.debug(green(`Successfully updated ${fullSlug}`));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdpdGh1Yi10ZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2NhcmV0YWtlci9oYW5kb2ZmL3VwZGF0ZS1naXRodWItdGVhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUFDLFNBQVMsRUFBRSwwQkFBMEIsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTVFLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFFbkYsb0dBQW9HO0FBQ3BHLE1BQU0sQ0FBQyxLQUFLLFVBQVUsNEJBQTRCO0lBQ2hELHdDQUF3QztJQUN4QyxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztJQUM3RCxNQUFNLEVBQUMsY0FBYyxFQUFDLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUUxQyxJQUFJLGNBQWMsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNqQyxNQUFNLEtBQUssQ0FBQywyREFBMkQsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxnREFBZ0Q7SUFDaEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUMvRCxNQUFNLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUM3QyxlQUFlLENBQUMsR0FBRyxjQUFjLFNBQVMsQ0FBQztRQUMzQyxlQUFlLENBQUMsR0FBRyxjQUFjLGNBQWMsQ0FBQztLQUNqRCxDQUFDLENBQUM7SUFFSCx1RUFBdUU7SUFDdkUsTUFBTSwyQkFBMkIsR0FB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RyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUM7WUFDbEQsR0FBRyxFQUFFLEdBQUcsQ0FBQyxZQUFZLENBQUMsS0FBSztZQUMzQixTQUFTLEVBQUUsS0FBSztZQUNoQixRQUFRO1NBQ1QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsb0JBQW9CLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDaEQsR0FBRyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDdkQsR0FBRyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDdkQsR0FBRyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDdkQsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUVyQiwrRkFBK0Y7SUFDL0Ysb0RBQW9EO0lBQ3BELE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDcEMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUV2QyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5pbXBvcnQge2dldENvbmZpZywgYXNzZXJ0VmFsaWRDYXJldGFrZXJDb25maWd9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5cbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuXG4vKiogVXBkYXRlIHRoZSBHaXRodWIgY2FyZXRha2VyIGdyb3VwLCB1c2luZyBhIHByb21wdCB0byBvYnRhaW4gdGhlIG5ldyBjYXJldGFrZXIgZ3JvdXAgbWVtYmVycy4gICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlQ2FyZXRha2VyVGVhbVZpYVByb21wdCgpIHtcbiAgLyoqIENhcmV0YWtlciBzcGVjaWZpYyBjb25maWd1cmF0aW9uLiAqL1xuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoW2Fzc2VydFZhbGlkQ2FyZXRha2VyQ29uZmlnXSk7XG4gIGNvbnN0IHtjYXJldGFrZXJHcm91cH0gPSBjb25maWcuY2FyZXRha2VyO1xuXG4gIGlmIChjYXJldGFrZXJHcm91cCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgRXJyb3IoJ2BjYXJldGFrZXJHcm91cGAgaXMgbm90IGRlZmluZWQgaW4gdGhlIGBjYXJldGFrZXJgIGNvbmZpZycpO1xuICB9XG5cbiAgLyoqIFRoZSBsaXN0IG9mIGN1cnJlbnQgbWVtYmVycyBpbiB0aGUgZ3JvdXAuICovXG4gIGNvbnN0IGN1cnJlbnQgPSBuZXcgU2V0KGF3YWl0IGdldEdyb3VwTWVtYmVycyhjYXJldGFrZXJHcm91cCkpO1xuICBjb25zdCBbcm9zdGVyLCBlbWVhUm9zdGVyXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBnZXRHcm91cE1lbWJlcnMoYCR7Y2FyZXRha2VyR3JvdXB9LXJvc3RlcmApLFxuICAgIGdldEdyb3VwTWVtYmVycyhgJHtjYXJldGFrZXJHcm91cH0tcm9zdGVyLWVtZWFgKSxcbiAgXSk7XG5cbiAgLyoqIFRoZSBsaXN0IG9mIHVzZXJzIHNlbGVjdGVkIHRvIGJlIG1lbWJlcnMgb2YgdGhlIGNhcmV0YWtlciBncm91cC4gKi9cbiAgY29uc3Qgc2VsZWN0ZWRQcmltYXJ5QW5kU2Vjb25kYXJ5ID0gYXdhaXQgUHJvbXB0LmNoZWNrYm94PHN0cmluZz4oe1xuICAgIGNob2ljZXM6IHJvc3Rlci5tYXAoKG1lbWJlcikgPT4gKHtcbiAgICAgIHZhbHVlOiBtZW1iZXIsXG4gICAgICBjaGVja2VkOiBjdXJyZW50LmhhcyhtZW1iZXIpLFxuICAgIH0pKSxcbiAgICBtZXNzYWdlOiAnU2VsZWN0IDIgY2FyZXRha2VycyBmb3IgdGhlIHVwY29taW5nIHJvdGF0aW9uIChwcmltYXJ5IGFuZCBzZWNvbmRhcnkpOicsXG4gICAgdmFsaWRhdGU6ICh2YWx1ZSkgPT4ge1xuICAgICAgaWYgKHZhbHVlLmxlbmd0aCAhPT0gMikge1xuICAgICAgICByZXR1cm4gJ1BsZWFzZSBzZWxlY3QgZXhhY3RseSAyIGNhcmV0YWtlcnMgZm9yIHRoZSB1cGNvbWluZyByb3RhdGlvbi4nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3QgZW1lYU9wdGlvbnMgPSBlbWVhUm9zdGVyXG4gICAgLy8gRG8gbm90IHNob3cgbWVtYmVycyB0aGF0IGFyZSBhbHJlYWR5IHNlbGVjdGVkIGFzIHByaW1hcnkvc2Vjb25kYXJ5LlxuICAgIC5maWx0ZXIoKG0pID0+ICFzZWxlY3RlZFByaW1hcnlBbmRTZWNvbmRhcnkuaW5jbHVkZXMobSkpXG4gICAgLm1hcCgobWVtYmVyKSA9PiAoe1xuICAgICAgdmFsdWU6IG1lbWJlcixcbiAgICAgIG5hbWU6IGAke21lbWJlcn0gKEVNRUEpYCxcbiAgICAgIGNoZWNrZWQ6IGN1cnJlbnQuaGFzKG1lbWJlciksXG4gICAgfSkpO1xuICBjb25zdCBzZWxlY3RlZEVtZWEgPSBhd2FpdCBQcm9tcHQuc2VsZWN0PHN0cmluZz4oe1xuICAgIGNob2ljZXM6IGVtZWFPcHRpb25zLFxuICAgIG1lc3NhZ2U6ICdTZWxlY3QgRU1FQSBjYXJldGFrZXInLFxuICB9KTtcblxuICAvKiogV2hldGhlciB0aGUgdXNlciBwb3NpdGl2ZWx5IGNvbmZpcm1lZCB0aGUgc2VsZWN0ZWQgbWFkZS4gKi9cbiAgY29uc3QgY29uZmlybWF0aW9uID0gYXdhaXQgUHJvbXB0LmNvbmZpcm0oe1xuICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgbWVzc2FnZTogJ0FyZSB5b3Ugc3VyZT8nLFxuICB9KTtcblxuICBpZiAoY29uZmlybWF0aW9uID09PSBmYWxzZSkge1xuICAgIExvZy53YXJuKCcgIOKaoCAgU2tpcHBpbmcgY2FyZXRha2VyIGdyb3VwIHVwZGF0ZS4nKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBzZWxlY3RlZFNvcnRlZCA9IFsuLi5zZWxlY3RlZFByaW1hcnlBbmRTZWNvbmRhcnksIHNlbGVjdGVkRW1lYV0uc29ydCgpO1xuICBjb25zdCBjdXJyZW50U29ydGVkID0gQXJyYXkuZnJvbShjdXJyZW50KS5zb3J0KCk7XG5cbiAgaWYgKEpTT04uc3RyaW5naWZ5KHNlbGVjdGVkU29ydGVkKSA9PT0gSlNPTi5zdHJpbmdpZnkoY3VycmVudFNvcnRlZCkpIHtcbiAgICBMb2cuaW5mbyhncmVlbignICDinJQgIENhcmV0YWtlciBncm91cCBhbHJlYWR5IHVwIHRvIGRhdGUuJykpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRyeSB7XG4gICAgYXdhaXQgc2V0Q2FyZXRha2VyR3JvdXAoY2FyZXRha2VyR3JvdXAsIHNlbGVjdGVkU29ydGVkKTtcbiAgfSBjYXRjaCB7XG4gICAgTG9nLmVycm9yKCcgIOKcmCAgRmFpbGVkIHRvIHVwZGF0ZSBjYXJldGFrZXIgZ3JvdXAuJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIExvZy5pbmZvKGdyZWVuKCcgIOKclCAgU3VjY2Vzc2Z1bGx5IHVwZGF0ZWQgY2FyZXRha2VyIGdyb3VwJykpO1xufVxuXG4vKiogUmV0cmlldmUgdGhlIGN1cnJlbnQgbGlzdCBvZiBtZW1iZXJzIGZvciB0aGUgcHJvdmlkZWQgZ3JvdXAuICovXG5hc3luYyBmdW5jdGlvbiBnZXRHcm91cE1lbWJlcnMoZ3JvdXA6IHN0cmluZykge1xuICAvKiogVGhlIGF1dGhlbnRpY2F0ZWQgR2l0Q2xpZW50IGluc3RhbmNlLiAqL1xuICBjb25zdCBnaXQgPSBhd2FpdCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LmdldCgpO1xuXG4gIHJldHVybiAoXG4gICAgYXdhaXQgZ2l0LmdpdGh1Yi50ZWFtcy5saXN0TWVtYmVyc0luT3JnKHtcbiAgICAgIG9yZzogZ2l0LnJlbW90ZUNvbmZpZy5vd25lcixcbiAgICAgIHRlYW1fc2x1ZzogZ3JvdXAsXG4gICAgfSlcbiAgKS5kYXRhXG4gICAgLmZpbHRlcigoXykgPT4gISFfKVxuICAgIC5tYXAoKG1lbWJlcikgPT4gbWVtYmVyIS5sb2dpbik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNldENhcmV0YWtlckdyb3VwKGdyb3VwOiBzdHJpbmcsIG1lbWJlcnM6IHN0cmluZ1tdKSB7XG4gIC8qKiBUaGUgYXV0aGVudGljYXRlZCBHaXRDbGllbnQgaW5zdGFuY2UuICovXG4gIGNvbnN0IGdpdCA9IGF3YWl0IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuZ2V0KCk7XG4gIC8qKiBUaGUgZnVsbCBuYW1lIG9mIHRoZSBncm91cCA8b3JnPi88Z3JvdXAgbmFtZT4uICovXG4gIGNvbnN0IGZ1bGxTbHVnID0gYCR7Z2l0LnJlbW90ZUNvbmZpZy5vd25lcn0vJHtncm91cH1gO1xuICAvKiogVGhlIGxpc3Qgb2YgY3VycmVudCBtZW1iZXJzIG9mIHRoZSBncm91cC4gKi9cbiAgY29uc3QgY3VycmVudCA9IGF3YWl0IGdldEdyb3VwTWVtYmVycyhncm91cCk7XG4gIC8qKiBUaGUgbGlzdCBvZiB1c2VycyB0byBiZSByZW1vdmVkIGZyb20gdGhlIGdyb3VwLiAqL1xuICBjb25zdCByZW1vdmVkID0gY3VycmVudC5maWx0ZXIoKGxvZ2luKSA9PiAhbWVtYmVycy5pbmNsdWRlcyhsb2dpbikpO1xuICAvKiogQWRkIGEgdXNlciB0byB0aGUgZ3JvdXAuICovXG4gIGNvbnN0IGFkZCA9IGFzeW5jICh1c2VybmFtZTogc3RyaW5nKSA9PiB7XG4gICAgTG9nLmRlYnVnKGBBZGRpbmcgJHt1c2VybmFtZX0gdG8gJHtmdWxsU2x1Z30uYCk7XG4gICAgYXdhaXQgZ2l0LmdpdGh1Yi50ZWFtcy5hZGRPclVwZGF0ZU1lbWJlcnNoaXBGb3JVc2VySW5Pcmcoe1xuICAgICAgb3JnOiBnaXQucmVtb3RlQ29uZmlnLm93bmVyLFxuICAgICAgdGVhbV9zbHVnOiBncm91cCxcbiAgICAgIHVzZXJuYW1lLFxuICAgICAgcm9sZTogJ21haW50YWluZXInLFxuICAgIH0pO1xuICB9O1xuICAvKiogUmVtb3ZlIGEgdXNlciBmcm9tIHRoZSBncm91cC4gKi9cbiAgY29uc3QgcmVtb3ZlID0gYXN5bmMgKHVzZXJuYW1lOiBzdHJpbmcpID0+IHtcbiAgICBMb2cuZGVidWcoYFJlbW92aW5nICR7dXNlcm5hbWV9IGZyb20gJHtmdWxsU2x1Z30uYCk7XG4gICAgYXdhaXQgZ2l0LmdpdGh1Yi50ZWFtcy5yZW1vdmVNZW1iZXJzaGlwRm9yVXNlckluT3JnKHtcbiAgICAgIG9yZzogZ2l0LnJlbW90ZUNvbmZpZy5vd25lcixcbiAgICAgIHRlYW1fc2x1ZzogZ3JvdXAsXG4gICAgICB1c2VybmFtZSxcbiAgICB9KTtcbiAgfTtcblxuICBMb2cuZGVidWcuZ3JvdXAoYENhcmV0YWtlciBHcm91cDogJHtmdWxsU2x1Z31gKTtcbiAgTG9nLmRlYnVnKGBDdXJyZW50IE1lbWJlcnNoaXA6ICR7Y3VycmVudC5qb2luKCcsICcpfWApO1xuICBMb2cuZGVidWcoYE5ldyBNZW1iZXJzaGlwOiAgICAgJHttZW1iZXJzLmpvaW4oJywgJyl9YCk7XG4gIExvZy5kZWJ1ZyhgUmVtb3ZlZDogICAgICAgICAgICAke3JlbW92ZWQuam9pbignLCAnKX1gKTtcbiAgTG9nLmRlYnVnLmdyb3VwRW5kKCk7XG5cbiAgLy8gQWRkIG1lbWJlcnMgYmVmb3JlIHJlbW92aW5nIHRvIHByZXZlbnQgdGhlIGFjY291bnQgcGVyZm9ybWluZyB0aGUgYWN0aW9uIGZyb20gcmVtb3ZpbmcgdGhlaXJcbiAgLy8gcGVybWlzc2lvbnMgdG8gY2hhbmdlIHRoZSBncm91cCBtZW1iZXJzaGlwIGVhcmx5LlxuICBhd2FpdCBQcm9taXNlLmFsbChtZW1iZXJzLm1hcChhZGQpKTtcbiAgYXdhaXQgUHJvbWlzZS5hbGwocmVtb3ZlZC5tYXAocmVtb3ZlKSk7XG5cbiAgTG9nLmRlYnVnKGdyZWVuKGBTdWNjZXNzZnVsbHkgdXBkYXRlZCAke2Z1bGxTbHVnfWApKTtcbn1cbiJdfQ==