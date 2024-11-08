/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { green, Log } from '../utils/logging.js';
import { Prompt } from '../utils/prompt.js';
import { runFormatterInParallel } from './run-commands-parallel.js';
/**
 * Format provided files in place.
 *
 * @returns a status code indicating whether the formatting run was successful.
 */
export async function formatFiles(files) {
    // Whether any files failed to format.
    let failures = await runFormatterInParallel(files, 'format');
    if (failures === false) {
        Log.info('No files matched for formatting.');
        return 0;
    }
    // The process should exit as a failure if any of the files failed to format.
    if (failures.length !== 0) {
        Log.error(`The following files could not be formatted:`);
        failures.forEach(({ filePath, message }) => {
            Log.info(`  • ${filePath}: ${message}`);
        });
        Log.error(`Formatting failed, see errors above for more information.`);
        return 1;
    }
    Log.info(green(`✔  Formatting complete.`));
    return 0;
}
/**
 * Check provided files for formatting correctness.
 *
 * @returns a status code indicating whether the format check run was successful.
 */
export async function checkFiles(files) {
    // Files which are currently not formatted correctly.
    const failures = await runFormatterInParallel(files, 'check');
    if (failures === false) {
        Log.info('No files matched for formatting check.');
        return 0;
    }
    if (failures.length) {
        // Provide output expressing which files are failing formatting.
        Log.warn.group('\nThe following files are out of format:');
        for (const { filePath } of failures) {
            Log.warn(`  • ${filePath}`);
        }
        Log.warn.groupEnd();
        Log.warn();
        // If the command is run in a non-CI environment, prompt to format the files immediately.
        let runFormatter = false;
        if (!process.env['CI']) {
            runFormatter = await Prompt.confirm({ message: 'Format the files now?', default: true });
        }
        if (runFormatter) {
            // Format the failing files as requested.
            return (await formatFiles(failures.map((f) => f.filePath))) || 0;
        }
        else {
            // Inform user how to format files in the future.
            Log.info();
            Log.info(`To format the failing file run the following command:`);
            Log.info(`  yarn ng-dev format files ${failures.map((f) => f.filePath).join(' ')}`);
            return 1;
        }
    }
    else {
        Log.info(green('✔  All files correctly formatted.'));
        return 0;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybWF0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L2Zvcm1hdC9mb3JtYXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUMvQyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFFMUMsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFbEU7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsV0FBVyxDQUFDLEtBQWU7SUFDL0Msc0NBQXNDO0lBQ3RDLElBQUksUUFBUSxHQUFHLE1BQU0sc0JBQXNCLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBRTdELElBQUksUUFBUSxLQUFLLEtBQUssRUFBRSxDQUFDO1FBQ3ZCLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLENBQUMsQ0FBQztRQUM3QyxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFFRCw2RUFBNkU7SUFDN0UsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzFCLEdBQUcsQ0FBQyxLQUFLLENBQUMsNkNBQTZDLENBQUMsQ0FBQztRQUN6RCxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBQyxRQUFRLEVBQUUsT0FBTyxFQUFDLEVBQUUsRUFBRTtZQUN2QyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sUUFBUSxLQUFLLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUM7UUFDSCxHQUFHLENBQUMsS0FBSyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7UUFDdkUsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDO0lBQzNDLE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLFVBQVUsQ0FBQyxLQUFlO0lBQzlDLHFEQUFxRDtJQUNyRCxNQUFNLFFBQVEsR0FBRyxNQUFNLHNCQUFzQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztJQUU5RCxJQUFJLFFBQVEsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUN2QixHQUFHLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxDQUFDLENBQUM7UUFDbkQsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDcEIsZ0VBQWdFO1FBQ2hFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7UUFDM0QsS0FBSyxNQUFNLEVBQUMsUUFBUSxFQUFDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDbEMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRVgseUZBQXlGO1FBQ3pGLElBQUksWUFBWSxHQUFHLEtBQUssQ0FBQztRQUN6QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3ZCLFlBQVksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBQyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7UUFDekYsQ0FBQztRQUVELElBQUksWUFBWSxFQUFFLENBQUM7WUFDakIseUNBQXlDO1lBQ3pDLE9BQU8sQ0FBQyxNQUFNLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRSxDQUFDO2FBQU0sQ0FBQztZQUNOLGlEQUFpRDtZQUNqRCxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDWCxHQUFHLENBQUMsSUFBSSxDQUFDLHVEQUF1RCxDQUFDLENBQUM7WUFDbEUsR0FBRyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDcEYsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztTQUFNLENBQUM7UUFDTixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDLENBQUM7UUFDckQsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2dyZWVuLCBMb2d9IGZyb20gJy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uL3V0aWxzL3Byb21wdC5qcyc7XG5cbmltcG9ydCB7cnVuRm9ybWF0dGVySW5QYXJhbGxlbH0gZnJvbSAnLi9ydW4tY29tbWFuZHMtcGFyYWxsZWwuanMnO1xuXG4vKipcbiAqIEZvcm1hdCBwcm92aWRlZCBmaWxlcyBpbiBwbGFjZS5cbiAqXG4gKiBAcmV0dXJucyBhIHN0YXR1cyBjb2RlIGluZGljYXRpbmcgd2hldGhlciB0aGUgZm9ybWF0dGluZyBydW4gd2FzIHN1Y2Nlc3NmdWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmb3JtYXRGaWxlcyhmaWxlczogc3RyaW5nW10pOiBQcm9taXNlPDEgfCAwPiB7XG4gIC8vIFdoZXRoZXIgYW55IGZpbGVzIGZhaWxlZCB0byBmb3JtYXQuXG4gIGxldCBmYWlsdXJlcyA9IGF3YWl0IHJ1bkZvcm1hdHRlckluUGFyYWxsZWwoZmlsZXMsICdmb3JtYXQnKTtcblxuICBpZiAoZmFpbHVyZXMgPT09IGZhbHNlKSB7XG4gICAgTG9nLmluZm8oJ05vIGZpbGVzIG1hdGNoZWQgZm9yIGZvcm1hdHRpbmcuJyk7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvLyBUaGUgcHJvY2VzcyBzaG91bGQgZXhpdCBhcyBhIGZhaWx1cmUgaWYgYW55IG9mIHRoZSBmaWxlcyBmYWlsZWQgdG8gZm9ybWF0LlxuICBpZiAoZmFpbHVyZXMubGVuZ3RoICE9PSAwKSB7XG4gICAgTG9nLmVycm9yKGBUaGUgZm9sbG93aW5nIGZpbGVzIGNvdWxkIG5vdCBiZSBmb3JtYXR0ZWQ6YCk7XG4gICAgZmFpbHVyZXMuZm9yRWFjaCgoe2ZpbGVQYXRoLCBtZXNzYWdlfSkgPT4ge1xuICAgICAgTG9nLmluZm8oYCAg4oCiICR7ZmlsZVBhdGh9OiAke21lc3NhZ2V9YCk7XG4gICAgfSk7XG4gICAgTG9nLmVycm9yKGBGb3JtYXR0aW5nIGZhaWxlZCwgc2VlIGVycm9ycyBhYm92ZSBmb3IgbW9yZSBpbmZvcm1hdGlvbi5gKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuICBMb2cuaW5mbyhncmVlbihg4pyUICBGb3JtYXR0aW5nIGNvbXBsZXRlLmApKTtcbiAgcmV0dXJuIDA7XG59XG5cbi8qKlxuICogQ2hlY2sgcHJvdmlkZWQgZmlsZXMgZm9yIGZvcm1hdHRpbmcgY29ycmVjdG5lc3MuXG4gKlxuICogQHJldHVybnMgYSBzdGF0dXMgY29kZSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIGZvcm1hdCBjaGVjayBydW4gd2FzIHN1Y2Nlc3NmdWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja0ZpbGVzKGZpbGVzOiBzdHJpbmdbXSkge1xuICAvLyBGaWxlcyB3aGljaCBhcmUgY3VycmVudGx5IG5vdCBmb3JtYXR0ZWQgY29ycmVjdGx5LlxuICBjb25zdCBmYWlsdXJlcyA9IGF3YWl0IHJ1bkZvcm1hdHRlckluUGFyYWxsZWwoZmlsZXMsICdjaGVjaycpO1xuXG4gIGlmIChmYWlsdXJlcyA9PT0gZmFsc2UpIHtcbiAgICBMb2cuaW5mbygnTm8gZmlsZXMgbWF0Y2hlZCBmb3IgZm9ybWF0dGluZyBjaGVjay4nKTtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIGlmIChmYWlsdXJlcy5sZW5ndGgpIHtcbiAgICAvLyBQcm92aWRlIG91dHB1dCBleHByZXNzaW5nIHdoaWNoIGZpbGVzIGFyZSBmYWlsaW5nIGZvcm1hdHRpbmcuXG4gICAgTG9nLndhcm4uZ3JvdXAoJ1xcblRoZSBmb2xsb3dpbmcgZmlsZXMgYXJlIG91dCBvZiBmb3JtYXQ6Jyk7XG4gICAgZm9yIChjb25zdCB7ZmlsZVBhdGh9IG9mIGZhaWx1cmVzKSB7XG4gICAgICBMb2cud2FybihgICDigKIgJHtmaWxlUGF0aH1gKTtcbiAgICB9XG4gICAgTG9nLndhcm4uZ3JvdXBFbmQoKTtcbiAgICBMb2cud2FybigpO1xuXG4gICAgLy8gSWYgdGhlIGNvbW1hbmQgaXMgcnVuIGluIGEgbm9uLUNJIGVudmlyb25tZW50LCBwcm9tcHQgdG8gZm9ybWF0IHRoZSBmaWxlcyBpbW1lZGlhdGVseS5cbiAgICBsZXQgcnVuRm9ybWF0dGVyID0gZmFsc2U7XG4gICAgaWYgKCFwcm9jZXNzLmVudlsnQ0knXSkge1xuICAgICAgcnVuRm9ybWF0dGVyID0gYXdhaXQgUHJvbXB0LmNvbmZpcm0oe21lc3NhZ2U6ICdGb3JtYXQgdGhlIGZpbGVzIG5vdz8nLCBkZWZhdWx0OiB0cnVlfSk7XG4gICAgfVxuXG4gICAgaWYgKHJ1bkZvcm1hdHRlcikge1xuICAgICAgLy8gRm9ybWF0IHRoZSBmYWlsaW5nIGZpbGVzIGFzIHJlcXVlc3RlZC5cbiAgICAgIHJldHVybiAoYXdhaXQgZm9ybWF0RmlsZXMoZmFpbHVyZXMubWFwKChmKSA9PiBmLmZpbGVQYXRoKSkpIHx8IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEluZm9ybSB1c2VyIGhvdyB0byBmb3JtYXQgZmlsZXMgaW4gdGhlIGZ1dHVyZS5cbiAgICAgIExvZy5pbmZvKCk7XG4gICAgICBMb2cuaW5mbyhgVG8gZm9ybWF0IHRoZSBmYWlsaW5nIGZpbGUgcnVuIHRoZSBmb2xsb3dpbmcgY29tbWFuZDpgKTtcbiAgICAgIExvZy5pbmZvKGAgIHlhcm4gbmctZGV2IGZvcm1hdCBmaWxlcyAke2ZhaWx1cmVzLm1hcCgoZikgPT4gZi5maWxlUGF0aCkuam9pbignICcpfWApO1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIExvZy5pbmZvKGdyZWVuKCfinJQgIEFsbCBmaWxlcyBjb3JyZWN0bHkgZm9ybWF0dGVkLicpKTtcbiAgICByZXR1cm4gMDtcbiAgfVxufVxuIl19