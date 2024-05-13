/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { lstatSync } from 'fs';
import { resolve } from 'path';
import { BuildWorker } from '../../release/build/index.js';
import { ChildProcess } from '../../utils/child-process.js';
import { Log, green } from '../../utils/logging.js';
import { getConfig } from '../../utils/config.js';
import { assertValidReleaseConfig } from '../../release/config/index.js';
/** Yargs command builder for the command. */
function builder(argv) {
    return argv.positional('projectRoot', {
        type: 'string',
        normalize: true,
        coerce: (path) => resolve(path),
        demandOption: true,
    });
}
/** Yargs command handler for the command. */
async function handler({ projectRoot }) {
    try {
        if (!lstatSync(projectRoot).isDirectory()) {
            Log.error(`  ✘   The 'projectRoot' must be a directory: ${projectRoot}`);
            process.exit(1);
        }
    }
    catch {
        Log.error(`  ✘   Could not find the 'projectRoot' provided: ${projectRoot}`);
        process.exit(1);
    }
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const builtPackages = await BuildWorker.invokeBuild();
    if (builtPackages === null) {
        Log.error(`  ✘   Could not build release output. Please check output above.`);
        process.exit(1);
    }
    Log.info(green(` ✓  Built release output.`));
    for (const { outputPath, name } of builtPackages) {
        await ChildProcess.spawn('yarn', ['link', '--cwd', outputPath]);
        await ChildProcess.spawn('yarn', ['link', '--cwd', projectRoot, name]);
    }
    Log.info(green(` ✓  Linked release packages in provided project.`));
}
/** CLI command module. */
export const BuildAndLinkCommandModule = {
    builder,
    handler,
    command: 'build-and-link <projectRoot>',
    describe: 'Builds the release output, registers the outputs as linked, and links via yarn to the provided project',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L21pc2MvYnVpbGQtYW5kLWxpbmsvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDN0IsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUc3QixPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDekQsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQzFELE9BQU8sRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2hELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBT3ZFLDZDQUE2QztBQUM3QyxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUU7UUFDcEMsSUFBSSxFQUFFLFFBQVE7UUFDZCxTQUFTLEVBQUUsSUFBSTtRQUNmLE1BQU0sRUFBRSxDQUFDLElBQVksRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztRQUN2QyxZQUFZLEVBQUUsSUFBSTtLQUNuQixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsNkNBQTZDO0FBQzdDLEtBQUssVUFBVSxPQUFPLENBQUMsRUFBQyxXQUFXLEVBQWlDO0lBQ2xFLElBQUksQ0FBQztRQUNILElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztZQUMxQyxHQUFHLENBQUMsS0FBSyxDQUFDLGdEQUFnRCxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxHQUFHLENBQUMsS0FBSyxDQUFDLG9EQUFvRCxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxFQUFFLENBQUM7SUFDakMsd0JBQXdCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFakMsTUFBTSxhQUFhLEdBQUcsTUFBTSxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUM7SUFFdEQsSUFBSSxhQUFhLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDM0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO1FBQzlFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztJQUU3QyxLQUFLLE1BQU0sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFDLElBQUksYUFBYSxFQUFFLENBQUM7UUFDL0MsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNoRSxNQUFNLFlBQVksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQyxDQUFDO0FBQ3RFLENBQUM7QUFFRCwwQkFBMEI7QUFDMUIsTUFBTSxDQUFDLE1BQU0seUJBQXlCLEdBQTJDO0lBQy9FLE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLDhCQUE4QjtJQUN2QyxRQUFRLEVBQ04sd0dBQXdHO0NBQzNHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtsc3RhdFN5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCB7cmVzb2x2ZX0gZnJvbSAncGF0aCc7XG5pbXBvcnQge0FyZ3YsIEFyZ3VtZW50cywgQ29tbWFuZE1vZHVsZX0gZnJvbSAneWFyZ3MnO1xuXG5pbXBvcnQge0J1aWxkV29ya2VyfSBmcm9tICcuLi8uLi9yZWxlYXNlL2J1aWxkL2luZGV4LmpzJztcbmltcG9ydCB7Q2hpbGRQcm9jZXNzfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7TG9nLCBncmVlbn0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge2dldENvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7YXNzZXJ0VmFsaWRSZWxlYXNlQ29uZmlnfSBmcm9tICcuLi8uLi9yZWxlYXNlL2NvbmZpZy9pbmRleC5qcyc7XG5cbi8qKiBDb21tYW5kIGxpbmUgb3B0aW9ucy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRBbmRMaW5rT3B0aW9ucyB7XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG59XG5cbi8qKiBZYXJncyBjb21tYW5kIGJ1aWxkZXIgZm9yIHRoZSBjb21tYW5kLiAqL1xuZnVuY3Rpb24gYnVpbGRlcihhcmd2OiBBcmd2KTogQXJndjxCdWlsZEFuZExpbmtPcHRpb25zPiB7XG4gIHJldHVybiBhcmd2LnBvc2l0aW9uYWwoJ3Byb2plY3RSb290Jywge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIG5vcm1hbGl6ZTogdHJ1ZSxcbiAgICBjb2VyY2U6IChwYXRoOiBzdHJpbmcpID0+IHJlc29sdmUocGF0aCksXG4gICAgZGVtYW5kT3B0aW9uOiB0cnVlLFxuICB9KTtcbn1cblxuLyoqIFlhcmdzIGNvbW1hbmQgaGFuZGxlciBmb3IgdGhlIGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKHtwcm9qZWN0Um9vdH06IEFyZ3VtZW50czxCdWlsZEFuZExpbmtPcHRpb25zPikge1xuICB0cnkge1xuICAgIGlmICghbHN0YXRTeW5jKHByb2plY3RSb290KS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgVGhlICdwcm9qZWN0Um9vdCcgbXVzdCBiZSBhIGRpcmVjdG9yeTogJHtwcm9qZWN0Um9vdH1gKTtcbiAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG4gIH0gY2F0Y2gge1xuICAgIExvZy5lcnJvcihgICDinJggICBDb3VsZCBub3QgZmluZCB0aGUgJ3Byb2plY3RSb290JyBwcm92aWRlZDogJHtwcm9qZWN0Um9vdH1gKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cblxuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoKTtcbiAgYXNzZXJ0VmFsaWRSZWxlYXNlQ29uZmlnKGNvbmZpZyk7XG5cbiAgY29uc3QgYnVpbHRQYWNrYWdlcyA9IGF3YWl0IEJ1aWxkV29ya2VyLmludm9rZUJ1aWxkKCk7XG5cbiAgaWYgKGJ1aWx0UGFja2FnZXMgPT09IG51bGwpIHtcbiAgICBMb2cuZXJyb3IoYCAg4pyYICAgQ291bGQgbm90IGJ1aWxkIHJlbGVhc2Ugb3V0cHV0LiBQbGVhc2UgY2hlY2sgb3V0cHV0IGFib3ZlLmApO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxuICBMb2cuaW5mbyhncmVlbihgIOKckyAgQnVpbHQgcmVsZWFzZSBvdXRwdXQuYCkpO1xuXG4gIGZvciAoY29uc3Qge291dHB1dFBhdGgsIG5hbWV9IG9mIGJ1aWx0UGFja2FnZXMpIHtcbiAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oJ3lhcm4nLCBbJ2xpbmsnLCAnLS1jd2QnLCBvdXRwdXRQYXRoXSk7XG4gICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKCd5YXJuJywgWydsaW5rJywgJy0tY3dkJywgcHJvamVjdFJvb3QsIG5hbWVdKTtcbiAgfVxuXG4gIExvZy5pbmZvKGdyZWVuKGAg4pyTICBMaW5rZWQgcmVsZWFzZSBwYWNrYWdlcyBpbiBwcm92aWRlZCBwcm9qZWN0LmApKTtcbn1cblxuLyoqIENMSSBjb21tYW5kIG1vZHVsZS4gKi9cbmV4cG9ydCBjb25zdCBCdWlsZEFuZExpbmtDb21tYW5kTW9kdWxlOiBDb21tYW5kTW9kdWxlPHt9LCBCdWlsZEFuZExpbmtPcHRpb25zPiA9IHtcbiAgYnVpbGRlcixcbiAgaGFuZGxlcixcbiAgY29tbWFuZDogJ2J1aWxkLWFuZC1saW5rIDxwcm9qZWN0Um9vdD4nLFxuICBkZXNjcmliZTpcbiAgICAnQnVpbGRzIHRoZSByZWxlYXNlIG91dHB1dCwgcmVnaXN0ZXJzIHRoZSBvdXRwdXRzIGFzIGxpbmtlZCwgYW5kIGxpbmtzIHZpYSB5YXJuIHRvIHRoZSBwcm92aWRlZCBwcm9qZWN0Jyxcbn07XG4iXX0=