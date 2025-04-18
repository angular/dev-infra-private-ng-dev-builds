/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { rebasePr } from './index.js';
/** Builds the rebase pull request command. */
function builder(argv) {
    return addGithubTokenOption(argv)
        .positional('pr', { type: 'number', demandOption: true })
        .option('interactive', {
        type: 'boolean',
        alias: ['i'],
        demandOption: false,
        describe: 'Do the rebase interactively so that things can be squashed and amended',
    });
}
/** Handles the rebase pull request command. */
async function handler({ pr, i }) {
    process.exitCode = await rebasePr(pr, i);
}
/** yargs command module for rebasing a PR  */
export const RebaseCommandModule = {
    handler,
    builder,
    command: 'rebase <pr>',
    describe: 'Rebase a pending PR and push the rebased commits back to Github',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL3JlYmFzZS9jbGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLG9CQUFvQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFFckUsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLFlBQVksQ0FBQztBQVFwQyw4Q0FBOEM7QUFDOUMsU0FBUyxPQUFPLENBQUMsSUFBVTtJQUN6QixPQUFPLG9CQUFvQixDQUFDLElBQUksQ0FBQztTQUM5QixVQUFVLENBQUMsSUFBSSxFQUFFLEVBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFDLENBQUM7U0FDdEQsTUFBTSxDQUFDLGFBQWEsRUFBRTtRQUNyQixJQUFJLEVBQUUsU0FBUztRQUNmLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQztRQUNaLFlBQVksRUFBRSxLQUFLO1FBQ25CLFFBQVEsRUFBRSx3RUFBd0U7S0FDbkYsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUVELCtDQUErQztBQUMvQyxLQUFLLFVBQVUsT0FBTyxDQUFDLEVBQUMsRUFBRSxFQUFFLENBQUMsRUFBMkI7SUFDdEQsT0FBTyxDQUFDLFFBQVEsR0FBRyxNQUFNLFFBQVEsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDM0MsQ0FBQztBQUVELDhDQUE4QztBQUM5QyxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBcUM7SUFDbkUsT0FBTztJQUNQLE9BQU87SUFDUCxPQUFPLEVBQUUsYUFBYTtJQUN0QixRQUFRLEVBQUUsaUVBQWlFO0NBQzVFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcblxuaW1wb3J0IHthZGRHaXRodWJUb2tlbk9wdGlvbn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi15YXJncy5qcyc7XG5cbmltcG9ydCB7cmViYXNlUHJ9IGZyb20gJy4vaW5kZXguanMnO1xuXG4vKiogVGhlIG9wdGlvbnMgYXZhaWxhYmxlIHRvIHRoZSByZWJhc2UgY29tbWFuZCB2aWEgQ0xJLiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZWJhc2VPcHRpb25zIHtcbiAgcHI6IG51bWJlcjtcbiAgaT86IGJvb2xlYW47XG59XG5cbi8qKiBCdWlsZHMgdGhlIHJlYmFzZSBwdWxsIHJlcXVlc3QgY29tbWFuZC4gKi9cbmZ1bmN0aW9uIGJ1aWxkZXIoYXJndjogQXJndik6IEFyZ3Y8UmViYXNlT3B0aW9ucz4ge1xuICByZXR1cm4gYWRkR2l0aHViVG9rZW5PcHRpb24oYXJndilcbiAgICAucG9zaXRpb25hbCgncHInLCB7dHlwZTogJ251bWJlcicsIGRlbWFuZE9wdGlvbjogdHJ1ZX0pXG4gICAgLm9wdGlvbignaW50ZXJhY3RpdmUnLCB7XG4gICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICBhbGlhczogWydpJ10sXG4gICAgICBkZW1hbmRPcHRpb246IGZhbHNlLFxuICAgICAgZGVzY3JpYmU6ICdEbyB0aGUgcmViYXNlIGludGVyYWN0aXZlbHkgc28gdGhhdCB0aGluZ3MgY2FuIGJlIHNxdWFzaGVkIGFuZCBhbWVuZGVkJyxcbiAgICB9KTtcbn1cblxuLyoqIEhhbmRsZXMgdGhlIHJlYmFzZSBwdWxsIHJlcXVlc3QgY29tbWFuZC4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoe3ByLCBpfTogQXJndW1lbnRzPFJlYmFzZU9wdGlvbnM+KSB7XG4gIHByb2Nlc3MuZXhpdENvZGUgPSBhd2FpdCByZWJhc2VQcihwciwgaSk7XG59XG5cbi8qKiB5YXJncyBjb21tYW5kIG1vZHVsZSBmb3IgcmViYXNpbmcgYSBQUiAgKi9cbmV4cG9ydCBjb25zdCBSZWJhc2VDb21tYW5kTW9kdWxlOiBDb21tYW5kTW9kdWxlPHt9LCBSZWJhc2VPcHRpb25zPiA9IHtcbiAgaGFuZGxlcixcbiAgYnVpbGRlcixcbiAgY29tbWFuZDogJ3JlYmFzZSA8cHI+JyxcbiAgZGVzY3JpYmU6ICdSZWJhc2UgYSBwZW5kaW5nIFBSIGFuZCBwdXNoIHRoZSByZWJhc2VkIGNvbW1pdHMgYmFjayB0byBHaXRodWInLFxufTtcbiJdfQ==