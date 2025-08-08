import semver from 'semver';
import { CommitFromGitLog } from '../../commit-message/parse.js';
import { GitClient } from '../../utils/git/git-client.js';
import { ReleaseConfig } from '../config/index.js';
import { NgDevConfig } from '../../utils/config.js';
export declare const workspaceRelativeChangelogPath = "CHANGELOG.md";
export declare class ReleaseNotes {
    config: NgDevConfig<{
        release: ReleaseConfig;
    }>;
    version: semver.SemVer;
    private commits;
    private git;
    static forRange(git: GitClient, version: semver.SemVer, baseRef: string, headRef: string): Promise<ReleaseNotes>;
    private renderContext;
    private title;
    protected constructor(config: NgDevConfig<{
        release: ReleaseConfig;
    }>, version: semver.SemVer, commits: CommitFromGitLog[], git: GitClient);
    getGithubReleaseEntry(): Promise<string>;
    getChangelogEntry(): Promise<string>;
    prependEntryToChangelogFile(): Promise<void>;
    getCommitCountInReleaseNotes(): Promise<number>;
    getUrlFragmentForRelease(): Promise<string>;
    promptForReleaseTitle(): Promise<string | false>;
    private generateRenderContext;
    private _getNotesConfig;
}
