import { PullApproveGroupConfig } from './parse-yaml.js';
interface GroupCondition {
    expression: string;
    checkFn: (files: string[], groups: PullApproveGroup[]) => boolean;
    matchedFiles: Set<string>;
    unverifiable: boolean;
}
interface GroupReviewers {
    users?: string[];
    teams?: string[];
}
export interface PullApproveGroupResult {
    groupName: string;
    matchedConditions: GroupCondition[];
    matchedCount: number;
    unmatchedConditions: GroupCondition[];
    unmatchedCount: number;
    unverifiableConditions: GroupCondition[];
}
export declare class PullApproveGroup {
    groupName: string;
    readonly precedingGroups: PullApproveGroup[];
    readonly conditions: GroupCondition[];
    readonly reviewers: GroupReviewers;
    constructor(groupName: string, config: PullApproveGroupConfig, precedingGroups?: PullApproveGroup[]);
    private _captureConditions;
    testFile(filePath: string): boolean;
    getResults(): PullApproveGroupResult;
}
export {};
