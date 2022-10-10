import { Commit } from '../../../commit-message/parse.js';
export declare const managedLabels: {
    DETECTED_BREAKING_CHANGE: {
        description: string;
        label: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_DEPRECATION: {
        description: string;
        label: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_FEATURE: {
        description: string;
        label: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_DOCS_CHANGE: {
        description: string;
        label: string;
        commitCheck: (c: Commit) => boolean;
    };
};
