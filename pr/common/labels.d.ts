import { managedLabels } from './labels/managed.js';
import { actionLabels } from './labels/action.js';
import { mergeLabels } from './labels/merge.js';
import { targetLabels } from './labels/target.js';
import { priorityLabels } from './labels/priority.js';
export declare const allLabels: {
    FEATURE_IN_BACKLOG: {
        label: string;
        description: string;
    };
    FEATURE_VOTES_REQUIRED: {
        label: string;
        description: string;
    };
    FEATURE_UNDER_CONSIDERATION: {
        label: string;
        description: string;
    };
    FEATURE_INSUFFICIENT_VOTES: {
        label: string;
        description: string;
    };
    P0: {
        label: string;
        description: string;
    };
    P1: {
        label: string;
        description: string;
    };
    P2: {
        label: string;
        description: string;
    };
    P3: {
        label: string;
        description: string;
    };
    P4: {
        label: string;
        description: string;
    };
    P5: {
        label: string;
        description: string;
    };
    TARGET_FEATURE: {
        description: string;
        label: string;
    };
    TARGET_LTS: {
        description: string;
        label: string;
    };
    TARGET_MAJOR: {
        description: string;
        label: string;
    };
    TARGET_MINOR: {
        description: string;
        label: string;
    };
    TARGET_PATCH: {
        description: string;
        label: string;
    };
    TARGET_RC: {
        description: string;
        label: string;
    };
    MERGE_PRESERVE_COMMITS: {
        description: string;
        label: string;
    };
    MERGE_SQUASH_COMMITS: {
        description: string;
        label: string;
    };
    MERGE_FIX_COMMIT_MESSAGE: {
        description: string;
        label: string;
    };
    MERGE_CARETAKER_NOTE: {
        description: string;
        label: string;
    };
    ACTION_MERGE: {
        description: string;
        label: string;
    };
    ACTION_CLEANUP: {
        description: string;
        label: string;
    };
    ACTION_PRESUBMIT: {
        description: string;
        label: string;
    };
    ACTION_REVIEW: {
        description: string;
        label: string;
    };
    DETECTED_BREAKING_CHANGE: {
        description: string;
        label: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_DEPRECATION: {
        description: string;
        label: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_FEATURE: {
        description: string;
        label: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_DOCS_CHANGE: {
        description: string;
        label: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
};
export { managedLabels, actionLabels, mergeLabels, targetLabels, priorityLabels };
export { Label } from './labels/base.js';
