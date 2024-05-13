/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
/**
 * Supported levels for logging functions. Levels are mapped to
 * numbers to represent a hierarchy of logging levels.
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["SILENT"] = 0] = "SILENT";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["LOG"] = 3] = "LOG";
    LogLevel[LogLevel["INFO"] = 4] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 5] = "DEBUG";
})(LogLevel || (LogLevel = {}));
/** Default log level for the tool. */
export const DEFAULT_LOG_LEVEL = LogLevel.INFO;
/** Reexport of chalk colors for convenient access. */
export const red = chalk.red;
export const reset = chalk.reset;
export const green = chalk.green;
export const yellow = chalk.yellow;
export const bold = chalk.bold;
export const blue = chalk.blue;
export const underline = chalk.underline;
/** Class used for logging to the console and to a ng-dev log file. */
export class Log {
}
/** Write to the console for at INFO logging level */
Log.info = buildLogLevelFunction(() => console.info, LogLevel.INFO, null);
/** Write to the console for at ERROR logging level */
Log.error = buildLogLevelFunction(() => console.error, LogLevel.ERROR, chalk.red);
/** Write to the console for at DEBUG logging level */
Log.debug = buildLogLevelFunction(() => console.debug, LogLevel.DEBUG, null);
/** Write to the console for at LOG logging level */
Log.log = buildLogLevelFunction(() => console.log, LogLevel.LOG, null);
/** Write to the console for at WARN logging level */
Log.warn = buildLogLevelFunction(() => console.warn, LogLevel.WARN, chalk.yellow);
/** Build an instance of a logging function for the provided level. */
function buildLogLevelFunction(loadCommand, level, defaultColor) {
    /** Write to stdout for the LOG_LEVEL. */
    const loggingFunction = (...values) => {
        runConsoleCommand(loadCommand, level, 
        // For string values, apply the default color.
        ...values.map((v) => (typeof v === 'string' && defaultColor ? defaultColor(v) : v)));
    };
    /** Start a group at the LOG_LEVEL, optionally starting it as collapsed. */
    loggingFunction.group = (label, collapsed = false) => {
        const command = collapsed ? console.groupCollapsed : console.group;
        runConsoleCommand(() => command, level, defaultColor ? defaultColor(label) : label);
    };
    /** End the group at the LOG_LEVEL. */
    loggingFunction.groupEnd = () => {
        runConsoleCommand(() => console.groupEnd, level);
    };
    return loggingFunction;
}
/**
 * Run the console command provided, if the environments logging level greater than the
 * provided logging level.
 *
 * The loadCommand takes in a function which is called to retrieve the console.* function
 * to allow for jasmine spies to still work in testing.  Without this method of retrieval
 * the console.* function, the function is saved into the closure of the created logging
 * function before jasmine can spy.
 */
function runConsoleCommand(loadCommand, logLevel, ...text) {
    if (getLogLevel() >= logLevel) {
        loadCommand()(...text);
    }
    printToLogFile(logLevel, ...text);
}
/**
 * Retrieve the log level from environment variables, if the value found
 * based on the LOG_LEVEL environment variable is undefined, return the default
 * logging level.
 */
function getLogLevel() {
    const logLevel = Object.keys(LogLevel).indexOf((process.env[`LOG_LEVEL`] || '').toUpperCase());
    if (logLevel === -1) {
        return DEFAULT_LOG_LEVEL;
    }
    return logLevel;
}
/** All text to write to the log file. */
let LOGGED_TEXT = '';
/** Whether file logging as been enabled. */
let FILE_LOGGING_ENABLED = false;
/**
 * The number of columns used in the prepended log level information on each line of the logging
 * output file.
 */
const LOG_LEVEL_COLUMNS = 7;
/**
 * Enable writing the logged outputs to the log file on process exit, sets initial lines from the
 * command execution, containing information about the timing and command parameters.
 *
 * This is expected to be called only once during a command run, and should be called by the
 * middleware of yargs to enable the file logging before the rest of the command parsing and
 * response is executed.
 */
