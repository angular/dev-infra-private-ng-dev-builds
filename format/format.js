import { green, Log } from '../utils/logging.js';
import { Prompt } from '../utils/prompt.js';
import { runFormatterInParallel } from './run-commands-parallel.js';
export async function formatFiles(files) {
    let failures = await runFormatterInParallel(files, 'format');
    if (failures === false) {
        Log.info('No files matched for formatting.');
        return 0;
    }
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
export async function checkFiles(files) {
    const failures = await runFormatterInParallel(files, 'check');
    if (failures === false) {
        Log.info('No files matched for formatting check.');
        return 0;
    }
    if (failures.length) {
        Log.warn.group('\nThe following files are out of format:');
        for (const { filePath } of failures) {
            Log.warn(`  • ${filePath}`);
        }
        Log.warn.groupEnd();
        Log.warn();
        let runFormatter = false;
        if (!process.env['CI']) {
            runFormatter = await Prompt.confirm({ message: 'Format the files now?', default: true });
        }
        if (runFormatter) {
            return (await formatFiles(failures.map((f) => f.filePath))) || 0;
        }
        else {
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
//# sourceMappingURL=format.js.map