/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullApproveGroupResult } from './group.js';
type ConditionGrouping = keyof Pick<PullApproveGroupResult, 'matchedConditions' | 'unmatchedConditions' | 'unverifiableConditions'>;
/** Create logs for each pullapprove group result. */
export declare function logGroup(group: PullApproveGroupResult, conditionsToPrint: ConditionGrouping, printMessageFn?: {
    (...values: unknown[]): void;
    group(label: string, collapsed?: boolean): void;
    groupEnd(): void;
}): void;
/** Logs a header within a text drawn box. */
export declare function logHeader(...params: string[]): void;
export {};
