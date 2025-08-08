import { CommitFromGitLog } from '../../commit-message/parse.js';
import { GithubConfig } from '../../utils/config.js';
import { ReleaseNotesConfig } from '../config/index.js';
export interface RenderContextData {
    title: string | false;
    groupOrder: ReleaseNotesConfig['groupOrder'];
    hiddenScopes: ReleaseNotesConfig['hiddenScopes'];
    categorizeCommit: ReleaseNotesConfig['categorizeCommit'];
    commits: CommitFromGitLog[];
    version: string;
    github: GithubConfig;
    date?: Date;
}
export interface CategorizedCommit extends CommitFromGitLog {
    groupName: string;
    description: string;
}
export declare class RenderContext {
    private readonly data;
    private readonly groupOrder;
    private readonly hiddenScopes;
    readonly title: string | false;
    readonly version: string;
    readonly dateStamp: string;
    readonly urlFragmentForRelease: string;
    readonly commits: CategorizedCommit[];
    constructor(data: RenderContextData);
    _categorizeCommits(commits: CommitFromGitLog[]): CategorizedCommit[];
    private _commitsWithinGroupComparator;
    asCommitGroups(commits: CategorizedCommit[]): {
        title: string;
        commits: CategorizedCommit[];
    }[];
    hasBreakingChanges(commit: CategorizedCommit): boolean;
    hasDeprecations(commit: CategorizedCommit): boolean;
    includeInReleaseNotes(): (commit: CategorizedCommit) => boolean;
    unique(field: keyof CategorizedCommit): (commit: CategorizedCommit) => boolean;
    commitToLink(commit: CategorizedCommit): string;
    pullRequestToLink(prNumber: number): string;
    convertPullRequestReferencesToLinks(content: string): string;
    bulletizeText(text: string): string;
    commitToBadge(commit: CategorizedCommit): string;
}
export declare function buildDateStamp(date?: Date): string;
