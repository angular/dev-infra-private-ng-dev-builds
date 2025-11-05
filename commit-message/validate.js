import { getConfig } from '../utils/config.js';
import { Log } from '../utils/logging.js';
import { assertValidCommitMessageConfig, COMMIT_TYPES, ScopeRequirement } from './config.js';
import { parseCommitMessage } from './parse.js';
const COMMIT_BODY_URL_LINE_RE = /^https?:\/\/.*$/;
const INCORRECT_BREAKING_CHANGE_BODY_RE = /^(BREAKING CHANGE[^:]|BREAKING-CHANGE|BREAKING[ -]CHANGES)/m;
const INCORRECT_DEPRECATION_BODY_RE = /^(DEPRECATED[^:]|DEPRECATIONS?|DEPRECATE:|DEPRECATES)/m;
export async function validateCommitMessage(commitMsg, options = {}) {
    const _config = await getConfig();
    assertValidCommitMessageConfig(_config);
    const config = _config.commitMessage;
    const commit = typeof commitMsg === 'string' ? parseCommitMessage(commitMsg) : commitMsg;
    const errors = [];
    function validateCommitAndCollectErrors() {
        if (commit.isRevert) {
            return true;
        }
        if (commit.isSquash) {
            if (options.disallowSquash) {
                errors.push('The commit must be manually squashed into the target commit');
                return false;
            }
            return true;
        }
        if (commit.isFixup) {
            if (config.disallowFixup) {
                errors.push('The commit must be manually fixed-up into the target commit as fixup commits are disallowed');
                return false;
            }
            if (options.nonFixupCommitHeaders && !options.nonFixupCommitHeaders.includes(commit.header)) {
                errors.push('Unable to find match for fixup commit among prior commits: ' +
                    (options.nonFixupCommitHeaders.map((x) => `\n      ${x}`).join('') || '-'));
                return false;
            }
            return true;
        }
        if (commit.header.length > config.maxLineLength) {
            errors.push(`The commit message header is longer than ${config.maxLineLength} characters`);
            return false;
        }
        if (!commit.type) {
            errors.push(`The commit message header does not match the expected format.`);
            return false;
        }
        if (COMMIT_TYPES[commit.type] === undefined) {
            errors.push(`'${commit.type}' is not an allowed type.\n => TYPES: ${Object.keys(COMMIT_TYPES).join(', ')}`);
            return false;
        }
        const scopeRequirementForType = COMMIT_TYPES[commit.type].scope;
        if (scopeRequirementForType === ScopeRequirement.Forbidden && commit.scope) {
            errors.push(`Scopes are forbidden for commits with type '${commit.type}', but a scope of '${commit.scope}' was provided.`);
            return false;
        }
        if (scopeRequirementForType === ScopeRequirement.Required && !commit.scope) {
            errors.push(`Scopes are required for commits with type '${commit.type}', but no scope was provided.`);
            return false;
        }
        if (commit.scope && !config.scopes.includes(commit.scope)) {
            errors.push(`'${commit.scope}' is not an allowed scope.\n => SCOPES: ${config.scopes.join(', ')}`);
            return false;
        }
        if (commit.type === 'release') {
            return true;
        }
        const allNonHeaderContent = `${commit.body.trim()}\n${commit.footer.trim()}`;
        if (!config.minBodyLengthTypeExcludes?.includes(commit.type) &&
            allNonHeaderContent.length < config.minBodyLength) {
            errors.push(`The commit message body does not meet the minimum length of ${config.minBodyLength} characters`);
            return false;
        }
        const bodyByLine = commit.body.split('\n');
        const lineExceedsMaxLength = bodyByLine.some((line) => {
            return line.length > config.maxLineLength && !COMMIT_BODY_URL_LINE_RE.test(line);
        });
        if (lineExceedsMaxLength) {
            errors.push(`The commit message body contains lines greater than ${config.maxLineLength} characters.`);
            return false;
        }
        if (INCORRECT_BREAKING_CHANGE_BODY_RE.test(commit.fullText)) {
            errors.push(`The commit message body contains an invalid breaking change note.`);
            return false;
        }
        if (INCORRECT_DEPRECATION_BODY_RE.test(commit.fullText)) {
            errors.push(`The commit message body contains an invalid deprecation note.`);
            return false;
        }
        return true;
    }
    return { valid: validateCommitAndCollectErrors(), errors, commit };
}
export function printValidationErrors(errors, print = Log.error) {
    print(`Error${errors.length === 1 ? '' : 's'}:`);
    errors.forEach((line) => print(line));
    print();
    print('The expected format for a commit is: ');
    print('<type>(<scope>): <summary>');
    print();
    print('<body>');
    print();
    print(`BREAKING CHANGE: <breaking change summary>`);
    print();
    print(`<breaking change description>`);
    print();
    print(`DEPRECATED: <deprecation summary>`);
    print();
    print(`<deprecation description>`);
    print();
    print();
}
//# sourceMappingURL=validate.js.map