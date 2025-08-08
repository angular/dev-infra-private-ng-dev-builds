export interface CommitMessageParts {
    prefix: string;
    type: string;
    scope: string;
    summary: string;
    body: string;
    footer: string;
}
export declare function commitMessageBuilder(defaults: CommitMessageParts): (params?: Partial<CommitMessageParts>) => string;
