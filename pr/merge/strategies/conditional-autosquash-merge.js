import { AutosquashMergeStrategy } from './autosquash-merge.js';
import { GithubApiMergeStrategy } from './api-merge.js';
import { MergeStrategy } from './strategy.js';
export class ConditionalAutosquashMergeStrategy extends MergeStrategy {
    constructor(git, config) {
        super(git);
        this.config = config;
        this.githubApiMergeStrategy = new GithubApiMergeStrategy(this.git, this.config);
    }
    async merge(pullRequest) {
        const mergeAction = this.githubApiMergeStrategy.getMergeActionFromPullRequest(pullRequest);
        return mergeAction === 'rebase' && (await this.hasFixupOrSquashCommits(pullRequest))
            ? new AutosquashMergeStrategy(this.git).merge(pullRequest)
            : this.githubApiMergeStrategy.merge(pullRequest);
    }
    async hasFixupOrSquashCommits(pullRequest) {
        const commits = await this.getPullRequestCommits(pullRequest);
        return commits.some(({ parsed: { isFixup, isSquash } }) => isFixup || isSquash);
    }
}
//# sourceMappingURL=conditional-autosquash-merge.js.map