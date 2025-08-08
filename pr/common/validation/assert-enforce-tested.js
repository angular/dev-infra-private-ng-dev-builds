import githubMacros from '../../../utils/git/github-macros.js';
import { fetchPullRequestCommentsFromGithub, } from '../fetch-pull-request.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
import { requiresLabels } from '../labels/index.js';
export const enforceTestedValidation = createPullRequestValidation({ name: 'assertEnforceTested', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    async assert(pullRequest, gitClient) {
        if (!pullRequestRequiresTGP(pullRequest)) {
            return;
        }
        const comments = await PullRequestComments.create(gitClient, pullRequest.number).loadPullRequestComments();
        if (await pullRequestHasValidTestedComment(comments, gitClient)) {
            return;
        }
        throw this._createError(`Pull Request requires a TGP and does not have one. Either run a TGP or specify the PR is fully tested by adding a comment with "TESTED=[reason]".`);
    }
}
function pullRequestRequiresTGP(pullRequest) {
    return pullRequest.labels.nodes.some(({ name }) => name === requiresLabels['REQUIRES_TGP'].name);
}
export class PullRequestComments {
    constructor(git, prNumber) {
        this.git = git;
        this.prNumber = prNumber;
    }
    async loadPullRequestComments() {
        return (await fetchPullRequestCommentsFromGithub(this.git, this.prNumber)) ?? [];
    }
    static create(git, prNumber) {
        return new PullRequestComments(git, prNumber);
    }
}
export async function pullRequestHasValidTestedComment(comments, gitClient) {
    for (const { bodyText, author } of comments) {
        if (bodyText.startsWith(`TESTED=`) &&
            (await githubMacros.isGooglerOrgMember(gitClient.github, author.login))) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=assert-enforce-tested.js.map