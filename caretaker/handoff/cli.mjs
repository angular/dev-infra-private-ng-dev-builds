/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { updateCaretakerTeamViaPrompt } from './update-github-team.js';
/** Builds the command. */
function builder(argv) {
    return addGithubTokenOption(argv);
}
/** Handles the command. */
async function handler() {
    await updateCaretakerTeamViaPrompt();
}
/** yargs command module for assisting in handing off caretaker.  */
export const HandoffModule = {
    handler,
    builder,
    command: 'handoff',
    describe: 'Run a handoff assistant to aide in moving to the next caretaker',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2NhcmV0YWtlci9oYW5kb2ZmL2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUVyRSxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUlyRSwwQkFBMEI7QUFDMUIsU0FBUyxPQUFPLENBQUMsSUFBVTtJQUN6QixPQUFPLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3BDLENBQUM7QUFFRCwyQkFBMkI7QUFDM0IsS0FBSyxVQUFVLE9BQU87SUFDcEIsTUFBTSw0QkFBNEIsRUFBRSxDQUFDO0FBQ3ZDLENBQUM7QUFFRCxvRUFBb0U7QUFDcEUsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUErQztJQUN2RSxPQUFPO0lBQ1AsT0FBTztJQUNQLE9BQU8sRUFBRSxTQUFTO0lBQ2xCLFFBQVEsRUFBRSxpRUFBaUU7Q0FDNUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FyZ3YsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcblxuaW1wb3J0IHthZGRHaXRodWJUb2tlbk9wdGlvbn0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi15YXJncy5qcyc7XG5cbmltcG9ydCB7dXBkYXRlQ2FyZXRha2VyVGVhbVZpYVByb21wdH0gZnJvbSAnLi91cGRhdGUtZ2l0aHViLXRlYW0uanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhcmV0YWtlckhhbmRvZmZPcHRpb25zIHt9XG5cbi8qKiBCdWlsZHMgdGhlIGNvbW1hbmQuICovXG5mdW5jdGlvbiBidWlsZGVyKGFyZ3Y6IEFyZ3YpIHtcbiAgcmV0dXJuIGFkZEdpdGh1YlRva2VuT3B0aW9uKGFyZ3YpO1xufVxuXG4vKiogSGFuZGxlcyB0aGUgY29tbWFuZC4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoKSB7XG4gIGF3YWl0IHVwZGF0ZUNhcmV0YWtlclRlYW1WaWFQcm9tcHQoKTtcbn1cblxuLyoqIHlhcmdzIGNvbW1hbmQgbW9kdWxlIGZvciBhc3Npc3RpbmcgaW4gaGFuZGluZyBvZmYgY2FyZXRha2VyLiAgKi9cbmV4cG9ydCBjb25zdCBIYW5kb2ZmTW9kdWxlOiBDb21tYW5kTW9kdWxlPHt9LCBDYXJldGFrZXJIYW5kb2ZmT3B0aW9ucz4gPSB7XG4gIGhhbmRsZXIsXG4gIGJ1aWxkZXIsXG4gIGNvbW1hbmQ6ICdoYW5kb2ZmJyxcbiAgZGVzY3JpYmU6ICdSdW4gYSBoYW5kb2ZmIGFzc2lzdGFudCB0byBhaWRlIGluIG1vdmluZyB0byB0aGUgbmV4dCBjYXJldGFrZXInLFxufTtcbiJdfQ==