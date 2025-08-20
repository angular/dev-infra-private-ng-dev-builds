import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MergeStrategy, TEMP_PR_HEAD_BRANCH } from './strategy.js';
import { MergeConflictsFatalError } from '../failures.js';
export class AutosquashMergeStrategy extends MergeStrategy {
    async merge(pullRequest) {
        const { githubTargetBranch, targetBranches, revisionRange, needsCommitMessageFixup, baseSha, prNumber, } = pullRequest;
        const branchOrRevisionBeforeRebase = this.git.getCurrentBranchOrRevision();
        const rebaseEnv = needsCommitMessageFixup
            ? undefined
            : { ...process.env, GIT_SEQUENCE_EDITOR: 'true' };
        this.git.run(['rebase', '--interactive', '--autosquash', baseSha, TEMP_PR_HEAD_BRANCH], {
            stdio: 'inherit',
            env: rebaseEnv,
        });
        this.git.run(['checkout', '-f', branchOrRevisionBeforeRebase]);
        this.git.run([
            'filter-branch',
            '-f',
            '--msg-filter',
            `${getCommitMessageFilterScriptPath()} ${prNumber}`,
            revisionRange,
        ]);
        const failedBranches = this.cherryPickIntoTargetBranches(revisionRange, targetBranches);
        if (failedBranches.length) {
            throw new MergeConflictsFatalError(failedBranches);
        }
        this.pushTargetBranchesUpstream(targetBranches);
        const banchesAndSha = targetBranches.map((targetBranch) => {
            const localBranch = this.getLocalTargetBranchName(targetBranch);
            const sha = this.git.run(['rev-parse', localBranch]).stdout.trim();
            return [targetBranch, sha];
        });
        await new Promise((resolve) => setTimeout(resolve, parseInt(process.env['AUTOSQUASH_TIMEOUT'] || '0')));
        await this.git.github.issues.createComment({
            ...this.git.remoteParams,
            issue_number: pullRequest.prNumber,
            body: 'This PR was merged into the repository. ' +
                'The changes were merged into the following branches:\n\n' +
                `${banchesAndSha.map(([branch, sha]) => `- ${branch}: ${sha}`).join('\n')}`,
        });
        if (githubTargetBranch !== this.git.mainBranchName) {
            await this.git.github.pulls.update({
                ...this.git.remoteParams,
                pull_number: pullRequest.prNumber,
                state: 'closed',
            });
        }
    }
}
function getCommitMessageFilterScriptPath() {
    const bundlesDir = dirname(fileURLToPath(import.meta.url));
    return join(bundlesDir, './pr/merge/strategies/commit-message-filter.mjs');
}
//# sourceMappingURL=autosquash-merge.js.map