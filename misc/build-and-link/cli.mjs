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
        await ChildProcess.spawn('pnpm', ['--dir', outputPath, 'link', '--global']);
        await ChildProcess.spawn('pnpm', ['--dir', projectRoot, 'link', '--global', name]);
    }
    Log.info(green(` ✓  Linked release packages in provided project.`));
}
/** CLI command module. */
export const BuildAndLinkCommandModule = {
    builder,
    handler,
    command: 'build-and-link <projectRoot>',
    describe: 'Builds the release output, registers the outputs as linked, and links via pnpm to the provided project',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L21pc2MvYnVpbGQtYW5kLWxpbmsvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDN0IsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUc3QixPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDekQsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQzFELE9BQU8sRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ2hELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBT3ZFLDZDQUE2QztBQUM3QyxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUU7UUFDcEMsSUFBSSxFQUFFLFFBQVE7UUFDZCxTQUFTLEVBQUUsSUFBSTtRQUNmLE1BQU0sRUFBRSxDQUFDLElBQVksRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztRQUN2QyxZQUFZLEVBQUUsSUFBSTtLQUNuQixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsNkNBQTZDO0FBQzdDLEtBQUssVUFBVSxPQUFPLENBQUMsRUFBQyxXQUFXLEVBQWlDO0lBQ2xFLElBQUksQ0FBQztRQUNILElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztZQUMxQyxHQUFHLENBQUMsS0FBSyxDQUFDLGdEQUFnRCxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxHQUFHLENBQUMsS0FBSyxDQUFDLG9EQUFvRCxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxFQUFFLENBQUM7SUFDakMsd0JBQXdCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFakMsTUFBTSxhQUFhLEdBQUcsTUFBTSxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUM7SUFFdEQsSUFBSSxhQUFhLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDM0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO1FBQzlFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztJQUU3QyxLQUFLLE1BQU0sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFDLElBQUksYUFBYSxFQUFFLENBQUM7UUFDL0MsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDNUUsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3JGLENBQUM7SUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDLENBQUM7QUFDdEUsQ0FBQztBQUVELDBCQUEwQjtBQUMxQixNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBMkM7SUFDL0UsT0FBTztJQUNQLE9BQU87SUFDUCxPQUFPLEVBQUUsOEJBQThCO0lBQ3ZDLFFBQVEsRUFDTix3R0FBd0c7Q0FDM0csQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2xzdGF0U3luY30gZnJvbSAnZnMnO1xuaW1wb3J0IHtyZXNvbHZlfSBmcm9tICdwYXRoJztcbmltcG9ydCB7QXJndiwgQXJndW1lbnRzLCBDb21tYW5kTW9kdWxlfSBmcm9tICd5YXJncyc7XG5cbmltcG9ydCB7QnVpbGRXb3JrZXJ9IGZyb20gJy4uLy4uL3JlbGVhc2UvYnVpbGQvaW5kZXguanMnO1xuaW1wb3J0IHtDaGlsZFByb2Nlc3N9IGZyb20gJy4uLy4uL3V0aWxzL2NoaWxkLXByb2Nlc3MuanMnO1xuaW1wb3J0IHtMb2csIGdyZWVufSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7Z2V0Q29uZmlnfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHthc3NlcnRWYWxpZFJlbGVhc2VDb25maWd9IGZyb20gJy4uLy4uL3JlbGVhc2UvY29uZmlnL2luZGV4LmpzJztcblxuLyoqIENvbW1hbmQgbGluZSBvcHRpb25zLiAqL1xuZXhwb3J0IGludGVyZmFjZSBCdWlsZEFuZExpbmtPcHRpb25zIHtcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbn1cblxuLyoqIFlhcmdzIGNvbW1hbmQgYnVpbGRlciBmb3IgdGhlIGNvbW1hbmQuICovXG5mdW5jdGlvbiBidWlsZGVyKGFyZ3Y6IEFyZ3YpOiBBcmd2PEJ1aWxkQW5kTGlua09wdGlvbnM+IHtcbiAgcmV0dXJuIGFyZ3YucG9zaXRpb25hbCgncHJvamVjdFJvb3QnLCB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgbm9ybWFsaXplOiB0cnVlLFxuICAgIGNvZXJjZTogKHBhdGg6IHN0cmluZykgPT4gcmVzb2x2ZShwYXRoKSxcbiAgICBkZW1hbmRPcHRpb246IHRydWUsXG4gIH0pO1xufVxuXG4vKiogWWFyZ3MgY29tbWFuZCBoYW5kbGVyIGZvciB0aGUgY29tbWFuZC4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoe3Byb2plY3RSb290fTogQXJndW1lbnRzPEJ1aWxkQW5kTGlua09wdGlvbnM+KSB7XG4gIHRyeSB7XG4gICAgaWYgKCFsc3RhdFN5bmMocHJvamVjdFJvb3QpLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBUaGUgJ3Byb2plY3RSb290JyBtdXN0IGJlIGEgZGlyZWN0b3J5OiAke3Byb2plY3RSb290fWApO1xuICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cbiAgfSBjYXRjaCB7XG4gICAgTG9nLmVycm9yKGAgIOKcmCAgIENvdWxkIG5vdCBmaW5kIHRoZSAncHJvamVjdFJvb3QnIHByb3ZpZGVkOiAke3Byb2plY3RSb290fWApO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxuXG4gIGNvbnN0IGNvbmZpZyA9IGF3YWl0IGdldENvbmZpZygpO1xuICBhc3NlcnRWYWxpZFJlbGVhc2VDb25maWcoY29uZmlnKTtcblxuICBjb25zdCBidWlsdFBhY2thZ2VzID0gYXdhaXQgQnVpbGRXb3JrZXIuaW52b2tlQnVpbGQoKTtcblxuICBpZiAoYnVpbHRQYWNrYWdlcyA9PT0gbnVsbCkge1xuICAgIExvZy5lcnJvcihgICDinJggICBDb3VsZCBub3QgYnVpbGQgcmVsZWFzZSBvdXRwdXQuIFBsZWFzZSBjaGVjayBvdXRwdXQgYWJvdmUuYCk7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG4gIExvZy5pbmZvKGdyZWVuKGAg4pyTICBCdWlsdCByZWxlYXNlIG91dHB1dC5gKSk7XG5cbiAgZm9yIChjb25zdCB7b3V0cHV0UGF0aCwgbmFtZX0gb2YgYnVpbHRQYWNrYWdlcykge1xuICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bigncG5wbScsIFsnLS1kaXInLCBvdXRwdXRQYXRoLCAnbGluaycsICctLWdsb2JhbCddKTtcbiAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oJ3BucG0nLCBbJy0tZGlyJywgcHJvamVjdFJvb3QsICdsaW5rJywgJy0tZ2xvYmFsJywgbmFtZV0pO1xuICB9XG5cbiAgTG9nLmluZm8oZ3JlZW4oYCDinJMgIExpbmtlZCByZWxlYXNlIHBhY2thZ2VzIGluIHByb3ZpZGVkIHByb2plY3QuYCkpO1xufVxuXG4vKiogQ0xJIGNvbW1hbmQgbW9kdWxlLiAqL1xuZXhwb3J0IGNvbnN0IEJ1aWxkQW5kTGlua0NvbW1hbmRNb2R1bGU6IENvbW1hbmRNb2R1bGU8e30sIEJ1aWxkQW5kTGlua09wdGlvbnM+ID0ge1xuICBidWlsZGVyLFxuICBoYW5kbGVyLFxuICBjb21tYW5kOiAnYnVpbGQtYW5kLWxpbmsgPHByb2plY3RSb290PicsXG4gIGRlc2NyaWJlOlxuICAgICdCdWlsZHMgdGhlIHJlbGVhc2Ugb3V0cHV0LCByZWdpc3RlcnMgdGhlIG91dHB1dHMgYXMgbGlua2VkLCBhbmQgbGlua3MgdmlhIHBucG0gdG8gdGhlIHByb3ZpZGVkIHByb2plY3QnLFxufTtcbiJdfQ==