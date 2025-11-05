import { PullApproveGroupResult } from './group.js';
type ConditionGrouping = keyof Pick<PullApproveGroupResult, 'matchedConditions' | 'unmatchedConditions' | 'unverifiableConditions'>;
export declare function logGroup(group: PullApproveGroupResult, conditionsToPrint: ConditionGrouping, printMessageFn?: (...values: unknown[]) => void): void;
export declare function logHeader(...params: string[]): void;
export {};
