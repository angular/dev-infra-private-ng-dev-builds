/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertValidGithubConfig, getConfig } from '../../utils/config.js';
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { checkoutPullRequest } from './checkout.js';
/** Builds the checkout pull request command. */
function builder(yargs) {
    return addGithubTokenOption(yargs)
        .positional('pr', {
        type: 'number',
        demandOption: true,
        describe: 'The pull request number for the pull request to checkout',
    })
        .option('takeover', {
        type: 'boolean',
        demandOption: false,
        describe: 'Check out the pull request to perform a takeover',
    })
        .option('target', {
        type: 'string',
        demandOption: false,
        describe: 'Check out the pull request targeting the specified base branch',
    });
}
/** Handles the checkout pull request command. */
async function handler({ pr, takeover, target }) {
    const config = await getConfig();
    assertValidGithubConfig(config);
    await checkoutPullRequest({ pr, takeover, target }, config);
}
/** yargs command module for checking out a PR  */
export const CheckoutCommandModule = {
    handler,
    builder,
    command: 'checkout <pr>',
    describe: 'Checkout a PR from the upstream repo',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NoZWNrb3V0L2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEVBQUMsdUJBQXVCLEVBQUUsU0FBUyxFQUE0QixNQUFNLHVCQUF1QixDQUFDO0FBQ3BHLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3JFLE9BQU8sRUFBQyxtQkFBbUIsRUFBNEIsTUFBTSxlQUFlLENBQUM7QUFFN0UsZ0RBQWdEO0FBQ2hELFNBQVMsT0FBTyxDQUFDLEtBQVc7SUFDMUIsT0FBTyxvQkFBb0IsQ0FBQyxLQUFLLENBQUM7U0FDL0IsVUFBVSxDQUFDLElBQUksRUFBRTtRQUNoQixJQUFJLEVBQUUsUUFBUTtRQUNkLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFFBQVEsRUFBRSwwREFBMEQ7S0FDckUsQ0FBQztTQUNELE1BQU0sQ0FBQyxVQUFVLEVBQUU7UUFDbEIsSUFBSSxFQUFFLFNBQVM7UUFDZixZQUFZLEVBQUUsS0FBSztRQUNuQixRQUFRLEVBQUUsa0RBQWtEO0tBQzdELENBQUM7U0FDRCxNQUFNLENBQUMsUUFBUSxFQUFFO1FBQ2hCLElBQUksRUFBRSxRQUFRO1FBQ2QsWUFBWSxFQUFFLEtBQUs7UUFDbkIsUUFBUSxFQUFFLGdFQUFnRTtLQUMzRSxDQUFDLENBQUM7QUFDUCxDQUFDO0FBRUQsaURBQWlEO0FBQ2pELEtBQUssVUFBVSxPQUFPLENBQUMsRUFBQyxFQUFFLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBdUM7SUFDakYsTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLEVBQUUsQ0FBQztJQUNqQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVoQyxNQUFNLG1CQUFtQixDQUFDLEVBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUM1RCxDQUFDO0FBRUQsa0RBQWtEO0FBQ2xELE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFpRDtJQUNqRixPQUFPO0lBQ1AsT0FBTztJQUNQLE9BQU8sRUFBRSxlQUFlO0lBQ3hCLFFBQVEsRUFBRSxzQ0FBc0M7Q0FDakQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FyZ3YsIEFyZ3VtZW50cywgQ29tbWFuZE1vZHVsZX0gZnJvbSAneWFyZ3MnO1xuXG5pbXBvcnQge2Fzc2VydFZhbGlkR2l0aHViQ29uZmlnLCBnZXRDb25maWcsIEdpdGh1YkNvbmZpZywgTmdEZXZDb25maWd9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5pbXBvcnQge2FkZEdpdGh1YlRva2VuT3B0aW9ufSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLXlhcmdzLmpzJztcbmltcG9ydCB7Y2hlY2tvdXRQdWxsUmVxdWVzdCwgQ2hlY2tvdXRQdWxsUmVxdWVzdFBhcmFtc30gZnJvbSAnLi9jaGVja291dC5qcyc7XG5cbi8qKiBCdWlsZHMgdGhlIGNoZWNrb3V0IHB1bGwgcmVxdWVzdCBjb21tYW5kLiAqL1xuZnVuY3Rpb24gYnVpbGRlcih5YXJnczogQXJndikge1xuICByZXR1cm4gYWRkR2l0aHViVG9rZW5PcHRpb24oeWFyZ3MpXG4gICAgLnBvc2l0aW9uYWwoJ3ByJywge1xuICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICBkZW1hbmRPcHRpb246IHRydWUsXG4gICAgICBkZXNjcmliZTogJ1RoZSBwdWxsIHJlcXVlc3QgbnVtYmVyIGZvciB0aGUgcHVsbCByZXF1ZXN0IHRvIGNoZWNrb3V0JyxcbiAgICB9KVxuICAgIC5vcHRpb24oJ3Rha2VvdmVyJywge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVtYW5kT3B0aW9uOiBmYWxzZSxcbiAgICAgIGRlc2NyaWJlOiAnQ2hlY2sgb3V0IHRoZSBwdWxsIHJlcXVlc3QgdG8gcGVyZm9ybSBhIHRha2VvdmVyJyxcbiAgICB9KVxuICAgIC5vcHRpb24oJ3RhcmdldCcsIHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgZGVtYW5kT3B0aW9uOiBmYWxzZSxcbiAgICAgIGRlc2NyaWJlOiAnQ2hlY2sgb3V0IHRoZSBwdWxsIHJlcXVlc3QgdGFyZ2V0aW5nIHRoZSBzcGVjaWZpZWQgYmFzZSBicmFuY2gnLFxuICAgIH0pO1xufVxuXG4vKiogSGFuZGxlcyB0aGUgY2hlY2tvdXQgcHVsbCByZXF1ZXN0IGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKHtwciwgdGFrZW92ZXIsIHRhcmdldH06IEFyZ3VtZW50czxDaGVja291dFB1bGxSZXF1ZXN0UGFyYW1zPikge1xuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoKTtcbiAgYXNzZXJ0VmFsaWRHaXRodWJDb25maWcoY29uZmlnKTtcblxuICBhd2FpdCBjaGVja291dFB1bGxSZXF1ZXN0KHtwciwgdGFrZW92ZXIsIHRhcmdldH0sIGNvbmZpZyk7XG59XG5cbi8qKiB5YXJncyBjb21tYW5kIG1vZHVsZSBmb3IgY2hlY2tpbmcgb3V0IGEgUFIgICovXG5leHBvcnQgY29uc3QgQ2hlY2tvdXRDb21tYW5kTW9kdWxlOiBDb21tYW5kTW9kdWxlPHt9LCBDaGVja291dFB1bGxSZXF1ZXN0UGFyYW1zPiA9IHtcbiAgaGFuZGxlcixcbiAgYnVpbGRlcixcbiAgY29tbWFuZDogJ2NoZWNrb3V0IDxwcj4nLFxuICBkZXNjcmliZTogJ0NoZWNrb3V0IGEgUFIgZnJvbSB0aGUgdXBzdHJlYW0gcmVwbycsXG59O1xuIl19