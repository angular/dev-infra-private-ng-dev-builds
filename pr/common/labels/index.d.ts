import { managedLabels } from './managed.js';
import { actionLabels } from './action.js';
import { mergeLabels } from './merge.js';
import { targetLabels } from './target.js';
import { priorityLabels } from './priority.js';
import { requiresLabels } from './requires.js';
import { Label, LabelParams } from './base.js';
import { miscLabels } from './misc.js';
export declare const allLabels: {
    [x: string]: {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: import("./managed.js").ManageLabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | import("./target.js").TargetLabel | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    };
    [x: number]: {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: import("./managed.js").ManageLabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | import("./target.js").TargetLabel | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    };
    [x: symbol]: {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        commitCheck: (c: import("../../../commit-message/parse.js").Commit) => boolean;
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: import("./managed.js").ManageLabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | import("./target.js").TargetLabel | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    } | {
        repositories: import("./base.js").ManagedRepositories[];
        name: string;
        description: string;
        color: string | undefined;
        readonly params: LabelParams;
    };
};
export { managedLabels, actionLabels, mergeLabels, targetLabels, priorityLabels, requiresLabels, miscLabels, };
export { Label };
