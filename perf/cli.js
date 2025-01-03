/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { WorkflowsModule } from './workflow/cli.js';
/** Build the parser for pull request commands. */
export function buildPerfParser(localYargs) {
    return localYargs.help().strict().demandCommand().command(WorkflowsModule);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L3BlcmYvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVsRCxrREFBa0Q7QUFDbEQsTUFBTSxVQUFVLGVBQWUsQ0FBQyxVQUFnQjtJQUM5QyxPQUFPLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDN0UsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FyZ3Z9IGZyb20gJ3lhcmdzJztcblxuaW1wb3J0IHtXb3JrZmxvd3NNb2R1bGV9IGZyb20gJy4vd29ya2Zsb3cvY2xpLmpzJztcblxuLyoqIEJ1aWxkIHRoZSBwYXJzZXIgZm9yIHB1bGwgcmVxdWVzdCBjb21tYW5kcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFBlcmZQYXJzZXIobG9jYWxZYXJnczogQXJndikge1xuICByZXR1cm4gbG9jYWxZYXJncy5oZWxwKCkuc3RyaWN0KCkuZGVtYW5kQ29tbWFuZCgpLmNvbW1hbmQoV29ya2Zsb3dzTW9kdWxlKTtcbn1cbiJdfQ==