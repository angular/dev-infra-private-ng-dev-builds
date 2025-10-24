import { FatalMergeToolError, MergeConflictsFatalError, MismatchedTargetBranchFatalError, UnsatisfiedBaseShaFatalError, } from '../failures.js';
export const TEMP_PR_HEAD_BRANCH = 'merge_pr_head';
export class MergeStrategy {
    constructor(git) {
        this.git = git;
    }
    async prepare(pullRequest) {
        this.fetchTargetBranches(pullRequest.targetBranches, `pull/${pullRequest.prNumber}/head:${TEMP_PR_HEAD_BRANCH}`);
    }
    async check(pullRequest) {
        const { githubTargetBranch, targetBranches, requiredBaseSha } = pullRequest;
        if (targetBranches.every((t) => t !== githubTargetBranch)) {
            throw new MismatchedTargetBranchFatalError(targetBranches);
        }
        if (requiredBaseSha && !this.git.hasCommit(TEMP_PR_HEAD_BRANCH, requiredBaseSha)) {
            throw new UnsatisfiedBaseShaFatalError();
        }
        await this._assertMergeableOrThrow(pullRequest, targetBranches);
    }
    async cleanup(pullRequest) {
        pullRequest.targetBranches.forEach((branchName) => this.git.run(['branch', '-D', this.getLocalTargetBranchName(branchName)]));
        this.git.run(['branch', '-D', TEMP_PR_HEAD_BRANCH]);
    }
    getLocalTargetBranchName(targetBranch) {
        return `merge_pr_target_${targetBranch.replace(/\//g, '_')}`;
    }
    cherryPickIntoTargetBranches(revisionRange, targetBranches, options = {}) {
        const cherryPickArgs = [revisionRange];
        const failedBranches = [];
        const revisionCountOutput = this.git.run(['rev-list', '--count', revisionRange]);
        const revisionCount = Number(revisionCountOutput.stdout.trim());
        if (isNaN(revisionCount)) {
            throw new FatalMergeToolError('Unexpected revision range for cherry-picking. No commit count could be determined.');
        }
        if (options.linkToOriginalCommits) {
            cherryPickArgs.push('-x');
        }
        for (const branchName of targetBranches) {
            const localTargetBranch = this.getLocalTargetBranchName(branchName);
            this.git.run(['checkout', localTargetBranch]);
            const cherryPickResult = this.git.runGraceful(['cherry-pick', ...cherryPickArgs]);
            if (cherryPickResult.status !== 0) {
                this.git.runGraceful(['cherry-pick', '--abort']);
                failedBranches.push(branchName);
            }
            if (options.dryRun) {
                this.git.run(['reset', '--hard', `HEAD~${revisionCount}`]);
            }
        }
        return failedBranches;
    }
    fetchTargetBranches(names, ...extraRefspecs) {
        const fetchRefspecs = names.map((targetBranch) => {
            const localTargetBranch = this.getLocalTargetBranchName(targetBranch);
            return `refs/heads/${targetBranch}:${localTargetBranch}`;
        });
        this.git.run([
            'fetch',
            '-q',
            '-f',
            this.git.getRepoGitUrl(),
            ...fetchRefspecs,
            ...extraRefspecs,
        ]);
    }
    pushTargetBranchesUpstream(names) {
        const pushRefspecs = names.map((targetBranch) => {
            const localTargetBranch = this.getLocalTargetBranchName(targetBranch);
            return `${localTargetBranch}:refs/heads/${targetBranch}`;
        });
        this.git.run(['push', '--atomic', this.git.getRepoGitUrl(), ...pushRefspecs]);
    }
    async _assertMergeableOrThrow({ revisionRange }, targetBranches) {
        const failedBranches = this.cherryPickIntoTargetBranches(revisionRange, targetBranches, {
            dryRun: true,
        });
        if (failedBranches.length) {
            throw new MergeConflictsFatalError(failedBranches);
        }
    }
    async createMergeComment(pullRequest, targetBranches) {
        const banchesAndSha = targetBranches.map((targetBranch) => {
            const localBranch = this.getLocalTargetBranchName(targetBranch);
            const sha = this.git.run(['rev-parse', localBranch]).stdout.trim();
            return [targetBranch, sha];
        });
        await this.git.github.issues.createComment({
            ...this.git.remoteParams,
            issue_number: pullRequest.prNumber,
            body: 'This PR was merged into the repository. ' +
                'The changes were merged into the following branches:\n\n' +
                `${banchesAndSha.map(([branch, sha]) => `- ${branch}: ${sha}`).join('\n')}`,
        });
    }
    async closeLinkedIssues({ closingIssuesReferences, githubTargetBranch, }) {
        if (githubTargetBranch === this.git.mainBranchName) {
            return;
        }
        for (const { number: issue_number, state } of closingIssuesReferences) {
            if (state === 'CLOSED') {
                continue;
            }
            await this.git.github.issues.update({
                ...this.git.remoteParams,
                issue_number,
                state_reason: 'completed',
                state: 'closed',
            });
        }
    }
}
//# sourceMappingURL=strategy.js.map