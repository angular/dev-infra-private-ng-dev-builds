/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ReleaseNpmDistTagSetCommand } from '../npm-dist-tag/set/cli.js';
// ---- **IMPORTANT** ----
// This command is part of our external commands invoked by the release publish
// command. Before making changes, keep in mind that more recent `ng-dev` versions
// can still invoke this command.
// ------------------------
// TODO(devversion): Remove this command in 2024 Jan. It only exists for backwards compat.
//  If all active and LTS release trains support the new `release npm-dist-tag`
//  command, this can be removed.
/** CLI command module for setting an NPM dist tag. */
export const ReleaseSetDistTagCommand = {
    ...ReleaseNpmDistTagSetCommand,
    command: 'set-dist-tag <tag-name> <target-version>',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2Uvc2V0LWRpc3QtdGFnL2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsMkJBQTJCLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUV2RSwwQkFBMEI7QUFDMUIsK0VBQStFO0FBQy9FLGtGQUFrRjtBQUNsRixpQ0FBaUM7QUFDakMsMkJBQTJCO0FBRTNCLDBGQUEwRjtBQUMxRiwrRUFBK0U7QUFDL0UsaUNBQWlDO0FBRWpDLHNEQUFzRDtBQUN0RCxNQUFNLENBQUMsTUFBTSx3QkFBd0IsR0FBdUM7SUFDMUUsR0FBRywyQkFBMkI7SUFDOUIsT0FBTyxFQUFFLDBDQUEwQztDQUNwRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UmVsZWFzZU5wbURpc3RUYWdTZXRDb21tYW5kfSBmcm9tICcuLi9ucG0tZGlzdC10YWcvc2V0L2NsaS5qcyc7XG5cbi8vIC0tLS0gKipJTVBPUlRBTlQqKiAtLS0tXG4vLyBUaGlzIGNvbW1hbmQgaXMgcGFydCBvZiBvdXIgZXh0ZXJuYWwgY29tbWFuZHMgaW52b2tlZCBieSB0aGUgcmVsZWFzZSBwdWJsaXNoXG4vLyBjb21tYW5kLiBCZWZvcmUgbWFraW5nIGNoYW5nZXMsIGtlZXAgaW4gbWluZCB0aGF0IG1vcmUgcmVjZW50IGBuZy1kZXZgIHZlcnNpb25zXG4vLyBjYW4gc3RpbGwgaW52b2tlIHRoaXMgY29tbWFuZC5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyBUT0RPKGRldnZlcnNpb24pOiBSZW1vdmUgdGhpcyBjb21tYW5kIGluIDIwMjQgSmFuLiBJdCBvbmx5IGV4aXN0cyBmb3IgYmFja3dhcmRzIGNvbXBhdC5cbi8vICBJZiBhbGwgYWN0aXZlIGFuZCBMVFMgcmVsZWFzZSB0cmFpbnMgc3VwcG9ydCB0aGUgbmV3IGByZWxlYXNlIG5wbS1kaXN0LXRhZ2Bcbi8vICBjb21tYW5kLCB0aGlzIGNhbiBiZSByZW1vdmVkLlxuXG4vKiogQ0xJIGNvbW1hbmQgbW9kdWxlIGZvciBzZXR0aW5nIGFuIE5QTSBkaXN0IHRhZy4gKi9cbmV4cG9ydCBjb25zdCBSZWxlYXNlU2V0RGlzdFRhZ0NvbW1hbmQ6IHR5cGVvZiBSZWxlYXNlTnBtRGlzdFRhZ1NldENvbW1hbmQgPSB7XG4gIC4uLlJlbGVhc2VOcG1EaXN0VGFnU2V0Q29tbWFuZCxcbiAgY29tbWFuZDogJ3NldC1kaXN0LXRhZyA8dGFnLW5hbWU+IDx0YXJnZXQtdmVyc2lvbj4nLFxufTtcbiJdfQ==