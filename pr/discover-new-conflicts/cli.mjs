/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Log } from '../../utils/logging.js';
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { discoverNewConflictsForPr } from './index.js';
/** Builds the discover-new-conflicts pull request command. */
function builder(argv) {
    return addGithubTokenOption(argv)
        .option('date', {
        description: 'Only consider PRs updated since provided date',
        defaultDescription: '30 days ago',
        coerce: (date) => (typeof date === 'number' ? date : Date.parse(date)),
        default: getThirtyDaysAgoDate(),
    })
        .positional('pr', { demandOption: true, type: 'number' });
}
/** Handles the discover-new-conflicts pull request command. */
async function handler({ pr, date }) {
    // If a provided date is not able to be parsed, yargs provides it as NaN.
    if (isNaN(date)) {
        Log.error('Unable to parse the value provided via --date flag');
        process.exit(1);
    }
    await discoverNewConflictsForPr(pr, date);
}
/** Gets a date object 30 days ago from today. */
function getThirtyDaysAgoDate() {
    const date = new Date();
    // Set the hours, minutes and seconds to 0 to only consider date.
    date.setHours(0, 0, 0, 0);
    // Set the date to 30 days in the past.
    date.setDate(date.getDate() - 30);
    return date.getTime();
}
/** yargs command module for discovering new conflicts for a PR  */
export const DiscoverNewConflictsCommandModule = {
    handler,
    builder,
    command: 'discover-new-conflicts <pr>',
    describe: 'Check if a pending PR causes new conflicts for other pending PRs',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2Rpc2NvdmVyLW5ldy1jb25mbGljdHMvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUVyRSxPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFRckQsOERBQThEO0FBQzlELFNBQVMsT0FBTyxDQUFDLElBQVU7SUFDekIsT0FBTyxvQkFBb0IsQ0FBQyxJQUFJLENBQUM7U0FDOUIsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNkLFdBQVcsRUFBRSwrQ0FBK0M7UUFDNUQsa0JBQWtCLEVBQUUsYUFBYTtRQUNqQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFO0tBQ2hDLENBQUM7U0FDRCxVQUFVLENBQUMsSUFBSSxFQUFFLEVBQUMsWUFBWSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztBQUM1RCxDQUFDO0FBRUQsK0RBQStEO0FBQy9ELEtBQUssVUFBVSxPQUFPLENBQUMsRUFBQyxFQUFFLEVBQUUsSUFBSSxFQUF5QztJQUN2RSx5RUFBeUU7SUFDekUsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNoQixHQUFHLENBQUMsS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7UUFDaEUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQixDQUFDO0lBQ0QsTUFBTSx5QkFBeUIsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVELGlEQUFpRDtBQUNqRCxTQUFTLG9CQUFvQjtJQUMzQixNQUFNLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3hCLGlFQUFpRTtJQUNqRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzFCLHVDQUF1QztJQUN2QyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNsQyxPQUFPLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN4QixDQUFDO0FBRUQsbUVBQW1FO0FBQ25FLE1BQU0sQ0FBQyxNQUFNLGlDQUFpQyxHQUFtRDtJQUMvRixPQUFPO0lBQ1AsT0FBTztJQUNQLE9BQU8sRUFBRSw2QkFBNkI7SUFDdEMsUUFBUSxFQUFFLGtFQUFrRTtDQUM3RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXJndiwgQXJndW1lbnRzLCBDb21tYW5kTW9kdWxlfSBmcm9tICd5YXJncyc7XG5cbmltcG9ydCB7TG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7YWRkR2l0aHViVG9rZW5PcHRpb259IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWIteWFyZ3MuanMnO1xuXG5pbXBvcnQge2Rpc2NvdmVyTmV3Q29uZmxpY3RzRm9yUHJ9IGZyb20gJy4vaW5kZXguanMnO1xuXG4vKiogVGhlIG9wdGlvbnMgYXZhaWxhYmxlIHRvIHRoZSBkaXNjb3Zlci1uZXctY29uZmxpY3RzIGNvbW1hbmQgdmlhIENMSS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlzY292ZXJOZXdDb25mbGljdHNPcHRpb25zIHtcbiAgZGF0ZTogbnVtYmVyO1xuICBwcjogbnVtYmVyO1xufVxuXG4vKiogQnVpbGRzIHRoZSBkaXNjb3Zlci1uZXctY29uZmxpY3RzIHB1bGwgcmVxdWVzdCBjb21tYW5kLiAqL1xuZnVuY3Rpb24gYnVpbGRlcihhcmd2OiBBcmd2KTogQXJndjxEaXNjb3Zlck5ld0NvbmZsaWN0c09wdGlvbnM+IHtcbiAgcmV0dXJuIGFkZEdpdGh1YlRva2VuT3B0aW9uKGFyZ3YpXG4gICAgLm9wdGlvbignZGF0ZScsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnT25seSBjb25zaWRlciBQUnMgdXBkYXRlZCBzaW5jZSBwcm92aWRlZCBkYXRlJyxcbiAgICAgIGRlZmF1bHREZXNjcmlwdGlvbjogJzMwIGRheXMgYWdvJyxcbiAgICAgIGNvZXJjZTogKGRhdGUpID0+ICh0eXBlb2YgZGF0ZSA9PT0gJ251bWJlcicgPyBkYXRlIDogRGF0ZS5wYXJzZShkYXRlKSksXG4gICAgICBkZWZhdWx0OiBnZXRUaGlydHlEYXlzQWdvRGF0ZSgpLFxuICAgIH0pXG4gICAgLnBvc2l0aW9uYWwoJ3ByJywge2RlbWFuZE9wdGlvbjogdHJ1ZSwgdHlwZTogJ251bWJlcid9KTtcbn1cblxuLyoqIEhhbmRsZXMgdGhlIGRpc2NvdmVyLW5ldy1jb25mbGljdHMgcHVsbCByZXF1ZXN0IGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKHtwciwgZGF0ZX06IEFyZ3VtZW50czxEaXNjb3Zlck5ld0NvbmZsaWN0c09wdGlvbnM+KSB7XG4gIC8vIElmIGEgcHJvdmlkZWQgZGF0ZSBpcyBub3QgYWJsZSB0byBiZSBwYXJzZWQsIHlhcmdzIHByb3ZpZGVzIGl0IGFzIE5hTi5cbiAgaWYgKGlzTmFOKGRhdGUpKSB7XG4gICAgTG9nLmVycm9yKCdVbmFibGUgdG8gcGFyc2UgdGhlIHZhbHVlIHByb3ZpZGVkIHZpYSAtLWRhdGUgZmxhZycpO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxuICBhd2FpdCBkaXNjb3Zlck5ld0NvbmZsaWN0c0ZvclByKHByLCBkYXRlKTtcbn1cblxuLyoqIEdldHMgYSBkYXRlIG9iamVjdCAzMCBkYXlzIGFnbyBmcm9tIHRvZGF5LiAqL1xuZnVuY3Rpb24gZ2V0VGhpcnR5RGF5c0Fnb0RhdGUoKSB7XG4gIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSgpO1xuICAvLyBTZXQgdGhlIGhvdXJzLCBtaW51dGVzIGFuZCBzZWNvbmRzIHRvIDAgdG8gb25seSBjb25zaWRlciBkYXRlLlxuICBkYXRlLnNldEhvdXJzKDAsIDAsIDAsIDApO1xuICAvLyBTZXQgdGhlIGRhdGUgdG8gMzAgZGF5cyBpbiB0aGUgcGFzdC5cbiAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gMzApO1xuICByZXR1cm4gZGF0ZS5nZXRUaW1lKCk7XG59XG5cbi8qKiB5YXJncyBjb21tYW5kIG1vZHVsZSBmb3IgZGlzY292ZXJpbmcgbmV3IGNvbmZsaWN0cyBmb3IgYSBQUiAgKi9cbmV4cG9ydCBjb25zdCBEaXNjb3Zlck5ld0NvbmZsaWN0c0NvbW1hbmRNb2R1bGU6IENvbW1hbmRNb2R1bGU8e30sIERpc2NvdmVyTmV3Q29uZmxpY3RzT3B0aW9ucz4gPSB7XG4gIGhhbmRsZXIsXG4gIGJ1aWxkZXIsXG4gIGNvbW1hbmQ6ICdkaXNjb3Zlci1uZXctY29uZmxpY3RzIDxwcj4nLFxuICBkZXNjcmliZTogJ0NoZWNrIGlmIGEgcGVuZGluZyBQUiBjYXVzZXMgbmV3IGNvbmZsaWN0cyBmb3Igb3RoZXIgcGVuZGluZyBQUnMnLFxufTtcbiJdfQ==