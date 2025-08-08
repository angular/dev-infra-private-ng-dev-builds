import { green, Log } from '../../utils/logging.js';
import { getCommitsInRange } from '../utils.js';
import { printValidationErrors, validateCommitMessage, } from '../validate.js';
const isNonFixup = (commit) => !commit.isFixup;
const extractCommitHeader = (commit) => commit.header;
export async function validateCommitRange(from, to) {
    const errors = [];
    const commits = await getCommitsInRange(from, to);
    Log.info(`Examining ${commits.length} commit(s) in the provided range: ${from}..${to}`);
    let allCommitsInRangeValid = true;
    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const options = {
            disallowSquash: true,
            nonFixupCommitHeaders: isNonFixup(commit)
                ? undefined
                : commits
                    .slice(i + 1)
                    .filter(isNonFixup)
                    .map(extractCommitHeader),
        };
        const { valid, errors: localErrors } = await validateCommitMessage(commit, options);
        if (localErrors.length) {
            errors.push([commit.header, localErrors]);
        }
        allCommitsInRangeValid = allCommitsInRangeValid && valid;
    }
    if (allCommitsInRangeValid) {
        Log.info(green('✔  All commit messages in range valid.'));
    }
    else {
        Log.error('✘  Invalid commit message');
        errors.forEach(([header, validationErrors]) => {
            Log.error.group(header);
            printValidationErrors(validationErrors);
            Log.error.groupEnd();
        });
        process.exit(1);
    }
}
//# sourceMappingURL=validate-range.js.map