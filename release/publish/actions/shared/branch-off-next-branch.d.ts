import { CutNpmNextPrereleaseAction } from '../cut-npm-next-prerelease.js';
export declare abstract class BranchOffNextBranchBaseAction extends CutNpmNextPrereleaseAction {
    abstract newPhaseName: 'feature-freeze' | 'release-candidate';
    private _nextPrerelease;
    private _rcPrerelease;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    private _computeNewVersion;
    private _computeReleaseNoteCompareVersion;
    private _createNewVersionBranchFromNext;
    private _createNextBranchUpdatePullRequest;
}