export async function captureLogOutputForCommand(argv) {
    // TODO(josephperrott): remove this guard against running multiple times after
    //   https://github.com/yargs/yargs/issues/2223 is fixed
    if (FILE_LOGGING_ENABLED) {
        return;
    }
    const repoDir = determineRepoBaseDirFromCwd();
    /** The date time used for timestamping when the command was invoked. */
    const now = new Date();
    /** Header line to separate command runs in log files. */
    const headerLine = Array(100).fill('#').join('');
    LOGGED_TEXT += `${headerLine}\nCommand: ${argv.$0} ${argv._.join(' ')}\nRan at: ${now}\n`;
    // On process exit, write the logged output to the appropriate log files
    process.on('exit', (code) => {
        LOGGED_TEXT += `${headerLine}\n`;
        LOGGED_TEXT += `Command ran in ${new Date().getTime() - now.getTime()}ms\n`;
        LOGGED_TEXT += `Exit Code: ${code}\n`;
        /** Path to the log file location. */
        const logFilePath = join(repoDir, '.ng-dev.log');
        // Strip ANSI escape codes from log outputs.
        LOGGED_TEXT = LOGGED_TEXT.replace(/\x1B\[([0-9]{1,3}(;[0-9]{1,2})?)?[mGK]/g, '');
        writeFileSync(logFilePath, LOGGED_TEXT);
        // For failure codes greater than 1, the new logged lines should be written to a specific log
        // file for the command run failure.
        if (code > 1) {
            const logFileName = `.ng-dev.err-${now.getTime()}.log`;
            console.error(`Exit code: ${code}. Writing full log to ${logFileName}`);
            writeFileSync(join(repoDir, logFileName), LOGGED_TEXT);
        }
    });
    // Mark file logging as enabled to prevent the function from executing multiple times.
    FILE_LOGGING_ENABLED = true;
}
/** Write the provided text to the log file, prepending each line with the log level.  */
function printToLogFile(logLevel, ...text) {
    const logLevelText = `${LogLevel[logLevel]}:`.padEnd(LOG_LEVEL_COLUMNS);
    LOGGED_TEXT += text
        .join(' ')
        .split('\n')
        .map((l) => `${logLevelText} ${l}\n`)
        .join('');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9sb2dnaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBc0IsTUFBTSxPQUFPLENBQUM7QUFDM0MsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLElBQUksQ0FBQztBQUNqQyxPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBRTFCLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRWhFOzs7R0FHRztBQUNILE1BQU0sQ0FBTixJQUFZLFFBT1g7QUFQRCxXQUFZLFFBQVE7SUFDbEIsMkNBQVUsQ0FBQTtJQUNWLHlDQUFTLENBQUE7SUFDVCx1Q0FBUSxDQUFBO0lBQ1IscUNBQU8sQ0FBQTtJQUNQLHVDQUFRLENBQUE7SUFDUix5Q0FBUyxDQUFBO0FBQ1gsQ0FBQyxFQVBXLFFBQVEsS0FBUixRQUFRLFFBT25CO0FBRUQsc0NBQXNDO0FBQ3RDLE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7QUFFL0Msc0RBQXNEO0FBQ3RELE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO0FBQzdCLE1BQU0sQ0FBQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO0FBQ2pDLE1BQU0sQ0FBQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO0FBQ2pDLE1BQU0sQ0FBQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQ25DLE1BQU0sQ0FBQyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQy9CLE1BQU0sQ0FBQyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQy9CLE1BQU0sQ0FBQyxNQUFNLFNBQVMsR0FBRyxL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b250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgY2hhbGssIHtDaGFsa0luc3RhbmNlfSBmcm9tICdjaGFsayc7XG5pbXBvcnQge3dyaXRlRmlsZVN5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCB7am9pbn0gZnJvbSAncGF0aCc7XG5pbXBvcnQge0FyZ3VtZW50c30gZnJvbSAneWFyZ3MnO1xuaW1wb3J0IHtkZXRlcm1pbmVSZXBvQmFzZURpckZyb21Dd2R9IGZyb20gJy4vcmVwby1kaXJlY3RvcnkuanMnO1xuXG4vKipcbiAqIFN1cHBvcnRlZCBsZXZlbHMgZm9yIGxvZ2dpbmcgZnVuY3Rpb25zLiBMZXZlbHMgYXJlIG1hcHBlZCB0b1xuICogbnVtYmVycyB0byByZXByZXNlbnQgYSBoaWVyYXJjaHkgb2YgbG9nZ2luZyBsZXZlbHMuXG4gKi9cbmV4cG9ydCBlbnVtIExvZ0xldmVsIHtcbiAgU0lMRU5UID0gMCxcbiAgRVJST1IgPSAxLFxuICBXQVJOID0gMixcbiAgTE9HID0gMyxcbiAgSU5GTyA9IDQsXG4gIERFQlVHID0gNSxcbn1cblxuLyoqIERlZmF1bHQgbG9nIGxldmVsIGZvciB0aGUgdG9vbC4gKi9cbmV4cG9ydCBjb25zdCBERUZBVUxUX0xPR19MRVZFTCA9IExvZ0xldmVsLklORk87XG5cbi8qKiBSZWV4cG9ydCBvZiBjaGFsayBjb2xvcnMgZm9yIGNvbnZlbmllbnQgYWNjZXNzLiAqL1xuZXhwb3J0IGNvbnN0IHJlZCA9IGNoYWxrLnJlZDtcbmV4cG9ydCBjb25zdCByZXNldCA9IGNoYWxrLnJlc2V0O1xuZXhwb3J0IGNvbnN0IGdyZWVuID0gY2hhbGsuZ3JlZW47XG5leHBvcnQgY29uc3QgeWVsbG93ID0gY2hhbGsueWVsbG93O1xuZXhwb3J0IGNvbnN0IGJvbGQgPSBjaGFsay5ib2xkO1xuZXhwb3J0IGNvbnN0IGJsdWUgPSBjaGFsay5ibHVlO1xuZXhwb3J0IGNvbnN0IHVuZGVybGluZSA9IGNoYWxrLnVuZGVybGluZTtcblxuLyoqIENsYXNzIHVzZWQgZm9yIGxvZ2dpbmcgdG8gdGhlIGNvbnNvbGUgYW5kIHRvIGEgbmctZGV2IGxvZyBmaWxlLiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIExvZyB7XG4gIC8qKiBXcml0ZSB0byB0aGUgY29uc29sZSBmb3IgYXQgSU5GTyBsb2dnaW5nIGxldmVsICovXG4gIHN0YXRpYyBpbmZvID0gYnVpbGRMb2dMZXZlbEZ1bmN0aW9uKCgpID0+IGNvbnNvbGUuaW5mbywgTG9nTGV2ZWwuSU5GTywgbnVsbCk7XG5cbiAgLyoqIFdyaXRlIHRvIHRoZSBjb25zb2xlIGZvciBhdCBFUlJPUiBsb2dnaW5nIGxldmVsICovXG4gIHN0YXRpYyBlcnJvciA9IGJ1aWxkTG9nTGV2ZWxGdW5jdGlvbigoKSA9PiBjb25zb2xlLmVycm9yLCBMb2dMZXZlbC5FUlJPUiwgY2hhbGsucmVkKTtcblxuICAvKiogV3JpdGUgdG8gdGhlIGNvbnNvbGUgZm9yIGF0IERFQlVHIGxvZ2dpbmcgbGV2ZWwgKi9cbiAgc3RhdGljIGRlYnVnID0gYnVpbGRMb2dMZXZlbEZ1bmN0aW9uKCgpID0+IGNvbnNvbGUuZGVidWcsIExvZ0xldmVsLkRFQlVHLCBudWxsKTtcblxuICAvKiogV3JpdGUgdG8gdGhlIGNvbnNvbGUgZm9yIGF0IExPRyBsb2dnaW5nIGxldmVsICovXG4gIHN0YXRpYyBsb2cgPSBidWlsZExvZ0xldmVsRnVuY3Rpb24oKCkgPT4gY29uc29sZS5sb2csIExvZ0xldmVsLkxPRywgbnVsbCk7XG5cbiAgLyoqIFdyaXRlIHRvIHRoZSBjb25zb2xlIGZvciBhdCBXQVJOIGxvZ2dpbmcgbGV2ZWwgKi9cbiAgc3RhdGljIHdhcm4gPSBidWlsZExvZ0xldmVsRnVuY3Rpb24oKCkgPT4gY29uc29sZS53YXJuLCBMb2dMZXZlbC5XQVJOLCBjaGFsay55ZWxsb3cpO1xufVxuXG4vKiogQnVpbGQgYW4gaW5zdGFuY2Ugb2YgYSBsb2dnaW5nIGZ1bmN0aW9uIGZvciB0aGUgcHJvdmlkZWQgbGV2ZWwuICovXG5mdW5jdGlvbiBidWlsZExvZ0xldmVsRnVuY3Rpb24oXG4gIGxvYWRDb21tYW5kOiAoKSA9PiBGdW5jdGlvbixcbiAgbGV2ZWw6IExvZ0xldmVsLFxuICBkZWZhdWx0Q29sb3I6IENoYWxrSW5zdGFuY2UgfCBudWxsLFxuKSB7XG4gIC8qKiBXcml0ZSB0byBzdGRvdXQgZm9yIHRoZSBMT0dfTEVWRUwuICovXG4gIGNvbnN0IGxvZ2dpbmdGdW5jdGlvbiA9ICguLi52YWx1ZXM6IHVua25vd25bXSkgPT4ge1xuICAgIHJ1bkNvbnNvbGVDb21tYW5kKFxuICAgICAgbG9hZENvbW1hbmQsXG4gICAgICBsZXZlbCxcbiAgICAgIC8vIEZvciBzdHJpbmcgdmFsdWVzLCBhcHBseSB0aGUgZGVmYXVsdCBjb2xvci5cbiAgICAgIC4uLnZhbHVlcy5tYXAoKHYpID0+ICh0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgZGVmYXVsdENvbG9yID8gZGVmYXVsdENvbG9yKHYpIDogdikpLFxuICAgICk7XG4gIH07XG5cbiAgLyoqIFN0YXJ0IGEgZ3JvdXAgYXQgdGhlIExPR19MRVZFTCwgb3B0aW9uYWxseSBzdGFydGluZyBpdCBhcyBjb2xsYXBzZWQuICovXG4gIGxvZ2dpbmdGdW5jdGlvbi5ncm91cCA9IChsYWJlbDogc3RyaW5nLCBjb2xsYXBzZWQgPSBmYWxzZSkgPT4ge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBjb2xsYXBzZWQgPyBjb25zb2xlLmdyb3VwQ29sbGFwc2VkIDogY29uc29sZS5ncm91cDtcbiAgICBydW5Db25zb2xlQ29tbWFuZCgoKSA9PiBjb21tYW5kLCBsZXZlbCwgZGVmYXVsdENvbG9yID8gZGVmYXVsdENvbG9yKGxhYmVsKSA6IGxhYmVsKTtcbiAgfTtcblxuICAvKiogRW5kIHRoZSBncm91cCBhdCB0aGUgTE9HX0xFVkVMLiAqL1xuICBsb2dnaW5nRnVuY3Rpb24uZ3JvdXBFbmQgPSAoKSA9PiB7XG4gICAgcnVuQ29uc29sZUNvbW1hbmQoKCkgPT4gY29uc29sZS5ncm91cEVuZCwgbGV2ZWwpO1xuICB9O1xuXG4gIHJldHVybiBsb2dnaW5nRnVuY3Rpb247XG59XG5cbi8qKlxuICogUnVuIHRoZSBjb25zb2xlIGNvbW1hbmQgcHJvdmlkZWQsIGlmIHRoZSBlbnZpcm9ubWVudHMgbG9nZ2luZyBsZXZlbCBncmVhdGVyIHRoYW4gdGhlXG4gKiBwcm92aWRlZCBsb2dnaW5nIGxldmVsLlxuICpcbiAqIFRoZSBsb2FkQ29tbWFuZCB0YWtlcyBpbiBhIGZ1bmN0aW9uIHdoaWNoIGlzIGNhbGxlZCB0byByZXRyaWV2ZSB0aGUgY29uc29sZS4qIGZ1bmN0aW9uXG4gKiB0byBhbGxvdyBmb3IgamFzbWluZSBzcGllcyB0byBzdGlsbCB3b3JrIGluIHRlc3RpbmcuICBXaXRob3V0IHRoaXMgbWV0aG9kIG9mIHJldHJpZXZhbFxuICogdGhlIGNvbnNvbGUuKiBmdW5jdGlvbiwgdGhlIGZ1bmN0aW9uIGlzIHNhdmVkIGludG8gdGhlIGNsb3N1cmUgb2YgdGhlIGNyZWF0ZWQgbG9nZ2luZ1xuICogZnVuY3Rpb24gYmVmb3JlIGphc21pbmUgY2FuIHNweS5cbiAqL1xuZnVuY3Rpb24gcnVuQ29uc29sZUNvbW1hbmQobG9hZENvbW1hbmQ6ICgpID0+IEZ1bmN0aW9uLCBsb2dMZXZlbDogTG9nTGV2ZWwsIC4uLnRleHQ6IHVua25vd25bXSkge1xuICBpZiAoZ2V0TG9nTGV2ZWwoKSA+PSBsb2dMZXZlbCkge1xuICAgIGxvYWRDb21tYW5kKCkoLi4udGV4dCk7XG4gIH1cbiAgcHJpbnRUb0xvZ0ZpbGUobG9nTGV2ZWwsIC4uLnRleHQpO1xufVxuXG4vKipcbiAqIFJldHJpZXZlIHRoZSBsb2cgbGV2ZWwgZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXMsIGlmIHRoZSB2YWx1ZSBmb3VuZFxuICogYmFzZWQgb24gdGhlIExPR19MRVZFTCBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyB1bmRlZmluZWQsIHJldHVybiB0aGUgZGVmYXVsdFxuICogbG9nZ2luZyBsZXZlbC5cbiAqL1xuZnVuY3Rpb24gZ2V0TG9nTGV2ZWwoKTogTG9nTGV2ZWwge1xuICBjb25zdCBsb2dMZXZlbCA9IE9iamVjdC5rZXlzKExvZ0xldmVsKS5pbmRleE9mKChwcm9jZXNzLmVudltgTE9HX0xFVkVMYF0gfHwgJycpLnRvVXBwZXJDYXNlKCkpO1xuICBpZiAobG9nTGV2ZWwgPT09IC0xKSB7XG4gICAgcmV0dXJuIERFRkFVTFRfTE9HX0xFVkVMO1xuICB9XG4gIHJldHVybiBsb2dMZXZlbDtcbn1cblxuLyoqIEFsbCB0ZXh0IHRvIHdyaXRlIHRvIHRoZSBsb2cgZmlsZS4gKi9cbmxldCBMT0dHRURfVEVYVCA9ICcnO1xuLyoqIFdoZXRoZXIgZmlsZSBsb2dnaW5nIGFzIGJlZW4gZW5hYmxlZC4gKi9cbmxldCBGSUxFX0xPR0dJTkdfRU5BQkxFRCA9IGZhbHNlO1xuLyoqXG4gKiBUaGUgbnVtYmVyIG9mIGNvbHVtbnMgdXNlZCBpbiB0aGUgcHJlcGVuZGVkIGxvZyBsZXZlbCBpbmZvcm1hdGlvbiBvbiBlYWNoIGxpbmUgb2YgdGhlIGxvZ2dpbmdcbiAqIG91dHB1dCBmaWxlLlxuICovXG5jb25zdCBMT0dfTEVWRUxfQ09MVU1OUyA9IDc7XG5cbi8qKlxuICogRW5hYmxlIHdyaXRpbmcgdGhlIGxvZ2dlZCBvdXRwdXRzIHRvIHRoZSBsb2cgZmlsZSBvbiBwcm9jZXNzIGV4aXQsIHNldHMgaW5pdGlhbCBsaW5lcyBmcm9tIHRoZVxuICogY29tbWFuZCBleGVjdXRpb24sIGNvbnRhaW5pbmcgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHRpbWluZyBhbmQgY29tbWFuZCBwYXJhbWV0ZXJzLlxuICpcbiAqIFRoaXMgaXMgZXhwZWN0ZWQgdG8gYmUgY2FsbGVkIG9ubHkgb25jZSBkdXJpbmcgYSBjb21tYW5kIHJ1biwgYW5kIHNob3VsZCBiZSBjYWxsZWQgYnkgdGhlXG4gKiBtaWRkbGV3YXJlIG9mIHlhcmdzIHRvIGVuYWJsZSB0aGUgZmlsZSBsb2dnaW5nIGJlZm9yZSB0aGUgcmVzdCBvZiB0aGUgY29tbWFuZCBwYXJzaW5nIGFuZFxuICogcmVzcG9uc2UgaXMgZXhlY3V0ZWQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYXB0dXJlTG9nT3V0cHV0Rm9yQ29tbWFuZChhcmd2OiBBcmd1bWVudHMpIHtcbiAgLy8gVE9ETyhqb3NlcGhwZXJyb3R0KTogcmVtb3ZlIHRoaXMgZ3VhcmQgYWdhaW5zdCBydW5uaW5nIG11bHRpcGxlIHRpbWVzIGFmdGVyXG4gIC8vICAgaHR0cHM6Ly9naXRodWIuY29tL3lhcmdzL3lhcmdzL2lzc3Vlcy8yMjIzIGlzIGZpeGVkXG4gIGlmIChGSUxFX0xPR0dJTkdfRU5BQkxFRCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHJlcG9EaXIgPSBkZXRlcm1pbmVSZXBvQmFzZURpckZyb21Dd2QoKTtcbiAgLyoqIFRoZSBkYXRlIHRpbWUgdXNlZCBmb3IgdGltZXN0YW1waW5nIHdoZW4gdGhlIGNvbW1hbmQgd2FzIGludm9rZWQuICovXG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gIC8qKiBIZWFkZXIgbGluZSB0byBzZXBhcmF0ZSBjb21tYW5kIHJ1bnMgaW4gbG9nIGZpbGVzLiAqL1xuICBjb25zdCBoZWFkZXJMaW5lID0gQXJyYXkoMTAwKS5maWxsKCcjJykuam9pbignJyk7XG4gIExPR0dFRF9URVhUICs9IGAke2hlYWRlckxpbmV9XFxuQ29tbWFuZDogJHthcmd2LiQwfSAke2FyZ3YuXy5qb2luKCcgJyl9XFxuUmFuIGF0OiAke25vd31cXG5gO1xuXG4gIC8vIE9uIHByb2Nlc3MgZXhpdCwgd3JpdGUgdGhlIGxvZ2dlZCBvdXRwdXQgdG8gdGhlIGFwcHJvcHJpYXRlIGxvZyBmaWxlc1xuICBwcm9jZXNzLm9uKCdleGl0JywgKGNvZGU6IG51bWJlcikgPT4ge1xuICAgIExPR0dFRF9URVhUICs9IGAke2hlYWRlckxpbmV9XFxuYDtcbiAgICBMT0dHRURfVEVYVCArPSBgQ29tbWFuZCByYW4gaW4gJHtuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIG5vdy5nZXRUaW1lKCl9bXNcXG5gO1xuICAgIExPR0dFRF9URVhUICs9IGBFeGl0IENvZGU6ICR7Y29kZX1cXG5gO1xuICAgIC8qKiBQYXRoIHRvIHRoZSBsb2cgZmlsZSBsb2NhdGlvbi4gKi9cbiAgICBjb25zdCBsb2dGaWxlUGF0aCA9IGpvaW4ocmVwb0RpciwgJy5uZy1kZXYubG9nJyk7XG5cbiAgICAvLyBTdHJpcCBBTlNJIGVzY2FwZSBjb2RlcyBmcm9tIGxvZyBvdXRwdXRzLlxuICAgIExPR0dFRF9URVhUID0gTE9HR0VEX1RFWFQucmVwbGFjZSgvXFx4MUJcXFsoWzAtOV17MSwzfSg7WzAtOV17MSwyfSk/KT9bbUdLXS9nLCAnJyk7XG5cbiAgICB3cml0ZUZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCBMT0dHRURfVEVYVCk7XG5cbiAgICAvLyBGb3IgZmFpbHVyZSBjb2RlcyBncmVhdGVyIHRoYW4gMSwgdGhlIG5ldyBsb2dnZWQgbGluZXMgc2hvdWxkIGJlIHdyaXR0ZW4gdG8gYSBzcGVjaWZpYyBsb2dcbiAgICAvLyBmaWxlIGZvciB0aGUgY29tbWFuZCBydW4gZmFpbHVyZS5cbiAgICBpZiAoY29kZSA+IDEpIHtcbiAgICAgIGNvbnN0IGxvZ0ZpbGVOYW1lID0gYC5uZy1kZXYuZXJyLSR7bm93LmdldFRpbWUoKX0ubG9nYDtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEV4aXQgY29kZTogJHtjb2RlfS4gV3JpdGluZyBmdWxsIGxvZyB0byAke2xvZ0ZpbGVOYW1lfWApO1xuICAgICAgd3JpdGVGaWxlU3luYyhqb2luKHJlcG9EaXIsIGxvZ0ZpbGVOYW1lKSwgTE9HR0VEX1RFWFQpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gTWFyayBmaWxlIGxvZ2dpbmcgYXMgZW5hYmxlZCB0byBwcmV2ZW50IHRoZSBmdW5jdGlvbiBmcm9tIGV4ZWN1dGluZyBtdWx0aXBsZSB0aW1lcy5cbiAgRklMRV9MT0dHSU5HX0VOQUJMRUQgPSB0cnVlO1xufVxuXG4vKiogV3JpdGUgdGhlIHByb3ZpZGVkIHRleHQgdG8gdGhlIGxvZyBmaWxlLCBwcmVwZW5kaW5nIGVhY2ggbGluZSB3aXRoIHRoZSBsb2cgbGV2ZWwuICAqL1xuZnVuY3Rpb24gcHJpbnRUb0xvZ0ZpbGUobG9nTGV2ZWw6IExvZ0xldmVsLCAuLi50ZXh0OiB1bmtub3duW10pIHtcbiAgY29uc3QgbG9nTGV2ZWxUZXh0ID0gYCR7TG9nTGV2ZWxbbG9nTGV2ZWxdfTpgLnBhZEVuZChMT0dfTEVWRUxfQ09MVU1OUyk7XG4gIExPR0dFRF9URVhUICs9IHRleHRcbiAgICAuam9pbignICcpXG4gICAgLnNwbGl0KCdcXG4nKVxuICAgIC5tYXAoKGwpID0+IGAke2xvZ0xldmVsVGV4dH0gJHtsfVxcbmApXG4gICAgLmpvaW4oJycpO1xufVxuIl19