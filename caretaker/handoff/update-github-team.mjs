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
    const current = new Set(await getGroupMembers(caretakerGroup));
    /** The list of members able to be added to the group as defined by a separate roster group. */
    const roster = (await getGroupMembers(`${caretakerGroup}-roster`)).map((member) => ({
        value: member,
        checked: current.has(member),
    }));
    const { 
    /** The list of users selected to be members of the caretaker group. */
    selected, 
    /** Whether the user positively confirmed the selected made. */
    confirm, } = await inquirer.prompt([
        {
            type: 'checkbox',
            choices: roster,
            message: 'Select 2 caretakers for the upcoming rotation:',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdpdGh1Yi10ZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2NhcmV0YWtlci9oYW5kb2ZmL3VwZGF0ZS1naXRodWItdGVhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLFFBQVEsTUFBTSxVQUFVLENBQUM7QUFDaEMsT0FBTyxFQUFDLFNBQVMsRUFBRSwwQkFBMEIsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTVFLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFTLE1BQU0sd0JBQXdCLENBQUM7QUFDMUQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFFbkYsb0dBQW9HO0FBQ3BHLE1BQU0sQ0FBQyxLQUFLLFVBQVUsNEJBQTRCO0lBQ2hELHdDQUF3QztJQUN4QyxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztJQUM3RCxNQUFNLEVBQUMsY0FBYyxFQUFDLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUUxQyxJQUFJLGNBQWMsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNqQyxNQUFNLEtBQUssQ0FBQywyREFBMkQsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxnREFBZ0Q7SUFDaEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUMvRCwrRkFBK0Y7SUFDL0YsTUFBTSxNQUFNLEdBQUcsQ0FBQyxNQUFNLGVBQWUsQ0FBQyxHQUFHLGNBQWMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEYsS0FBSyxFQUFFLE1BQU07UUFDYixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7S0FDN0IsQ0FB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QUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNwQyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBRXZDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLHdCQUF3QixRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgaW5xdWlyZXIgZnJvbSAnaW5xdWlyZXInO1xuaW1wb3J0IHtnZXRDb25maWcsIGFzc2VydFZhbGlkQ2FyZXRha2VyQ29uZmlnfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnO1xuXG5pbXBvcnQge2dyZWVuLCBMb2csIHllbGxvd30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuXG4vKiogVXBkYXRlIHRoZSBHaXRodWIgY2FyZXRha2VyIGdyb3VwLCB1c2luZyBhIHByb21wdCB0byBvYnRhaW4gdGhlIG5ldyBjYXJldGFrZXIgZ3JvdXAgbWVtYmVycy4gICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlQ2FyZXRha2VyVGVhbVZpYVByb21wdCgpIHtcbiAgLyoqIENhcmV0YWtlciBzcGVjaWZpYyBjb25maWd1cmF0aW9uLiAqL1xuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoW2Fzc2VydFZhbGlkQ2FyZXRha2VyQ29uZmlnXSk7XG4gIGNvbnN0IHtjYXJldGFrZXJHcm91cH0gPSBjb25maWcuY2FyZXRha2VyO1xuXG4gIGlmIChjYXJldGFrZXJHcm91cCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgRXJyb3IoJ2BjYXJldGFrZXJHcm91cGAgaXMgbm90IGRlZmluZWQgaW4gdGhlIGBjYXJldGFrZXJgIGNvbmZpZycpO1xuICB9XG5cbiAgLyoqIFRoZSBsaXN0IG9mIGN1cnJlbnQgbWVtYmVycyBpbiB0aGUgZ3JvdXAuICovXG4gIGNvbnN0IGN1cnJlbnQgPSBuZXcgU2V0KGF3YWl0IGdldEdyb3VwTWVtYmVycyhjYXJldGFrZXJHcm91cCkpO1xuICAvKiogVGhlIGxpc3Qgb2YgbWVtYmVycyBhYmxlIHRvIGJlIGFkZGVkIHRvIHRoZSBncm91cCBhcyBkZWZpbmVkIGJ5IGEgc2VwYXJhdGUgcm9zdGVyIGdyb3VwLiAqL1xuICBjb25zdCByb3N0ZXIgPSAoYXdhaXQgZ2V0R3JvdXBNZW1iZXJzKGAke2NhcmV0YWtlckdyb3VwfS1yb3N0ZXJgKSkubWFwKChtZW1iZXIpID0+ICh7XG4gICAgdmFsdWU6IG1lbWJlcixcbiAgICBjaGVja2VkOiBjdXJyZW50LmhhcyhtZW1iZXIpLFxuICB9KSk7XG4gIGNvbnN0IHtcbiAgICAvKiogVGhlIGxpc3Qgb2YgdXNlcnMgc2VsZWN0ZWQgdG8gYmUgbWVtYmVycyBvZiB0aGUgY2FyZXRha2VyIGdyb3VwLiAqL1xuICAgIHNlbGVjdGVkLFxuICAgIC8qKiBXaGV0aGVyIHRoZSB1c2VyIHBvc2l0aXZlbHkgY29uZmlybWVkIHRoZSBzZWxlY3RlZCBtYWRlLiAqL1xuICAgIGNvbmZpcm0sXG4gIH0gPSBhd2FpdCBpbnF1aXJlci5wcm9tcHQ8e3NlbGVjdGVkOiBzdHJpbmdbXTsgY29uZmlybTogYm9vbGVhbn0+KFtcbiAgICB7XG4gICAgICB0eXBlOiAnY2hlY2tib3gnLFxuICAgICAgY2hvaWNlczogcm9zdGVyLFxuICAgICAgbWVzc2FnZTogJ1NlbGVjdCAyIGNhcmV0YWtlcnMgZm9yIHRoZSB1cGNvbWluZyByb3RhdGlvbjonLFxuICAgICAgbmFtZTogJ3NlbGVjdGVkJyxcbiAgICAgIHByZWZpeDogJycsXG4gICAgICB2YWxpZGF0ZTogKHZhbHVlKSA9PiB7XG4gICAgICAgIGlmICh2YWx1ZS5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgICByZXR1cm4gJ1BsZWFzZSBzZWxlY3QgZXhhY3RseSAyIGNhcmV0YWtlcnMgZm9yIHRoZSB1cGNvbWluZyByb3RhdGlvbi4nO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHR5cGU6ICdjb25maXJtJyxcbiAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICBtZXNzYWdlOiAnQXJlIHlvdSBzdXJlPycsXG4gICAgICBuYW1lOiAnY29uZmlybScsXG4gICAgfSxcbiAgXSk7XG5cbiAgaWYgKGNvbmZpcm0gPT09IGZhbHNlKSB7XG4gICAgTG9nLndhcm4oJyAg4pqgICBTa2lwcGluZyBjYXJldGFrZXIgZ3JvdXAgdXBkYXRlLicpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChKU09OLnN0cmluZ2lmeShzZWxlY3RlZCkgPT09IEpTT04uc3RyaW5naWZ5KGN1cnJlbnQpKSB7XG4gICAgTG9nLmluZm8oZ3JlZW4oJyAg4oiaICBDYXJldGFrZXIgZ3JvdXAgYWxyZWFkeSB1cCB0byBkYXRlLicpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGF3YWl0IHNldENhcmV0YWtlckdyb3VwKGNhcmV0YWtlckdyb3VwLCBzZWxlY3RlZCk7XG4gIH0gY2F0Y2gge1xuICAgIExvZy5lcnJvcignICDinJggIEZhaWxlZCB0byB1cGRhdGUgY2FyZXRha2VyIGdyb3VwLicpO1xuICAgIHJldHVybjtcbiAgfVxuICBMb2cuaW5mbyhncmVlbignICDiiJogIFN1Y2Nlc3NmdWxseSB1cGRhdGVkIGNhcmV0YWtlciBncm91cCcpKTtcbn1cblxuLyoqIFJldHJpZXZlIHRoZSBjdXJyZW50IGxpc3Qgb2YgbWVtYmVycyBmb3IgdGhlIHByb3ZpZGVkIGdyb3VwLiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0R3JvdXBNZW1iZXJzKGdyb3VwOiBzdHJpbmcpIHtcbiAgLyoqIFRoZSBhdXRoZW50aWNhdGVkIEdpdENsaWVudCBpbnN0YW5jZS4gKi9cbiAgY29uc3QgZ2l0ID0gYXdhaXQgQXV0aGVudGljYXRlZEdpdENsaWVudC5nZXQoKTtcblxuICByZXR1cm4gKFxuICAgIGF3YWl0IGdpdC5naXRodWIudGVhbXMubGlzdE1lbWJlcnNJbk9yZyh7XG4gICAgICBvcmc6IGdpdC5yZW1vdGVDb25maWcub3duZXIsXG4gICAgICB0ZWFtX3NsdWc6IGdyb3VwLFxuICAgIH0pXG4gICkuZGF0YVxuICAgIC5maWx0ZXIoKF8pID0+ICEhXylcbiAgICAubWFwKChtZW1iZXIpID0+IG1lbWJlciEubG9naW4pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZXRDYXJldGFrZXJHcm91cChncm91cDogc3RyaW5nLCBtZW1iZXJzOiBzdHJpbmdbXSkge1xuICAvKiogVGhlIGF1dGhlbnRpY2F0ZWQgR2l0Q2xpZW50IGluc3RhbmNlLiAqL1xuICBjb25zdCBnaXQgPSBhd2FpdCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LmdldCgpO1xuICAvKiogVGhlIGZ1bGwgbmFtZSBvZiB0aGUgZ3JvdXAgPG9yZz4vPGdyb3VwIG5hbWU+LiAqL1xuICBjb25zdCBmdWxsU2x1ZyA9IGAke2dpdC5yZW1vdGVDb25maWcub3duZXJ9LyR7Z3JvdXB9YDtcbiAgLyoqIFRoZSBsaXN0IG9mIGN1cnJlbnQgbWVtYmVycyBvZiB0aGUgZ3JvdXAuICovXG4gIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCBnZXRHcm91cE1lbWJlcnMoZ3JvdXApO1xuICAvKiogVGhlIGxpc3Qgb2YgdXNlcnMgdG8gYmUgcmVtb3ZlZCBmcm9tIHRoZSBncm91cC4gKi9cbiAgY29uc3QgcmVtb3ZlZCA9IGN1cnJlbnQuZmlsdGVyKChsb2dpbikgPT4gIW1lbWJlcnMuaW5jbHVkZXMobG9naW4pKTtcbiAgLyoqIEFkZCBhIHVzZXIgdG8gdGhlIGdyb3VwLiAqL1xuICBjb25zdCBhZGQgPSBhc3luYyAodXNlcm5hbWU6IHN0cmluZykgPT4ge1xuICAgIExvZy5kZWJ1ZyhgQWRkaW5nICR7dXNlcm5hbWV9IHRvICR7ZnVsbFNsdWd9LmApO1xuICAgIGF3YWl0IGdpdC5naXRodWIudGVhbXMuYWRkT3JVcGRhdGVNZW1iZXJzaGlwRm9yVXNlckluT3JnKHtcbiAgICAgIG9yZzogZ2l0LnJlbW90ZUNvbmZpZy5vd25lcixcbiAgICAgIHRlYW1fc2x1ZzogZ3JvdXAsXG4gICAgICB1c2VybmFtZSxcbiAgICAgIHJvbGU6ICdtYWludGFpbmVyJyxcbiAgICB9KTtcbiAgfTtcbiAgLyoqIFJlbW92ZSBhIHVzZXIgZnJvbSB0aGUgZ3JvdXAuICovXG4gIGNvbnN0IHJlbW92ZSA9IGFzeW5jICh1c2VybmFtZTogc3RyaW5nKSA9PiB7XG4gICAgTG9nLmRlYnVnKGBSZW1vdmluZyAke3VzZXJuYW1lfSBmcm9tICR7ZnVsbFNsdWd9LmApO1xuICAgIGF3YWl0IGdpdC5naXRodWIudGVhbXMucmVtb3ZlTWVtYmVyc2hpcEZvclVzZXJJbk9yZyh7XG4gICAgICBvcmc6IGdpdC5yZW1vdGVDb25maWcub3duZXIsXG4gICAgICB0ZWFtX3NsdWc6IGdyb3VwLFxuICAgICAgdXNlcm5hbWUsXG4gICAgfSk7XG4gIH07XG5cbiAgTG9nLmRlYnVnLmdyb3VwKGBDYXJldGFrZXIgR3JvdXA6ICR7ZnVsbFNsdWd9YCk7XG4gIExvZy5kZWJ1ZyhgQ3VycmVudCBNZW1iZXJzaGlwOiAke2N1cnJlbnQuam9pbignLCAnKX1gKTtcbiAgTG9nLmRlYnVnKGBOZXcgTWVtYmVyc2hpcDogICAgICR7bWVtYmVycy5qb2luKCcsICcpfWApO1xuICBMb2cuZGVidWcoYFJlbW92ZWQ6ICAgICAgICAgICAgJHtyZW1vdmVkLmpvaW4oJywgJyl9YCk7XG4gIExvZy5kZWJ1Zy5ncm91cEVuZCgpO1xuXG4gIC8vIEFkZCBtZW1iZXJzIGJlZm9yZSByZW1vdmluZyB0byBwcmV2ZW50IHRoZSBhY2NvdW50IHBlcmZvcm1pbmcgdGhlIGFjdGlvbiBmcm9tIHJlbW92aW5nIHRoZWlyXG4gIC8vIHBlcm1pc3Npb25zIHRvIGNoYW5nZSB0aGUgZ3JvdXAgbWVtYmVyc2hpcCBlYXJseS5cbiAgYXdhaXQgUHJvbWlzZS5hbGwobWVtYmVycy5tYXAoYWRkKSk7XG4gIGF3YWl0IFByb21pc2UuYWxsKHJlbW92ZWQubWFwKHJlbW92ZSkpO1xuXG4gIExvZy5kZWJ1ZyhncmVlbihgU3VjY2Vzc2Z1bGx5IHVwZGF0ZWQgJHtmdWxsU2x1Z31gKSk7XG59XG4iXX0=