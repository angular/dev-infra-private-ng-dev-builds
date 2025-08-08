import gitCommits from 'git-raw-commits';
import { gitLogFormatForParsing, parseCommitFromGitLog } from './parse.js';
export function getCommitsInRange(from, to = 'HEAD') {
    return new Promise((resolve, reject) => {
        const commits = [];
        const commitStream = gitCommits({ from, to, format: gitLogFormatForParsing });
        commitStream.on('data', (commit) => commits.push(parseCommitFromGitLog(commit)));
        commitStream.on('error', (err) => reject(err));
        commitStream.on('end', () => resolve(commits));
    });
}
//# sourceMappingURL=utils.js.map