/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Class that exposes helpers for fetching and using pnpm
 * based on a currently-checked out revision.
 *
 * This is useful as there is no vendoring/checking-in of specific
 * pnpm versions, so we need to automatically fetch the proper pnpm
 * version when executing commands in version branches. Keep in mind that
 * version branches may have different pnpm version ranges, and the release
 * tool should automatically be able to satisfy those.
 */
export declare class PnpmVersioning {
    isUsingPnpm(repoPath: string): Promise<boolean>;
    getPackageSpec(repoPath: string): Promise<string>;
}
