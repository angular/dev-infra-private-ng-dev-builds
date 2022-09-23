import { Commit } from '../../commit-message/parse.js';
interface Label {
    label: string;
    /** A matching function, if the label is automatically applied by our github action, otherwise false. */
    commitCheck: ((c: Commit) => boolean) | false;
}
/** Set of labels which are known to tooling, and in some cases are managed by tooling. */
export declare const ToolingPullRequestLabels: {
    BREAKING_CHANGE: Label;
    DEPRECATION: Label;
    FEATURE: Label;
    DOCS_CHANGE: Label;
};
export {};
