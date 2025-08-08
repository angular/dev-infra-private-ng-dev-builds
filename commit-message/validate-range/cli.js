import { Log } from '../../utils/logging.js';
import { validateCommitRange } from './validate-range.js';
function builder(argv) {
    return argv
        .positional('startingRef', {
        description: 'The first ref in the range to select',
        type: 'string',
        demandOption: true,
    })
        .positional('endingRef', {
        description: 'The last ref in the range to select',
        type: 'string',
        default: 'HEAD',
    });
}
async function handler({ startingRef, endingRef }) {
    if (process.env['CI'] && process.env['CI_PULL_REQUEST'] === 'false') {
        Log.info(`Since valid commit messages are enforced by PR linting on CI, we do not`);
        Log.info(`need to validate commit messages on CI runs on upstream branches.`);
        Log.info();
        Log.info(`Skipping check of provided commit range`);
        return;
    }
    await validateCommitRange(startingRef, endingRef);
}
export const ValidateRangeModule = {
    handler,
    builder,
    command: 'validate-range <starting-ref> [ending-ref]',
    describe: 'Validate a range of commit messages',
};
//# sourceMappingURL=cli.js.map