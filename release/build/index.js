/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
export class BuildWorker {
    /**
     * Builds the release output without polluting the process stdout. Build scripts commonly
     * print messages to stderr or stdout. This is fine in most cases, but sometimes other tooling
     * reserves stdout for data transfer (e.g. when `ng release build --json` is invoked). To not
     * pollute the stdout in such cases, we launch a child process for building the release packages
     * and redirect all stdout output to the stderr channel (which can be read in the terminal).
     */
    static async invokeBuild() {
        return new Promise((resolve) => {
            const buildProcess = fork(getBuildWorkerScriptPath(), {
                // The stdio option is set to redirect any "stdout" output directly to the "stderr" file
                // descriptor. An additional "ipc" file descriptor is created to support communication with
                // the build process. https://nodejs.org/api/child_process.html#child_process_options_stdio.
                stdio: ['inherit', 2, 2, 'ipc'],
            });
            let builtPackages = null;
            // The child process will pass the `buildPackages()` output through the
            // IPC channel. We keep track of it so that we can use it as resolve value.
            buildProcess.on('message', (buildResponse) => (builtPackages = buildResponse));
            // On child process exit, resolve the promise with the received output.
            buildProcess.on('exit', () => resolve(builtPackages));
        });
    }
}
/** Gets the absolute file path to the build worker script. */
function getBuildWorkerScriptPath() {
    // This file is getting bundled and ends up in `<pkg-root>/bundles/<chunk>`. We also
    // bundle the build worker script as another entry-point and can reference
    // it relatively as the path is preserved inside `bundles/`.
    // *Note*: Relying on package resolution is problematic within ESM and with `local-dev.sh`
    const bundlesDir = dirname(fileURLToPath(import.meta.url));
    return join(bundlesDir, './release/build/build-worker.mjs');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9idWlsZC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLElBQUksRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUNuQyxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sS0FBSyxDQUFDO0FBQ2xDLE9BQU8sRUFBQyxJQUFJLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFHbkMsTUFBTSxPQUFnQixXQUFXO0lBQy9COzs7Ozs7T0FNRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVztRQUN0QixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixFQUFFLEVBQUU7Z0JBQ3BELHdGQUF3RjtnQkFDeEYsMkZBQTJGO2dCQUMzRiw0RkFBNEY7Z0JBQzVGLEtBQUssRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQzthQUNoQyxDQUFDLENBQUM7WUFDSCxJQUFJLGFBQWEsR0FBMEIsSUFBSSxDQUFDO1lBRWhELHVFQUF1RTtZQUN2RSwyRUFBMkU7WUFDM0UsWUFBWSxDQUFDLEVBQUUsQ0FDYixTQUFTLEVBQ1QsQ0FBQyxhQUE2QixFQUFFLEVBQUUsQ0FBQyxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUMsQ0FDbkUsQ0FBQztZQUVGLHVFQUF1RTtZQUN2RSxZQUFZLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUN4RCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQUVELDhEQUE4RDtBQUM5RCxTQUFTLHdCQUF3QjtJQUMvQixvRkFBb0Y7SUFDcEYsMEVBQTBFO0lBQzFFLDREQUE0RDtJQUM1RCwwRkFBMEY7SUFDMUYsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDM0QsT0FBTyxJQUFJLENBQUMsVUFBVSxFQUFFLGtDQUFrQyxDQUFDLENBQUM7QUFDOUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Rpcm5hbWUsIGpvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tICd1cmwnO1xuaW1wb3J0IHtmb3JrfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7QnVpbHRQYWNrYWdlfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQnVpbGRXb3JrZXIge1xuICAvKipcbiAgICogQnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCB3aXRob3V0IHBvbGx1dGluZyB0aGUgcHJvY2VzcyBzdGRvdXQuIEJ1aWxkIHNjcmlwdHMgY29tbW9ubHlcbiAgICogcHJpbnQgbWVzc2FnZXMgdG8gc3RkZXJyIG9yIHN0ZG91dC4gVGhpcyBpcyBmaW5lIGluIG1vc3QgY2FzZXMsIGJ1dCBzb21ldGltZXMgb3RoZXIgdG9vbGluZ1xuICAgKiByZXNlcnZlcyBzdGRvdXQgZm9yIGRhdGEgdHJhbnNmZXIgKGUuZy4gd2hlbiBgbmcgcmVsZWFzZSBidWlsZCAtLWpzb25gIGlzIGludm9rZWQpLiBUbyBub3RcbiAgICogcG9sbHV0ZSB0aGUgc3Rkb3V0IGluIHN1Y2ggY2FzZXMsIHdlIGxhdW5jaCBhIGNoaWxkIHByb2Nlc3MgZm9yIGJ1aWxkaW5nIHRoZSByZWxlYXNlIHBhY2thZ2VzXG4gICAqIGFuZCByZWRpcmVjdCBhbGwgc3Rkb3V0IG91dHB1dCB0byB0aGUgc3RkZXJyIGNoYW5uZWwgKHdoaWNoIGNhbiBiZSByZWFkIGluIHRoZSB0ZXJtaW5hbCkuXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlQnVpbGQoKTogUHJvbWlzZTxCdWlsdFBhY2thZ2VbXSB8IG51bGw+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGNvbnN0IGJ1aWxkUHJvY2VzcyA9IGZvcmsoZ2V0QnVpbGRXb3JrZXJTY3JpcHRQYXRoKCksIHtcbiAgICAgICAgLy8gVGhlIHN0ZGlvIG9wdGlvbiBpcyBzZXQgdG8gcmVkaXJlY3QgYW55IFwic3Rkb3V0XCIgb3V0cHV0IGRpcmVjdGx5IHRvIHRoZSBcInN0ZGVyclwiIGZpbGVcbiAgICAgICAgLy8gZGVzY3JpcHRvci4gQW4gYWRkaXRpb25hbCBcImlwY1wiIGZpbGUgZGVzY3JpcHRvciBpcyBjcmVhdGVkIHRvIHN1cHBvcnQgY29tbXVuaWNhdGlvbiB3aXRoXG4gICAgICAgIC8vIHRoZSBidWlsZCBwcm9jZXNzLiBodHRwczovL25vZGVqcy5vcmcvYXBpL2NoaWxkX3Byb2Nlc3MuaHRtbCNjaGlsZF9wcm9jZXNzX29wdGlvbnNfc3RkaW8uXG4gICAgICAgIHN0ZGlvOiBbJ2luaGVyaXQnLCAyLCAyLCAnaXBjJ10sXG4gICAgICB9KTtcbiAgICAgIGxldCBidWlsdFBhY2thZ2VzOiBCdWlsdFBhY2thZ2VbXSB8IG51bGwgPSBudWxsO1xuXG4gICAgICAvLyBUaGUgY2hpbGQgcHJvY2VzcyB3aWxsIHBhc3MgdGhlIGBidWlsZFBhY2thZ2VzKClgIG91dHB1dCB0aHJvdWdoIHRoZVxuICAgICAgLy8gSVBDIGNoYW5uZWwuIFdlIGtlZXAgdHJhY2sgb2YgaXQgc28gdGhhdCB3ZSBjYW4gdXNlIGl0IGFzIHJlc29sdmUgdmFsdWUuXG4gICAgICBidWlsZFByb2Nlc3Mub24oXG4gICAgICAgICdtZXNzYWdlJyxcbiAgICAgICAgKGJ1aWxkUmVzcG9uc2U6IEJ1aWx0UGFja2FnZVtdKSA9PiAoYnVpbHRQYWNrYWdlcyA9IGJ1aWxkUmVzcG9uc2UpLFxuICAgICAgKTtcblxuICAgICAgLy8gT24gY2hpbGQgcHJvY2VzcyBleGl0LCByZXNvbHZlIHRoZSBwcm9taXNlIHdpdGggdGhlIHJlY2VpdmVkIG91dHB1dC5cbiAgICAgIGJ1aWxkUHJvY2Vzcy5vbignZXhpdCcsICgpID0+IHJlc29sdmUoYnVpbHRQYWNrYWdlcykpO1xuICAgIH0pO1xuICB9XG59XG5cbi8qKiBHZXRzIHRoZSBhYnNvbHV0ZSBmaWxlIHBhdGggdG8gdGhlIGJ1aWxkIHdvcmtlciBzY3JpcHQuICovXG5mdW5jdGlvbiBnZXRCdWlsZFdvcmtlclNjcmlwdFBhdGgoKTogc3RyaW5nIHtcbiAgLy8gVGhpcyBmaWxlIGlzIGdldHRpbmcgYnVuZGxlZCBhbmQgZW5kcyB1cCBpbiBgPHBrZy1yb290Pi9idW5kbGVzLzxjaHVuaz5gLiBXZSBhbHNvXG4gIC8vIGJ1bmRsZSB0aGUgYnVpbGQgd29ya2VyIHNjcmlwdCBhcyBhbm90aGVyIGVudHJ5LXBvaW50IGFuZCBjYW4gcmVmZXJlbmNlXG4gIC8vIGl0IHJlbGF0aXZlbHkgYXMgdGhlIHBhdGggaXMgcHJlc2VydmVkIGluc2lkZSBgYnVuZGxlcy9gLlxuICAvLyAqTm90ZSo6IFJlbHlpbmcgb24gcGFja2FnZSByZXNvbHV0aW9uIGlzIHByb2JsZW1hdGljIHdpdGhpbiBFU00gYW5kIHdpdGggYGxvY2FsLWRldi5zaGBcbiAgY29uc3QgYnVuZGxlc0RpciA9IGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcbiAgcmV0dXJuIGpvaW4oYnVuZGxlc0RpciwgJy4vcmVsZWFzZS9idWlsZC9idWlsZC13b3JrZXIubWpzJyk7XG59XG4iXX0=