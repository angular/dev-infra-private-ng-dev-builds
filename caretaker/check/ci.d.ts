/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BaseModule } from './base.js';
/** The result of checking a branch on CI. */
type CiBranchStatus = 'pending' | 'passing' | 'failing' | null;
/** A list of results for checking CI branches. */
type CiData = {
    active: boolean;
    name: string;
    label: string;
    status: CiBranchStatus;
}[];
export declare class CiModule extends BaseModule<CiData> {
    retrieveData(): Promise<{
        active: boolean;
        name: string;
        label: string;
        status: "pending" | "passing" | "failing" | null;
    }[]>;
    printToTerminal(): Promise<void>;
}
export {};
