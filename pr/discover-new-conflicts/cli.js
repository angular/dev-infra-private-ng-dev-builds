import { Log } from '../../utils/logging.js';
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { discoverNewConflictsForPr } from './index.js';
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
async function handler({ pr, date }) {
    if (isNaN(date)) {
        Log.error('Unable to parse the value provided via --date flag');
        process.exit(1);
    }
    await discoverNewConflictsForPr(pr, date);
}
function getThirtyDaysAgoDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 30);
    return date.getTime();
}
export const DiscoverNewConflictsCommandModule = {
    handler,
    builder,
    command: 'discover-new-conflicts <pr>',
    describe: 'Check if a pending PR causes new conflicts for other pending PRs',
};
//# sourceMappingURL=cli.js.map