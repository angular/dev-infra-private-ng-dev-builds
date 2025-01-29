/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
    await checkoutPullRequest({ pr, takeover, target });
}
/** yargs command module for checking out a PR  */
export const CheckoutCommandModule = {
    handler,
    builder,
    command: 'checkout <pr>',
    describe: 'Checkout a PR from the upstream repo',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NoZWNrb3V0L2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUNyRSxPQUFPLEVBQUMsbUJBQW1CLEVBQTRCLE1BQU0sZUFBZSxDQUFDO0FBRTdFLGdEQUFnRDtBQUNoRCxTQUFTLE9BQU8sQ0FBQyxLQUFXO0lBQzFCLE9BQU8sb0JBQW9CLENBQUMsS0FBSyxDQUFDO1NBQy9CLFVBQVUsQ0FBQyxJQUFJLEVBQUU7UUFDaEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxZQUFZLEVBQUUsSUFBSTtRQUNsQixRQUFRLEVBQUUsMERBQTBEO0tBQ3JFLENBQUM7U0FDRCxNQUFNLENBQUMsVUFBVSxFQUFFO1FBQ2xCLElBQUksRUFBRSxTQUFTO1FBQ2YsWUFBWSxFQUFFLEtBQUs7UUFDbkIsUUFBUSxFQUFFLGtEQUFrRDtLQUM3RCxDQUFDO1NBQ0QsTUFBTSxDQUFDLFFBQVEsRUFBRTtRQUNoQixJQUFJLEVBQUUsUUFBUTtRQUNkLFlBQVksRUFBRSxLQUFLO1FBQ25CLFFBQVEsRUFBRSxnRUFBZ0U7S0FDM0UsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUVELGlEQUFpRDtBQUNqRCxLQUFLLFVBQVUsT0FBTyxDQUFDLEVBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQXVDO0lBQ2pGLE1BQU0sbUJBQW1CLENBQUMsRUFBQyxFQUFFLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7QUFDcEQsQ0FBQztBQUVELGtEQUFrRDtBQUNsRCxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBaUQ7SUFDakYsT0FBTztJQUNQLE9BQU87SUFDUCxPQUFPLEVBQUUsZUFBZTtJQUN4QixRQUFRLEVBQUUsc0NBQXNDO0NBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcblxuaW1wb3J0IHthZGRHaXRodWJUb2tlbk9wdGlvbn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi15YXJncy5qcyc7XG5pbXBvcnQge2NoZWNrb3V0UHVsbFJlcXVlc3QsIENoZWNrb3V0UHVsbFJlcXVlc3RQYXJhbXN9IGZyb20gJy4vY2hlY2tvdXQuanMnO1xuXG4vKiogQnVpbGRzIHRoZSBjaGVja291dCBwdWxsIHJlcXVlc3QgY29tbWFuZC4gKi9cbmZ1bmN0aW9uIGJ1aWxkZXIoeWFyZ3M6IEFyZ3YpIHtcbiAgcmV0dXJuIGFkZEdpdGh1YlRva2VuT3B0aW9uKHlhcmdzKVxuICAgIC5wb3NpdGlvbmFsKCdwcicsIHtcbiAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgZGVtYW5kT3B0aW9uOiB0cnVlLFxuICAgICAgZGVzY3JpYmU6ICdUaGUgcHVsbCByZXF1ZXN0IG51bWJlciBmb3IgdGhlIHB1bGwgcmVxdWVzdCB0byBjaGVja291dCcsXG4gICAgfSlcbiAgICAub3B0aW9uKCd0YWtlb3ZlcicsIHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlbWFuZE9wdGlvbjogZmFsc2UsXG4gICAgICBkZXNjcmliZTogJ0NoZWNrIG91dCB0aGUgcHVsbCByZXF1ZXN0IHRvIHBlcmZvcm0gYSB0YWtlb3ZlcicsXG4gICAgfSlcbiAgICAub3B0aW9uKCd0YXJnZXQnLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGRlbWFuZE9wdGlvbjogZmFsc2UsXG4gICAgICBkZXNjcmliZTogJ0NoZWNrIG91dCB0aGUgcHVsbCByZXF1ZXN0IHRhcmdldGluZyB0aGUgc3BlY2lmaWVkIGJhc2UgYnJhbmNoJyxcbiAgICB9KTtcbn1cblxuLyoqIEhhbmRsZXMgdGhlIGNoZWNrb3V0IHB1bGwgcmVxdWVzdCBjb21tYW5kLiAqL1xuYXN5bmMgZnVuY3Rpb24gaGFuZGxlcih7cHIsIHRha2VvdmVyLCB0YXJnZXR9OiBBcmd1bWVudHM8Q2hlY2tvdXRQdWxsUmVxdWVzdFBhcmFtcz4pIHtcbiAgYXdhaXQgY2hlY2tvdXRQdWxsUmVxdWVzdCh7cHIsIHRha2VvdmVyLCB0YXJnZXR9KTtcbn1cblxuLyoqIHlhcmdzIGNvbW1hbmQgbW9kdWxlIGZvciBjaGVja2luZyBvdXQgYSBQUiAgKi9cbmV4cG9ydCBjb25zdCBDaGVja291dENvbW1hbmRNb2R1bGU6IENvbW1hbmRNb2R1bGU8e30sIENoZWNrb3V0UHVsbFJlcXVlc3RQYXJhbXM+ID0ge1xuICBoYW5kbGVyLFxuICBidWlsZGVyLFxuICBjb21tYW5kOiAnY2hlY2tvdXQgPHByPicsXG4gIGRlc2NyaWJlOiAnQ2hlY2tvdXQgYSBQUiBmcm9tIHRoZSB1cHN0cmVhbSByZXBvJyxcbn07XG4iXX0=