/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import chalk from 'chalk';
import { copyFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
import { appendFile } from 'fs/promises';
import { stripVTControlCharacters } from 'util';
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
    appendToLogFile(logLevel, ...text);
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
/**
 * The number of columns used in the prepended log level information on each line of the logging
 * output file.
 */
const LOG_LEVEL_COLUMNS = 7;
/**
 * The path to the log file being written to live. Starts as undefined before being trigger for usage by
 * `captureLogOutputForCommand` which runs from yargs execution.
 */
let logFilePath = undefined;
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
    if (logFilePath !== undefined) {
        return;
    }
    const repoDir = determineRepoBaseDirFromCwd();
    logFilePath = join(repoDir, '.ng-dev.log');
    writeFileSync(logFilePath, '');
    /** The date time used for timestamping when the command was invoked. */
    const now = new Date();
    /** Header line to separate command runs in log files. */
    const headerLine = Array(100).fill('#').join('');
    appendToLogFile(undefined, `${headerLine}\nCommand: ${argv.$0} ${argv._.join(' ')}\nRan at: ${now}\n`);
    // On process exit, write the logged output to the appropriate log files
    process.on('exit', (code) => {
        appendToLogFile(undefined, `\n\nCommand ran in ${new Date().getTime() - now.getTime()}ms\nExit Code: ${code}\n`);
        // For failure codes greater than 1, the new logged lines should be written to a specific log
        // file for the command run failure.
        if (code > 1 && logFilePath) {
            const errorLogFileName = `.ng-dev.err-${now.getTime()}.log`;
            console.error(`Exit code: ${code}. Writing full log to ${errorLogFileName}`);
            copyFileSync(logFilePath, join(repoDir, errorLogFileName));
        }
    });
}
/** Write the provided text to the log file, prepending each line with the log level.  */
function appendToLogFile(logLevel, ...text) {
    if (logFilePath === undefined) {
        return;
    }
    if (logLevel === undefined) {
        appendFile(logFilePath, text.join(' '));
        return;
    }
    const logLevelText = `${LogLevel[logLevel]}:`.padEnd(LOG_LEVEL_COLUMNS);
    appendFile(logFilePath, 
    // Strip ANSI escape codes from log outputs.
    stripVTControlCharacters(text
        .join(' ')
        .split('\n')
        .map((l) => `${logLevelText} ${l}\n`)
        .join('')));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9sb2dnaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBc0IsTUFBTSxPQUFPLENBQUM7QUFDM0MsT0FBTyxFQUFDLFlBQVksRUFBRSxhQUFhLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDL0MsT0FBTyxFQUFDLElBQUksRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUUxQixPQUFPLEVBQUMsMkJBQTJCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUNoRSxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ3ZDLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUU5Qzs7O0dBR0c7QUFDSCxNQUFNLENBQU4sSUFBWSxRQU9YO0FBUEQsV0FBWSxRQUFRO0lBQ2xCLDJDQUFVLENBQUE7SUFDVix5Q0FBUyxDQUFBO0lBQ1QsdUNBQVEsQ0FBQTtJQUNSLHFDQUFPLENBQUE7SUFDUCx1Q0FBUSxDQUFBO0lBQ1IseUNBQVMsQ0FBQTtBQUNYLENBQUMsRUFQVyxRQUFRLEtBQVIsUUFBUSxRQU9uQjtBQUVELHNDQUFzQztBQUN0QyxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0FBRS9DLHNEQUFzRDtBQUN0RCxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztBQUM3QixNQUFNLENBQUMsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztBQUNqQyxNQUFNLENBQUMsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztBQUNqQyxNQUFNLENBQUMsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUNuQyxNQUFNLENBQUMsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFD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U0FDWCxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsWUFBWSxJQUFJLENBQUMsSUFBSSxDQUFDO1NBQ3BDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FDWixDQUNGLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBjaGFsaywge0NoYWxrSW5zdGFuY2V9IGZyb20gJ2NoYWxrJztcbmltcG9ydCB7Y29weUZpbGVTeW5jLCB3cml0ZUZpbGVTeW5jfSBmcm9tICdmcyc7XG5pbXBvcnQge2pvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtBcmd1bWVudHN9IGZyb20gJ3lhcmdzJztcbmltcG9ydCB7ZGV0ZXJtaW5lUmVwb0Jhc2VEaXJGcm9tQ3dkfSBmcm9tICcuL3JlcG8tZGlyZWN0b3J5LmpzJztcbmltcG9ydCB7YXBwZW5kRmlsZX0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHtzdHJpcFZUQ29udHJvbENoYXJhY3RlcnN9IGZyb20gJ3V0aWwnO1xuXG4vKipcbiAqIFN1cHBvcnRlZCBsZXZlbHMgZm9yIGxvZ2dpbmcgZnVuY3Rpb25zLiBMZXZlbHMgYXJlIG1hcHBlZCB0b1xuICogbnVtYmVycyB0byByZXByZXNlbnQgYSBoaWVyYXJjaHkgb2YgbG9nZ2luZyBsZXZlbHMuXG4gKi9cbmV4cG9ydCBlbnVtIExvZ0xldmVsIHtcbiAgU0lMRU5UID0gMCxcbiAgRVJST1IgPSAxLFxuICBXQVJOID0gMixcbiAgTE9HID0gMyxcbiAgSU5GTyA9IDQsXG4gIERFQlVHID0gNSxcbn1cblxuLyoqIERlZmF1bHQgbG9nIGxldmVsIGZvciB0aGUgdG9vbC4gKi9cbmV4cG9ydCBjb25zdCBERUZBVUxUX0xPR19MRVZFTCA9IExvZ0xldmVsLklORk87XG5cbi8qKiBSZWV4cG9ydCBvZiBjaGFsayBjb2xvcnMgZm9yIGNvbnZlbmllbnQgYWNjZXNzLiAqL1xuZXhwb3J0IGNvbnN0IHJlZCA9IGNoYWxrLnJlZDtcbmV4cG9ydCBjb25zdCByZXNldCA9IGNoYWxrLnJlc2V0O1xuZXhwb3J0IGNvbnN0IGdyZWVuID0gY2hhbGsuZ3JlZW47XG5leHBvcnQgY29uc3QgeWVsbG93ID0gY2hhbGsueWVsbG93O1xuZXhwb3J0IGNvbnN0IGJvbGQgPSBjaGFsay5ib2xkO1xuZXhwb3J0IGNvbnN0IGJsdWUgPSBjaGFsay5ibHVlO1xuZXhwb3J0IGNvbnN0IHVuZGVybGluZSA9IGNoYWxrLnVuZGVybGluZTtcblxuLyoqIENsYXNzIHVzZWQgZm9yIGxvZ2dpbmcgdG8gdGhlIGNvbnNvbGUgYW5kIHRvIGEgbmctZGV2IGxvZyBmaWxlLiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIExvZyB7XG4gIC8qKiBXcml0ZSB0byB0aGUgY29uc29sZSBmb3IgYXQgSU5GTyBsb2dnaW5nIGxldmVsICovXG4gIHN0YXRpYyBpbmZvID0gYnVpbGRMb2dMZXZlbEZ1bmN0aW9uKCgpID0+IGNvbnNvbGUuaW5mbywgTG9nTGV2ZWwuSU5GTywgbnVsbCk7XG5cbiAgLyoqIFdyaXRlIHRvIHRoZSBjb25zb2xlIGZvciBhdCBFUlJPUiBsb2dnaW5nIGxldmVsICovXG4gIHN0YXRpYyBlcnJvciA9IGJ1aWxkTG9nTGV2ZWxGdW5jdGlvbigoKSA9PiBjb25zb2xlLmVycm9yLCBMb2dMZXZlbC5FUlJPUiwgY2hhbGsucmVkKTtcblxuICAvKiogV3JpdGUgdG8gdGhlIGNvbnNvbGUgZm9yIGF0IERFQlVHIGxvZ2dpbmcgbGV2ZWwgKi9cbiAgc3RhdGljIGRlYnVnID0gYnVpbGRMb2dMZXZlbEZ1bmN0aW9uKCgpID0+IGNvbnNvbGUuZGVidWcsIExvZ0xldmVsLkRFQlVHLCBudWxsKTtcblxuICAvKiogV3JpdGUgdG8gdGhlIGNvbnNvbGUgZm9yIGF0IExPRyBsb2dnaW5nIGxldmVsICovXG4gIHN0YXRpYyBsb2cgPSBidWlsZExvZ0xldmVsRnVuY3Rpb24oKCkgPT4gY29uc29sZS5sb2csIExvZ0xldmVsLkxPRywgbnVsbCk7XG5cbiAgLyoqIFdyaXRlIHRvIHRoZSBjb25zb2xlIGZvciBhdCBXQVJOIGxvZ2dpbmcgbGV2ZWwgKi9cbiAgc3RhdGljIHdhcm4gPSBidWlsZExvZ0xldmVsRnVuY3Rpb24oKCkgPT4gY29uc29sZS53YXJuLCBMb2dMZXZlbC5XQVJOLCBjaGFsay55ZWxsb3cpO1xufVxuXG4vKiogQnVpbGQgYW4gaW5zdGFuY2Ugb2YgYSBsb2dnaW5nIGZ1bmN0aW9uIGZvciB0aGUgcHJvdmlkZWQgbGV2ZWwuICovXG5mdW5jdGlvbiBidWlsZExvZ0xldmVsRnVuY3Rpb24oXG4gIGxvYWRDb21tYW5kOiAoKSA9PiBGdW5jdGlvbixcbiAgbGV2ZWw6IExvZ0xldmVsLFxuICBkZWZhdWx0Q29sb3I6IENoYWxrSW5zdGFuY2UgfCBudWxsLFxuKSB7XG4gIC8qKiBXcml0ZSB0byBzdGRvdXQgZm9yIHRoZSBMT0dfTEVWRUwuICovXG4gIGNvbnN0IGxvZ2dpbmdGdW5jdGlvbiA9ICguLi52YWx1ZXM6IHVua25vd25bXSkgPT4ge1xuICAgIHJ1bkNvbnNvbGVDb21tYW5kKFxuICAgICAgbG9hZENvbW1hbmQsXG4gICAgICBsZXZlbCxcbiAgICAgIC8vIEZvciBzdHJpbmcgdmFsdWVzLCBhcHBseSB0aGUgZGVmYXVsdCBjb2xvci5cbiAgICAgIC4uLnZhbHVlcy5tYXAoKHYpID0+ICh0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgZGVmYXVsdENvbG9yID8gZGVmYXVsdENvbG9yKHYpIDogdikpLFxuICAgICk7XG4gIH07XG5cbiAgLyoqIFN0YXJ0IGEgZ3JvdXAgYXQgdGhlIExPR19MRVZFTCwgb3B0aW9uYWxseSBzdGFydGluZyBpdCBhcyBjb2xsYXBzZWQuICovXG4gIGxvZ2dpbmdGdW5jdGlvbi5ncm91cCA9IChsYWJlbDogc3RyaW5nLCBjb2xsYXBzZWQgPSBmYWxzZSkgPT4ge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBjb2xsYXBzZWQgPyBjb25zb2xlLmdyb3VwQ29sbGFwc2VkIDogY29uc29sZS5ncm91cDtcbiAgICBydW5Db25zb2xlQ29tbWFuZCgoKSA9PiBjb21tYW5kLCBsZXZlbCwgZGVmYXVsdENvbG9yID8gZGVmYXVsdENvbG9yKGxhYmVsKSA6IGxhYmVsKTtcbiAgfTtcblxuICAvKiogRW5kIHRoZSBncm91cCBhdCB0aGUgTE9HX0xFVkVMLiAqL1xuICBsb2dnaW5nRnVuY3Rpb24uZ3JvdXBFbmQgPSAoKSA9PiB7XG4gICAgcnVuQ29uc29sZUNvbW1hbmQoKCkgPT4gY29uc29sZS5ncm91cEVuZCwgbGV2ZWwpO1xuICB9O1xuXG4gIHJldHVybiBsb2dnaW5nRnVuY3Rpb247XG59XG5cbi8qKlxuICogUnVuIHRoZSBjb25zb2xlIGNvbW1hbmQgcHJvdmlkZWQsIGlmIHRoZSBlbnZpcm9ubWVudHMgbG9nZ2luZyBsZXZlbCBncmVhdGVyIHRoYW4gdGhlXG4gKiBwcm92aWRlZCBsb2dnaW5nIGxldmVsLlxuICpcbiAqIFRoZSBsb2FkQ29tbWFuZCB0YWtlcyBpbiBhIGZ1bmN0aW9uIHdoaWNoIGlzIGNhbGxlZCB0byByZXRyaWV2ZSB0aGUgY29uc29sZS4qIGZ1bmN0aW9uXG4gKiB0byBhbGxvdyBmb3IgamFzbWluZSBzcGllcyB0byBzdGlsbCB3b3JrIGluIHRlc3RpbmcuICBXaXRob3V0IHRoaXMgbWV0aG9kIG9mIHJldHJpZXZhbFxuICogdGhlIGNvbnNvbGUuKiBmdW5jdGlvbiwgdGhlIGZ1bmN0aW9uIGlzIHNhdmVkIGludG8gdGhlIGNsb3N1cmUgb2YgdGhlIGNyZWF0ZWQgbG9nZ2luZ1xuICogZnVuY3Rpb24gYmVmb3JlIGphc21pbmUgY2FuIHNweS5cbiAqL1xuZnVuY3Rpb24gcnVuQ29uc29sZUNvbW1hbmQobG9hZENvbW1hbmQ6ICgpID0+IEZ1bmN0aW9uLCBsb2dMZXZlbDogTG9nTGV2ZWwsIC4uLnRleHQ6IHVua25vd25bXSkge1xuICBpZiAoZ2V0TG9nTGV2ZWwoKSA+PSBsb2dMZXZlbCkge1xuICAgIGxvYWRDb21tYW5kKCkoLi4udGV4dCk7XG4gIH1cbiAgYXBwZW5kVG9Mb2dGaWxlKGxvZ0xldmVsLCAuLi50ZXh0KTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZSB0aGUgbG9nIGxldmVsIGZyb20gZW52aXJvbm1lbnQgdmFyaWFibGVzLCBpZiB0aGUgdmFsdWUgZm91bmRcbiAqIGJhc2VkIG9uIHRoZSBMT0dfTEVWRUwgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgdW5kZWZpbmVkLCByZXR1cm4gdGhlIGRlZmF1bHRcbiAqIGxvZ2dpbmcgbGV2ZWwuXG4gKi9cbmZ1bmN0aW9uIGdldExvZ0xldmVsKCk6IExvZ0xldmVsIHtcbiAgY29uc3QgbG9nTGV2ZWwgPSBPYmplY3Qua2V5cyhMb2dMZXZlbCkuaW5kZXhPZigocHJvY2Vzcy5lbnZbYExPR19MRVZFTGBdIHx8ICcnKS50b1VwcGVyQ2FzZSgpKTtcbiAgaWYgKGxvZ0xldmVsID09PSAtMSkge1xuICAgIHJldHVybiBERUZBVUxUX0xPR19MRVZFTDtcbiAgfVxuICByZXR1cm4gbG9nTGV2ZWw7XG59XG5cbi8qKlxuICogVGhlIG51bWJlciBvZiBjb2x1bW5zIHVzZWQgaW4gdGhlIHByZXBlbmRlZCBsb2cgbGV2ZWwgaW5mb3JtYXRpb24gb24gZWFjaCBsaW5lIG9mIHRoZSBsb2dnaW5nXG4gKiBvdXRwdXQgZmlsZS5cbiAqL1xuY29uc3QgTE9HX0xFVkVMX0NPTFVNTlMgPSA3O1xuLyoqXG4gKiBUaGUgcGF0aCB0byB0aGUgbG9nIGZpbGUgYmVpbmcgd3JpdHRlbiB0byBsaXZlLiBTdGFydHMgYXMgdW5kZWZpbmVkIGJlZm9yZSBiZWluZyB0cmlnZ2VyIGZvciB1c2FnZSBieVxuICogYGNhcHR1cmVMb2dPdXRwdXRGb3JDb21tYW5kYCB3aGljaCBydW5zIGZyb20geWFyZ3MgZXhlY3V0aW9uLlxuICovXG5sZXQgbG9nRmlsZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBFbmFibGUgd3JpdGluZyB0aGUgbG9nZ2VkIG91dHB1dHMgdG8gdGhlIGxvZyBmaWxlIG9uIHByb2Nlc3MgZXhpdCwgc2V0cyBpbml0aWFsIGxpbmVzIGZyb20gdGhlXG4gKiBjb21tYW5kIGV4ZWN1dGlvbiwgY29udGFpbmluZyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgdGltaW5nIGFuZCBjb21tYW5kIHBhcmFtZXRlcnMuXG4gKlxuICogVGhpcyBpcyBleHBlY3RlZCB0byBiZSBjYWxsZWQgb25seSBvbmNlIGR1cmluZyBhIGNvbW1hbmQgcnVuLCBhbmQgc2hvdWxkIGJlIGNhbGxlZCBieSB0aGVcbiAqIG1pZGRsZXdhcmUgb2YgeWFyZ3MgdG8gZW5hYmxlIHRoZSBmaWxlIGxvZ2dpbmcgYmVmb3JlIHRoZSByZXN0IG9mIHRoZSBjb21tYW5kIHBhcnNpbmcgYW5kXG4gKiByZXNwb25zZSBpcyBleGVjdXRlZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhcHR1cmVMb2dPdXRwdXRGb3JDb21tYW5kKGFyZ3Y6IEFyZ3VtZW50cykge1xuICAvLyBUT0RPKGpvc2VwaHBlcnJvdHQpOiByZW1vdmUgdGhpcyBndWFyZCBhZ2FpbnN0IHJ1bm5pbmcgbXVsdGlwbGUgdGltZXMgYWZ0ZXJcbiAgLy8gICBodHRwczovL2dpdGh1Yi5jb20veWFyZ3MveWFyZ3MvaXNzdWVzLzIyMjMgaXMgZml4ZWRcbiAgaWYgKGxvZ0ZpbGVQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgcmVwb0RpciA9IGRldGVybWluZVJlcG9CYXNlRGlyRnJvbUN3ZCgpO1xuICBsb2dGaWxlUGF0aCA9IGpvaW4ocmVwb0RpciwgJy5uZy1kZXYubG9nJyk7XG4gIHdyaXRlRmlsZVN5bmMobG9nRmlsZVBhdGgsICcnKTtcblxuICAvKiogVGhlIGRhdGUgdGltZSB1c2VkIGZvciB0aW1lc3RhbXBpbmcgd2hlbiB0aGUgY29tbWFuZCB3YXMgaW52b2tlZC4gKi9cbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgLyoqIEhlYWRlciBsaW5lIHRvIHNlcGFyYXRlIGNvbW1hbmQgcnVucyBpbiBsb2cgZmlsZXMuICovXG4gIGNvbnN0IGhlYWRlckxpbmUgPSBBcnJheSgxMDApLmZpbGwoJyMnKS5qb2luKCcnKTtcbiAgYXBwZW5kVG9Mb2dGaWxlKFxuICAgIHVuZGVmaW5lZCxcbiAgICBgJHtoZWFkZXJMaW5lfVxcbkNvbW1hbmQ6ICR7YXJndi4kMH0gJHthcmd2Ll8uam9pbignICcpfVxcblJhbiBhdDogJHtub3d9XFxuYCxcbiAgKTtcblxuICAvLyBPbiBwcm9jZXNzIGV4aXQsIHdyaXRlIHRoZSBsb2dnZWQgb3V0cHV0IHRvIHRoZSBhcHByb3ByaWF0ZSBsb2cgZmlsZXNcbiAgcHJvY2Vzcy5vbignZXhpdCcsIChjb2RlOiBudW1iZXIpID0+IHtcbiAgICBhcHBlbmRUb0xvZ0ZpbGUoXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBgXFxuXFxuQ29tbWFuZCByYW4gaW4gJHtuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIG5vdy5nZXRUaW1lKCl9bXNcXG5FeGl0IENvZGU6ICR7Y29kZX1cXG5gLFxuICAgICk7XG5cbiAgICAvLyBGb3IgZmFpbHVyZSBjb2RlcyBncmVhdGVyIHRoYW4gMSwgdGhlIG5ldyBsb2dnZWQgbGluZXMgc2hvdWxkIGJlIHdyaXR0ZW4gdG8gYSBzcGVjaWZpYyBsb2dcbiAgICAvLyBmaWxlIGZvciB0aGUgY29tbWFuZCBydW4gZmFpbHVyZS5cbiAgICBpZiAoY29kZSA+IDEgJiYgbG9nRmlsZVBhdGgpIHtcbiAgICAgIGNvbnN0IGVycm9yTG9nRmlsZU5hbWUgPSBgLm5nLWRldi5lcnItJHtub3cuZ2V0VGltZSgpfS5sb2dgO1xuICAgICAgY29uc29sZS5lcnJvcihgRXhpdCBjb2RlOiAke2NvZGV9LiBXcml0aW5nIGZ1bGwgbG9nIHRvICR7ZXJyb3JMb2dGaWxlTmFtZX1gKTtcbiAgICAgIGNvcHlGaWxlU3luYyhsb2dGaWxlUGF0aCwgam9pbihyZXBvRGlyLCBlcnJvckxvZ0ZpbGVOYW1lKSk7XG4gICAgfVxuICB9KTtcbn1cblxuLyoqIFdyaXRlIHRoZSBwcm92aWRlZCB0ZXh0IHRvIHRoZSBsb2cgZmlsZSwgcHJlcGVuZGluZyBlYWNoIGxpbmUgd2l0aCB0aGUgbG9nIGxldmVsLiAgKi9cbmZ1bmN0aW9uIGFwcGVuZFRvTG9nRmlsZShsb2dMZXZlbDogTG9nTGV2ZWwgfCB1bmRlZmluZWQsIC4uLnRleHQ6IHVua25vd25bXSkge1xuICBpZiAobG9nRmlsZVBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAobG9nTGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgIGFwcGVuZEZpbGUobG9nRmlsZVBhdGgsIHRleHQuam9pbignICcpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBsb2dMZXZlbFRleHQgPSBgJHtMb2dMZXZlbFtsb2dMZXZlbF19OmAucGFkRW5kKExPR19MRVZFTF9DT0xVTU5TKTtcbiAgYXBwZW5kRmlsZShcbiAgICBsb2dGaWxlUGF0aCxcbiAgICAvLyBTdHJpcCBBTlNJIGVzY2FwZSBjb2RlcyBmcm9tIGxvZyBvdXRwdXRzLlxuICAgIHN0cmlwVlRDb250cm9sQ2hhcmFjdGVycyhcbiAgICAgIHRleHRcbiAgICAgICAgLmpvaW4oJyAnKVxuICAgICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAgIC5tYXAoKGwpID0+IGAke2xvZ0xldmVsVGV4dH0gJHtsfVxcbmApXG4gICAgICAgIC5qb2luKCcnKSxcbiAgICApLFxuICApO1xufVxuIl19