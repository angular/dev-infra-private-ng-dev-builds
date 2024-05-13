/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import inquirer from 'inquirer';
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
    const current = await getGroupMembers(caretakerGroup);
    /** The list of members able to be added to the group as defined by a separate roster group. */
    const roster = await getGroupMembers(`${caretakerGroup}-roster`);
    const { 
    /** The list of users selected to be members of the caretaker group. */
    selected, 
    /** Whether the user positively confirmed the selected made. */
    confirm, } = await inquirer.prompt([
        {
            type: 'checkbox',
            choices: roster,
            message: 'Select 2 caretakers for the upcoming rotation:',
            default: current,
            name: 'selected',
            prefix: '',
            validate: (value) => {
                if (value.length !== 2) {
                    return 'Please select exactly 2 caretakers for the upcoming rotation.';
                }
                return true;
            },
        },
        {
            type: 'confirm',
            default: true,
            prefix: '',
            message: 'Are you sure?',
            name: 'confirm',
        },
    ]);
    if (confirm === false) {
        Log.warn('  ⚠  Skipping caretaker group update.');
        return;
    }
    if (JSON.stringify(selected) === JSON.stringify(current)) {
        Log.info(green('  √  Caretaker group already up to date.'));
        return;
    }
    try {
        await setCaretakerGroup(caretakerGroup, selected);
    }
    catch {
        Log.error('  ✘  Failed to update caretaker group.');
        return;
    }
    Log.info(green('  √  Successfully updated caretaker group'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdpdGh1Yi10ZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2NhcmV0YWtlci9oYW5kb2ZmL3VwZGF0ZS1naXRodWItdGVhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLFFBQVEsTUFBTSxVQUFVLENBQUM7QUFDaEMsT0FBTyxFQUFDLFNBQVMsRUFBRSwwQkFBMEIsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTVFLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFTLE1BQU0sd0JBQXdCLENBQUM7QUFDMUQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFFbkYsb0dBQW9HO0FBQ3BHLE1BQU0sQ0FBQyxLQUFLLFVBQVUsNEJBQTRCO0lBQ2hELHdDQUF3QztJQUN4QyxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztJQUM3RCxNQUFNLEVBQUMsY0FBYyxFQUFDLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUUxQyxJQUFJLGNBQWMsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNqQyxNQUFNLEtBQUssQ0FBQywyREFBMkQsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxnREFBZ0Q7SUFDaEQsTUFBTSxPQUFPLEdBQUcsTUFBTSxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDdEQsK0ZBQStGO0lBQy9GLE1BQU0sTUFBTSxHQUFHLE1BQU0sZUFBZSxDQUFDLEdBQUcsY0FBYyxTQUFTLENBQUMsQ0FBQztJQUNqRSxNQUFNO0lBQ0osdUVBQXVFO0lBQ3ZFLFFBQVE7SUFDUiwrREFBK0Q7SUFDL0QsT0FBTyxHQUNSLEdBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQ3hCO1lBQ0UsSUFBSSxFQUFFLFVBQVU7WUFDaEIsT0FBTyxFQUFFLE1BQU07WUFDZixP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QUV2QyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGlucXVpcmVyIGZyb20gJ2lucXVpcmVyJztcbmltcG9ydCB7Z2V0Q29uZmlnLCBhc3NlcnRWYWxpZENhcmV0YWtlckNvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcblxuaW1wb3J0IHtncmVlbiwgTG9nLCB5ZWxsb3d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcblxuLyoqIFVwZGF0ZSB0aGUgR2l0aHViIGNhcmV0YWtlciBncm91cCwgdXNpbmcgYSBwcm9tcHQgdG8gb2J0YWluIHRoZSBuZXcgY2FyZXRha2VyIGdyb3VwIG1lbWJlcnMuICAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUNhcmV0YWtlclRlYW1WaWFQcm9tcHQoKSB7XG4gIC8qKiBDYXJldGFrZXIgc3BlY2lmaWMgY29uZmlndXJhdGlvbi4gKi9cbiAgY29uc3QgY29uZmlnID0gYXdhaXQgZ2V0Q29uZmlnKFthc3NlcnRWYWxpZENhcmV0YWtlckNvbmZpZ10pO1xuICBjb25zdCB7Y2FyZXRha2VyR3JvdXB9ID0gY29uZmlnLmNhcmV0YWtlcjtcblxuICBpZiAoY2FyZXRha2VyR3JvdXAgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IEVycm9yKCdgY2FyZXRha2VyR3JvdXBgIGlzIG5vdCBkZWZpbmVkIGluIHRoZSBgY2FyZXRha2VyYCBjb25maWcnKTtcbiAgfVxuXG4gIC8qKiBUaGUgbGlzdCBvZiBjdXJyZW50IG1lbWJlcnMgaW4gdGhlIGdyb3VwLiAqL1xuICBjb25zdCBjdXJyZW50ID0gYXdhaXQgZ2V0R3JvdXBNZW1iZXJzKGNhcmV0YWtlckdyb3VwKTtcbiAgLyoqIFRoZSBsaXN0IG9mIG1lbWJlcnMgYWJsZSB0byBiZSBhZGRlZCB0byB0aGUgZ3JvdXAgYXMgZGVmaW5lZCBieSBhIHNlcGFyYXRlIHJvc3RlciBncm91cC4gKi9cbiAgY29uc3Qgcm9zdGVyID0gYXdhaXQgZ2V0R3JvdXBNZW1iZXJzKGAke2NhcmV0YWtlckdyb3VwfS1yb3N0ZXJgKTtcbiAgY29uc3Qge1xuICAgIC8qKiBUaGUgbGlzdCBvZiB1c2VycyBzZWxlY3RlZCB0byBiZSBtZW1iZXJzIG9mIHRoZSBjYXJldGFrZXIgZ3JvdXAuICovXG4gICAgc2VsZWN0ZWQsXG4gICAgLyoqIFdoZXRoZXIgdGhlIHVzZXIgcG9zaXRpdmVseSBjb25maXJtZWQgdGhlIHNlbGVjdGVkIG1hZGUuICovXG4gICAgY29uZmlybSxcbiAgfSA9IGF3YWl0IGlucXVpcmVyLnByb21wdChbXG4gICAge1xuICAgICAgdHlwZTogJ2NoZWNrYm94JyxcbiAgICAgIGNob2ljZXM6IHJvc3RlcixcbiAgICAgIG1lc3NhZ2U6ICdTZWxlY3QgMiBjYXJldGFrZXJzIGZvciB0aGUgdXBjb21pbmcgcm90YXRpb246JyxcbiAgICAgIGRlZmF1bHQ6IGN1cnJlbnQsXG4gICAgICBuYW1lOiAnc2VsZWN0ZWQnLFxuICAgICAgcHJlZml4OiAnJyxcbiAgICAgIHZhbGlkYXRlOiAodmFsdWU6IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgIGlmICh2YWx1ZS5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgICByZXR1cm4gJ1BsZWFzZSBzZWxlY3QgZXhhY3RseSAyIGNhcmV0YWtlcnMgZm9yIHRoZSB1cGNvbWluZyByb3RhdGlvbi4nO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHR5cGU6ICdjb25maXJtJyxcbiAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICBwcmVmaXg6ICcnLFxuICAgICAgbWVzc2FnZTogJ0FyZSB5b3Ugc3VyZT8nLFxuICAgICAgbmFtZTogJ2NvbmZpcm0nLFxuICAgIH0sXG4gIF0pO1xuXG4gIGlmIChjb25maXJtID09PSBmYWxzZSkge1xuICAgIExvZy53YXJuKCcgIOKaoCAgU2tpcHBpbmcgY2FyZXRha2VyIGdyb3VwIHVwZGF0ZS4nKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoSlNPTi5zdHJpbmdpZnkoc2VsZWN0ZWQpID09PSBKU09OLnN0cmluZ2lmeShjdXJyZW50KSkge1xuICAgIExvZy5pbmZvKGdyZWVuKCcgIOKImiAgQ2FyZXRha2VyIGdyb3VwIGFscmVhZHkgdXAgdG8gZGF0ZS4nKSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBzZXRDYXJldGFrZXJHcm91cChjYXJldGFrZXJHcm91cCwgc2VsZWN0ZWQpO1xuICB9IGNhdGNoIHtcbiAgICBMb2cuZXJyb3IoJyAg4pyYICBGYWlsZWQgdG8gdXBkYXRlIGNhcmV0YWtlciBncm91cC4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgTG9nLmluZm8oZ3JlZW4oJyAg4oiaICBTdWNjZXNzZnVsbHkgdXBkYXRlZCBjYXJldGFrZXIgZ3JvdXAnKSk7XG59XG5cbi8qKiBSZXRyaWV2ZSB0aGUgY3VycmVudCBsaXN0IG9mIG1lbWJlcnMgZm9yIHRoZSBwcm92aWRlZCBncm91cC4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEdyb3VwTWVtYmVycyhncm91cDogc3RyaW5nKSB7XG4gIC8qKiBUaGUgYXV0aGVudGljYXRlZCBHaXRDbGllbnQgaW5zdGFuY2UuICovXG4gIGNvbnN0IGdpdCA9IGF3YWl0IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuZ2V0KCk7XG5cbiAgcmV0dXJuIChcbiAgICBhd2FpdCBnaXQuZ2l0aHViLnRlYW1zLmxpc3RNZW1iZXJzSW5Pcmcoe1xuICAgICAgb3JnOiBnaXQucmVtb3RlQ29uZmlnLm93bmVyLFxuICAgICAgdGVhbV9zbHVnOiBncm91cCxcbiAgICB9KVxuICApLmRhdGFcbiAgICAuZmlsdGVyKChfKSA9PiAhIV8pXG4gICAgLm1hcCgobWVtYmVyKSA9PiBtZW1iZXIhLmxvZ2luKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2V0Q2FyZXRha2VyR3JvdXAoZ3JvdXA6IHN0cmluZywgbWVtYmVyczogc3RyaW5nW10pIHtcbiAgLyoqIFRoZSBhdXRoZW50aWNhdGVkIEdpdENsaWVudCBpbnN0YW5jZS4gKi9cbiAgY29uc3QgZ2l0ID0gYXdhaXQgQXV0aGVudGljYXRlZEdpdENsaWVudC5nZXQoKTtcbiAgLyoqIFRoZSBmdWxsIG5hbWUgb2YgdGhlIGdyb3VwIDxvcmc+Lzxncm91cCBuYW1lPi4gKi9cbiAgY29uc3QgZnVsbFNsdWcgPSBgJHtnaXQucmVtb3RlQ29uZmlnLm93bmVyfS8ke2dyb3VwfWA7XG4gIC8qKiBUaGUgbGlzdCBvZiBjdXJyZW50IG1lbWJlcnMgb2YgdGhlIGdyb3VwLiAqL1xuICBjb25zdCBjdXJyZW50ID0gYXdhaXQgZ2V0R3JvdXBNZW1iZXJzKGdyb3VwKTtcbiAgLyoqIFRoZSBsaXN0IG9mIHVzZXJzIHRvIGJlIHJlbW92ZWQgZnJvbSB0aGUgZ3JvdXAuICovXG4gIGNvbnN0IHJlbW92ZWQgPSBjdXJyZW50LmZpbHRlcigobG9naW4pID0+ICFtZW1iZXJzLmluY2x1ZGVzKGxvZ2luKSk7XG4gIC8qKiBBZGQgYSB1c2VyIHRvIHRoZSBncm91cC4gKi9cbiAgY29uc3QgYWRkID0gYXN5bmMgKHVzZXJuYW1lOiBzdHJpbmcpID0+IHtcbiAgICBMb2cuZGVidWcoYEFkZGluZyAke3VzZXJuYW1lfSB0byAke2Z1bGxTbHVnfS5gKTtcbiAgICBhd2FpdCBnaXQuZ2l0aHViLnRlYW1zLmFkZE9yVXBkYXRlTWVtYmVyc2hpcEZvclVzZXJJbk9yZyh7XG4gICAgICBvcmc6IGdpdC5yZW1vdGVDb25maWcub3duZXIsXG4gICAgICB0ZWFtX3NsdWc6IGdyb3VwLFxuICAgICAgdXNlcm5hbWUsXG4gICAgICByb2xlOiAnbWFpbnRhaW5lcicsXG4gICAgfSk7XG4gIH07XG4gIC8qKiBSZW1vdmUgYSB1c2VyIGZyb20gdGhlIGdyb3VwLiAqL1xuICBjb25zdCByZW1vdmUgPSBhc3luYyAodXNlcm5hbWU6IHN0cmluZykgPT4ge1xuICAgIExvZy5kZWJ1ZyhgUmVtb3ZpbmcgJHt1c2VybmFtZX0gZnJvbSAke2Z1bGxTbHVnfS5gKTtcbiAgICBhd2FpdCBnaXQuZ2l0aHViLnRlYW1zLnJlbW92ZU1lbWJlcnNoaXBGb3JVc2VySW5Pcmcoe1xuICAgICAgb3JnOiBnaXQucmVtb3RlQ29uZmlnLm93bmVyLFxuICAgICAgdGVhbV9zbHVnOiBncm91cCxcbiAgICAgIHVzZXJuYW1lLFxuICAgIH0pO1xuICB9O1xuXG4gIExvZy5kZWJ1Zy5ncm91cChgQ2FyZXRha2VyIEdyb3VwOiAke2Z1bGxTbHVnfWApO1xuICBMb2cuZGVidWcoYEN1cnJlbnQgTWVtYmVyc2hpcDogJHtjdXJyZW50LmpvaW4oJywgJyl9YCk7XG4gIExvZy5kZWJ1ZyhgTmV3IE1lbWJlcnNoaXA6ICAgICAke21lbWJlcnMuam9pbignLCAnKX1gKTtcbiAgTG9nLmRlYnVnKGBSZW1vdmVkOiAgICAgICAgICAgICR7cmVtb3ZlZC5qb2luKCcsICcpfWApO1xuICBMb2cuZGVidWcuZ3JvdXBFbmQoKTtcblxuICAvLyBBZGQgbWVtYmVycyBiZWZvcmUgcmVtb3ZpbmcgdG8gcHJldmVudCB0aGUgYWNjb3VudCBwZXJmb3JtaW5nIHRoZSBhY3Rpb24gZnJvbSByZW1vdmluZyB0aGVpclxuICAvLyBwZXJtaXNzaW9ucyB0byBjaGFuZ2UgdGhlIGdyb3VwIG1lbWJlcnNoaXAgZWFybHkuXG4gIGF3YWl0IFByb21pc2UuYWxsKG1lbWJlcnMubWFwKGFkZCkpO1xuICBhd2FpdCBQcm9taXNlLmFsbChyZW1vdmVkLm1hcChyZW1vdmUpKTtcblxuICBMb2cuZGVidWcoZ3JlZW4oYFN1Y2Nlc3NmdWxseSB1cGRhdGVkICR7ZnVsbFNsdWd9YCkpO1xufVxuIl19