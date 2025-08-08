export declare class UnexpectedLocalChangesError extends Error {
}
export declare class PullRequestNotFoundError extends Error {
}
export declare class MaintainerModifyAccessError extends Error {
}
export interface PullRequestCheckoutOptions {
    allowIfMaintainerCannotModify?: boolean;
}
export declare function checkOutPullRequestLocally(prNumber: number, opts?: PullRequestCheckoutOptions): Promise<{
    pushToUpstream: () => true;
    resetGitState: () => boolean;
    pushToUpstreamCommand: string;
    resetGitStateCommand: string;
    pullRequest: {
        author: {
            login: string;
        };
        state: string;
        maintainerCanModify: boolean;
        viewerDidAuthor: boolean;
        headRefOid: string;
        headRef: {
            name: string;
            repository: {
                url: string;
                nameWithOwner: string;
            };
        };
        baseRefOid: string;
        baseRef: {
            name: string;
            repository: {
                url: string;
                nameWithOwner: string;
            };
        };
    };
}>;
