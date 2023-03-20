/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ModuleInfo } from 'license-checker';
interface ExpandedModuleInfo extends ModuleInfo {
    name: string;
    allowed: boolean;
}
export interface LicenseCheckResult {
    valid: boolean;
    packages: ExpandedModuleInfo[];
    maxPkgNameLength: number;
}
export declare function checkAllLicenses(start: string): Promise<LicenseCheckResult>;
export {};
