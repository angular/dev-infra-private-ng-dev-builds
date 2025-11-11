import { gitLogFormatForParsing, parseCommitFromGitLog, } from '../../../commit-message/parse.js';
import { computeUniqueIdFromCommitMessage } from './unique-commit-id.js';
export function getCommitsForRangeWithDeduping(client, baseRef, headRef) {
    const commits = [];
    const commitsForHead = fetchCommitsForRevisionRange(client, `${baseRef}..${headRef}`);
    const commitsForBase = fetchCommitsForRevisionRange(client, `${headRef}..${baseRef}`);
    const knownCommitsOnlyInBase = new Map();
    for (const commit of commitsForBase) {
        const id = computeUniqueIdFromCommitMessage(commit);
        const numSimilarCommits = knownCommitsOnlyInBase.get(id) ?? 0;
        knownCommitsOnlyInBase.set(id, numSimilarCommits + 1);
    }
    for (const commit of commitsForHead) {
        const id = computeUniqueIdFromCommitMessage(commit);
        const numSimilarCommits = knownCommitsOnlyInBase.get(id) ?? 0;
        if (numSimilarCommits > 0) {
            knownCommitsOnlyInBase.set(id, numSimilarCommits - 1);
            continue;
        }
        commits.push(commit);
    }
    return commits;
}
function fetchCommitsForRevisionRange(client, revisionRange) {
    const splitDelimiter = '-------------ɵɵ------------';
    const output = client.run([
        'log',
        `--format=${gitLogFormatForParsing}${splitDelimiter}`,
        revisionRange,
    ]);
    const commits = new Map();
    output.stdout
        .split(splitDelimiter)
        .reverse()
        .forEach((entry) => {
        if (entry.trim() === '') {
            return;
        }
        const commit = parseCommitFromGitLog(Buffer.from(santizeCommitMessage(entry), 'utf-8'));
        if (commit.isRevert) {
            commits.delete(commit.originalHeader.match(/^revert:? "(.*)"/i)?.[1] || '');
        }
        else {
            commits.set(commit.header, commit);
        }
    });
    return Array.from(commits.values()).reverse();
}
function santizeCommitMessage(content) {
    return content.replace(/ (@[A-z0-9]+) /g, ' `$1` ');
}
//# sourceMappingURL=get-commits-in-range.js.map