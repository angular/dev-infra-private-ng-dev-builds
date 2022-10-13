import { managedLabels } from './labels/managed.js';
import { actionLabels } from './labels/action.js';
import { mergeLabels } from './labels/merge.js';
import { targetLabels } from './labels/target.js';
import { priorityLabels } from './labels/priority.js';
export declare const allLabels: {
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
    TARGET_FEATURE: {
        description: string;
        name: string;
    };
    TARGET_LTS: {
        description: string;
        name: string;
    };
    TARGET_MAJOR: {
        description: string;
        name: string;
    };
    TARGET_MINOR: {
        description: string;
        name: string;
    };
    TARGET_PATCH: {
        description: string;
        name: string;
    };
    TARGET_RC: {
        description: string;
        name: string;
    };
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
    ACTION_REVIEW: {
        description: string;
        name: string;
    };
    DETECTED_BREAKING_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_DEPRECATION: {
        description: string;
        name: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_FEATURE: {
        description: string;
        name: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
    DETECTED_DOCS_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: import("../../commit-message/parse.js").Commit) => boolean;
    };
};
export { managedLabels, actionLabels, mergeLabels, targetLabels, priorityLabels };
export { Label } from './labels/base.js';
