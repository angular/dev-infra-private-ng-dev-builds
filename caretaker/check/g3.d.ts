/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { G3StatsData } from '../../utils/g3.js';
import { BaseModule } from './base.js';
export declare class G3Module extends BaseModule<G3StatsData | void> {
    retrieveData(): Promise<G3StatsData | undefined>;
    printToTerminal(): Promise<void>;
}
