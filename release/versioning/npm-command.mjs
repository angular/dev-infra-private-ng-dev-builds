/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChildProcess } from '../../utils/child-process.js';
export class NpmCommand {
    /**
     * Runs NPM publish within a specified package directory.
     * @throws With the process log output if the publish failed.
     */
    static async publish(packagePath, distTag, registryUrl) {
        const args = ['publish', '--access', 'public', '--tag', distTag];
        // If a custom registry URL has been specified, add the `--registry` flag.
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        await ChildProcess.spawn('npm', args, { cwd: packagePath, mode: 'silent' });
    }
    /**
     * Sets the NPM tag to the specified version for the given package.
     * @throws With the process log output if the tagging failed.
     */
    static async setDistTagForPackage(packageName, distTag, version, registryUrl) {
        const args = ['dist-tag', 'add', `${packageName}@${version}`, distTag];
        // If a custom registry URL has been specified, add the `--registry` flag.
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        await ChildProcess.spawn('npm', args, { mode: 'silent' });
    }
    /**
     * Deletes the specified NPM tag for the given package.
     * @throws With the process log output if the removal failed.
     */
    static async deleteDistTagForPackage(packageName, distTag, registryUrl) {
        const args = ['dist-tag', 'rm', packageName, distTag];
        // If a custom registry URL has been specified, add the `--registry` flag.
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        await ChildProcess.spawn('npm', args, { mode: 'silent' });
    }
    /**
     * Checks whether the user is currently logged into NPM.
     * @returns Whether the user is currently logged into NPM.
     */
    static async checkIsLoggedIn(registryUrl) {
        const args = ['whoami'];
        // If a custom registry URL has been specified, add the `--registry` flag.
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        try {
            await ChildProcess.spawn('npm', args, { mode: 'silent' });
        }
        catch (e) {
            return false;
        }
        return true;
    }
    /**
     * Log into NPM at a provided registry using an interactive invocation.
     * @throws With the `npm login` status code if the login failed.
     */
    static async startInteractiveLogin(registryUrl) {
        const args = ['login', '--no-browser'];
        // If a custom registry URL has been specified, add the `--registry` flag. The `--registry` flag
        // must be spliced into the correct place in the command as npm expects it to be the flag
        // immediately following the login subcommand.
        if (registryUrl !== undefined) {
            args.splice(1, 0, '--registry', registryUrl);
        }
        // The login command prompts for username, password and other profile information. Hence
        // the process needs to be interactive (i.e. respecting current TTYs stdin).
        await ChildProcess.spawnInteractive('npm', args);
    }
    /**
     * Log out of NPM at a provided registry.
     * @returns Whether the user was logged out of NPM.
     */
    static async logout(registryUrl) {
        const args = ['logout'];
        // If a custom registry URL has been specified, add the `--registry` flag. The `--registry` flag
        // must be spliced into the correct place in the command as npm expects it to be the flag
        // immediately following the logout subcommand.
        if (registryUrl !== undefined) {
            args.splice(1, 0, '--registry', registryUrl);
        }
        try {
            await ChildProcess.spawn('npm', args, { mode: 'silent' });
        }
        finally {
            return this.checkIsLoggedIn(registryUrl);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibnBtLWNvbW1hbmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS92ZXJzaW9uaW5nL25wbS1jb21tYW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUkxRCxNQUFNLE9BQWdCLFVBQVU7SUFDOUI7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBbUIsRUFBRSxPQUFtQixFQUFFLFdBQStCO1FBQzVGLE1BQU0sSUFBSSxHQUFHLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pFLDBFQUEwRTtRQUMxRSxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBQyxHQUFHLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUMvQixXQUFtQixFQUNuQixPQUFlLEVBQ2YsT0FBc0IsRUFDdEIsV0FBK0I7UUFFL0IsTUFBTSxJQUFJLEdBQUcsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLEdBQUcsV0FBVyxJQUFJLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZFLDBFQUEwRTtRQUMxRSxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FDbEMsV0FBbUIsRUFDbkIsT0FBZSxFQUNmLFdBQStCO1FBRS9CLE1BQU0sSUFBSSxHQUFHLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdEQsMEVBQTBFO1FBQzFFLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCxNQUFNLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxXQUErQjtRQUMxRCxNQUFNLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3hCLDBFQUEwRTtRQUMxRSxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsSUFBSSxDQUFDO1lBQ0gsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztRQUMxRCxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNYLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsV0FBK0I7UUFDaEUsTUFBTSxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDdkMsZ0dBQWdHO1FBQ2hHLHlGQUF5RjtRQUN6Riw4Q0FBOEM7UUFDOUMsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQ0Qsd0ZBQXdGO1FBQ3hGLDRFQUE0RTtRQUM1RSxNQUFNLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQStCO1FBQ2pELE1BQU0sSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDeEIsZ0dBQWdHO1FBQ2hHLHlGQUF5RjtRQUN6RiwrQ0FBK0M7UUFDL0MsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQ0QsSUFBSSxDQUFDO1lBQ0gsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztRQUMxRCxDQUFDO2dCQUFTLENBQUM7WUFDVCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDM0MsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5cbmltcG9ydCB7Q2hpbGRQcm9jZXNzfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcblxuaW1wb3J0IHtOcG1EaXN0VGFnfSBmcm9tICcuL25wbS1yZWdpc3RyeS5qcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBOcG1Db21tYW5kIHtcbiAgLyoqXG4gICAqIFJ1bnMgTlBNIHB1Ymxpc2ggd2l0aGluIGEgc3BlY2lmaWVkIHBhY2thZ2UgZGlyZWN0b3J5LlxuICAgKiBAdGhyb3dzIFdpdGggdGhlIHByb2Nlc3MgbG9nIG91dHB1dCBpZiB0aGUgcHVibGlzaCBmYWlsZWQuXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgcHVibGlzaChwYWNrYWdlUGF0aDogc3RyaW5nLCBkaXN0VGFnOiBOcG1EaXN0VGFnLCByZWdpc3RyeVVybDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgYXJncyA9IFsncHVibGlzaCcsICctLWFjY2VzcycsICdwdWJsaWMnLCAnLS10YWcnLCBkaXN0VGFnXTtcbiAgICAvLyBJZiBhIGN1c3RvbSByZWdpc3RyeSBVUkwgaGFzIGJlZW4gc3BlY2lmaWVkLCBhZGQgdGhlIGAtLXJlZ2lzdHJ5YCBmbGFnLlxuICAgIGlmIChyZWdpc3RyeVVybCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnB1c2goJy0tcmVnaXN0cnknLCByZWdpc3RyeVVybCk7XG4gICAgfVxuICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bignbnBtJywgYXJncywge2N3ZDogcGFja2FnZVBhdGgsIG1vZGU6ICdzaWxlbnQnfSk7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgTlBNIHRhZyB0byB0aGUgc3BlY2lmaWVkIHZlcnNpb24gZm9yIHRoZSBnaXZlbiBwYWNrYWdlLlxuICAgKiBAdGhyb3dzIFdpdGggdGhlIHByb2Nlc3MgbG9nIG91dHB1dCBpZiB0aGUgdGFnZ2luZyBmYWlsZWQuXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgc2V0RGlzdFRhZ0ZvclBhY2thZ2UoXG4gICAgcGFja2FnZU5hbWU6IHN0cmluZyxcbiAgICBkaXN0VGFnOiBzdHJpbmcsXG4gICAgdmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICByZWdpc3RyeVVybDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICApIHtcbiAgICBjb25zdCBhcmdzID0gWydkaXN0LXRhZycsICdhZGQnLCBgJHtwYWNrYWdlTmFtZX1AJHt2ZXJzaW9ufWAsIGRpc3RUYWddO1xuICAgIC8vIElmIGEgY3VzdG9tIHJlZ2lzdHJ5IFVSTCBoYXMgYmVlbiBzcGVjaWZpZWQsIGFkZCB0aGUgYC0tcmVnaXN0cnlgIGZsYWcuXG4gICAgaWYgKHJlZ2lzdHJ5VXJsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3MucHVzaCgnLS1yZWdpc3RyeScsIHJlZ2lzdHJ5VXJsKTtcbiAgICB9XG4gICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKCducG0nLCBhcmdzLCB7bW9kZTogJ3NpbGVudCd9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGVzIHRoZSBzcGVjaWZpZWQgTlBNIHRhZyBmb3IgdGhlIGdpdmVuIHBhY2thZ2UuXG4gICAqIEB0aHJvd3MgV2l0aCB0aGUgcHJvY2VzcyBsb2cgb3V0cHV0IGlmIHRoZSByZW1vdmFsIGZhaWxlZC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBkZWxldGVEaXN0VGFnRm9yUGFja2FnZShcbiAgICBwYWNrYWdlTmFtZTogc3RyaW5nLFxuICAgIGRpc3RUYWc6IHN0cmluZyxcbiAgICByZWdpc3RyeVVybDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICApIHtcbiAgICBjb25zdCBhcmdzID0gWydkaXN0LXRhZycsICdybScsIHBhY2thZ2VOYW1lLCBkaXN0VGFnXTtcbiAgICAvLyBJZiBhIGN1c3RvbSByZWdpc3RyeSBVUkwgaGFzIGJlZW4gc3BlY2lmaWVkLCBhZGQgdGhlIGAtLXJlZ2lzdHJ5YCBmbGFnLlxuICAgIGlmIChyZWdpc3RyeVVybCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnB1c2goJy0tcmVnaXN0cnknLCByZWdpc3RyeVVybCk7XG4gICAgfVxuICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bignbnBtJywgYXJncywge21vZGU6ICdzaWxlbnQnfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHVzZXIgaXMgY3VycmVudGx5IGxvZ2dlZCBpbnRvIE5QTS5cbiAgICogQHJldHVybnMgV2hldGhlciB0aGUgdXNlciBpcyBjdXJyZW50bHkgbG9nZ2VkIGludG8gTlBNLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGNoZWNrSXNMb2dnZWRJbihyZWdpc3RyeVVybDogc3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgYXJncyA9IFsnd2hvYW1pJ107XG4gICAgLy8gSWYgYSBjdXN0b20gcmVnaXN0cnkgVVJMIGhhcyBiZWVuIHNwZWNpZmllZCwgYWRkIHRoZSBgLS1yZWdpc3RyeWAgZmxhZy5cbiAgICBpZiAocmVnaXN0cnlVcmwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXJncy5wdXNoKCctLXJlZ2lzdHJ5JywgcmVnaXN0cnlVcmwpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKCducG0nLCBhcmdzLCB7bW9kZTogJ3NpbGVudCd9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZyBpbnRvIE5QTSBhdCBhIHByb3ZpZGVkIHJlZ2lzdHJ5IHVzaW5nIGFuIGludGVyYWN0aXZlIGludm9jYXRpb24uXG4gICAqIEB0aHJvd3MgV2l0aCB0aGUgYG5wbSBsb2dpbmAgc3RhdHVzIGNvZGUgaWYgdGhlIGxvZ2luIGZhaWxlZC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBzdGFydEludGVyYWN0aXZlTG9naW4ocmVnaXN0cnlVcmw6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGFyZ3MgPSBbJ2xvZ2luJywgJy0tbm8tYnJvd3NlciddO1xuICAgIC8vIElmIGEgY3VzdG9tIHJlZ2lzdHJ5IFVSTCBoYXMgYmVlbiBzcGVjaWZpZWQsIGFkZCB0aGUgYC0tcmVnaXN0cnlgIGZsYWcuIFRoZSBgLS1yZWdpc3RyeWAgZmxhZ1xuICAgIC8vIG11c3QgYmUgc3BsaWNlZCBpbnRvIHRoZSBjb3JyZWN0IHBsYWNlIGluIHRoZSBjb21tYW5kIGFzIG5wbSBleHBlY3RzIGl0IHRvIGJlIHRoZSBmbGFnXG4gICAgLy8gaW1tZWRpYXRlbHkgZm9sbG93aW5nIHRoZSBsb2dpbiBzdWJjb21tYW5kLlxuICAgIGlmIChyZWdpc3RyeVVybCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnNwbGljZSgxLCAwLCAnLS1yZWdpc3RyeScsIHJlZ2lzdHJ5VXJsKTtcbiAgICB9XG4gICAgLy8gVGhlIGxvZ2luIGNvbW1hbmQgcHJvbXB0cyBmb3IgdXNlcm5hbWUsIHBhc3N3b3JkIGFuZCBvdGhlciBwcm9maWxlIGluZm9ybWF0aW9uLiBIZW5jZVxuICAgIC8vIHRoZSBwcm9jZXNzIG5lZWRzIHRvIGJlIGludGVyYWN0aXZlIChpLmUuIHJlc3BlY3RpbmcgY3VycmVudCBUVFlzIHN0ZGluKS5cbiAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd25JbnRlcmFjdGl2ZSgnbnBtJywgYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogTG9nIG91dCBvZiBOUE0gYXQgYSBwcm92aWRlZCByZWdpc3RyeS5cbiAgICogQHJldHVybnMgV2hldGhlciB0aGUgdXNlciB3YXMgbG9nZ2VkIG91dCBvZiBOUE0uXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgbG9nb3V0KHJlZ2lzdHJ5VXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBhcmdzID0gWydsb2dvdXQnXTtcbiAgICAvLyBJZiBhIGN1c3RvbSByZWdpc3RyeSBVUkwgaGFzIGJlZW4gc3BlY2lmaWVkLCBhZGQgdGhlIGAtLXJlZ2lzdHJ5YCBmbGFnLiBUaGUgYC0tcmVnaXN0cnlgIGZsYWdcbiAgICAvLyBtdXN0IGJlIHNwbGljZWQgaW50byB0aGUgY29ycmVjdCBwbGFjZSBpbiB0aGUgY29tbWFuZCBhcyBucG0gZXhwZWN0cyBpdCB0byBiZSB0aGUgZmxhZ1xuICAgIC8vIGltbWVkaWF0ZWx5IGZvbGxvd2luZyB0aGUgbG9nb3V0IHN1YmNvbW1hbmQuXG4gICAgaWYgKHJlZ2lzdHJ5VXJsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3Muc3BsaWNlKDEsIDAsICctLXJlZ2lzdHJ5JywgcmVnaXN0cnlVcmwpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKCducG0nLCBhcmdzLCB7bW9kZTogJ3NpbGVudCd9KTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgcmV0dXJuIHRoaXMuY2hlY2tJc0xvZ2dlZEluKHJlZ2lzdHJ5VXJsKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==