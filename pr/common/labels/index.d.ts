import { managedLabels } from './managed.js';
import { actionLabels } from './action.js';
import { mergeLabels } from './merge.js';
import { targetLabels } from './target.js';
import { priorityLabels } from './priority.js';
import { requiresLabels } from './requires.js';
import { Label } from './base.js';
export declare const allLabels: {
    REQUIRES_TGP: {
        name: string;
        description: string;
    };
    FEATURE_IN_BACKLOG: {
        name: string;
        description: string;
    };
    FEATURE_VOTES_REQUIRED: {
        name: string;
        description: string;
    };
    FEATURE_UNDER_CONSIDERATION: {
        name: string;
        description: string;
    };
    FEATURE_INSUFFICIENT_VOTES: {
        name: string;
        description: string;
    };
    P0: {
        name: string;
        description: string;
    };
    P1: {
        name: string;
        description: string;
    };
    P2: {
        name: string;
        description: string;
    };
    P3: {
        name: string;
        description: string;
    };
    P4: {
        name: string;
        description: string;
    };
    P5: {
        name: string;
        description: string;
    };
    TARGET_FEATURE: import("./target.js").TargetLabel;
    TARGET_LTS: import("./target.js").TargetLabel;
    TARGET_MAJOR: import("./target.js").TargetLabel;
    TARGET_MINOR: import("./target.js").TargetLabel;
    TARGET_PATCH: import("./target.js").TargetLabel;
    TARGET_RC: import("./target.js").TargetLabel;
    MERGE_PRESERVE_COMMITS: {
        description: string;
        name: string;
    };
    MERGE_SQUASH_COMMITS: {
        description: string;
        name: string;
    };
    MERGE_FIX_COMMIT_MESSAGE: {
        description: string;
        name: string;
    };
    MERGE_CARETAKER_NOTE: {
        description: string;
        name: string;
    };
    ACTION_MERGE: {
        description: string;
        name: string;
    };
    ACTION_CLEANUP: {
        description: string;
        name: string;
    };
    ACTION_PRESUBMIT: {
        description: string;
        name: string;
    };
    ACTION_GLOBAL_PRESUBMIT: {
        description: string;
        name: string;
    };
    ACTION_REVIEW: {
        description: string;
        name: string;
    };
    DETECTED_BREAKING_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_DEPRECATION: {
        description: string;
        name: string;
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_FEATURE: {
        description: string;
        name: string;
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_DOCS_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_INFRA_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
    };
};
export { managedLabels, actionLabels, mergeLabels, targetLabels, priorityLabels, requiresLabels };
export { Label };
