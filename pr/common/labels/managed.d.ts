import { Commit } from '../../../commit-message/parse.js';
export declare const managedLabels: {
    DETECTED_BREAKING_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_DEPRECATION: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_FEATURE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_DOCS_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_COMPILER_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_PLATFORM_BROWSER_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_INFRA_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_PERF_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
    DETECTED_HTTP_CHANGE: {
        description: string;
        name: string;
        commitCheck: (c: Commit) => boolean;
    };
};
