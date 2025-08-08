import chalk from 'chalk';
import { copyFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
import { appendFile } from 'fs/promises';
import { stripVTControlCharacters } from 'util';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["SILENT"] = 0] = "SILENT";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["LOG"] = 3] = "LOG";
    LogLevel[LogLevel["INFO"] = 4] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 5] = "DEBUG";
})(LogLevel || (LogLevel = {}));
export const DEFAULT_LOG_LEVEL = LogLevel.INFO;
export const red = chalk.red;
export const reset = chalk.reset;
export const green = chalk.green;
export const yellow = chalk.yellow;
export const bold = chalk.bold;
export const blue = chalk.blue;
export const underline = chalk.underline;
export class Log {
}
Log.info = buildLogLevelFunction(() => console.info, LogLevel.INFO, null);
Log.error = buildLogLevelFunction(() => console.error, LogLevel.ERROR, chalk.red);
Log.debug = buildLogLevelFunction(() => console.debug, LogLevel.DEBUG, null);
Log.log = buildLogLevelFunction(() => console.log, LogLevel.LOG, null);
Log.warn = buildLogLevelFunction(() => console.warn, LogLevel.WARN, chalk.yellow);
function buildLogLevelFunction(loadCommand, level, defaultColor) {
    const loggingFunction = (...values) => {
        runConsoleCommand(loadCommand, level, ...values.map((v) => (typeof v === 'string' && defaultColor ? defaultColor(v) : v)));
    };
    loggingFunction.group = (label, collapsed = false) => {
        const command = collapsed ? console.groupCollapsed : console.group;
        runConsoleCommand(() => command, level, defaultColor ? defaultColor(label) : label);
    };
    loggingFunction.groupEnd = () => {
        runConsoleCommand(() => console.groupEnd, level);
    };
    return loggingFunction;
}
function runConsoleCommand(loadCommand, logLevel, ...text) {
    if (getLogLevel() >= logLevel) {
        loadCommand()(...text);
    }
    appendToLogFile(logLevel, ...text);
}
function getLogLevel() {
    const logLevel = Object.keys(LogLevel).indexOf((process.env[`LOG_LEVEL`] || '').toUpperCase());
    if (logLevel === -1) {
        return DEFAULT_LOG_LEVEL;
    }
    return logLevel;
}
const LOG_LEVEL_COLUMNS = 7;
let logFilePath = undefined;
export async function captureLogOutputForCommand(argv) {
    if (logFilePath !== undefined) {
        return;
    }
    const repoDir = determineRepoBaseDirFromCwd();
    logFilePath = join(repoDir, '.ng-dev.log');
    writeFileSync(logFilePath, '');
    const now = new Date();
    const headerLine = Array(100).fill('#').join('');
    appendToLogFile(undefined, `${headerLine}\nCommand: ${argv.$0} ${argv._.join(' ')}\nRan at: ${now}\n`);
    process.on('exit', (code) => {
        appendToLogFile(undefined, `\n\nCommand ran in ${new Date().getTime() - now.getTime()}ms\nExit Code: ${code}\n`);
        if (code > 1 && logFilePath) {
            const errorLogFileName = `.ng-dev.err-${now.getTime()}.log`;
            console.error(`Exit code: ${code}. Writing full log to ${errorLogFileName}`);
            copyFileSync(logFilePath, join(repoDir, errorLogFileName));
        }
    });
}
function appendToLogFile(logLevel, ...text) {
    if (logFilePath === undefined) {
        return;
    }
    if (logLevel === undefined) {
        appendFile(logFilePath, text.join(' '));
        return;
    }
    const logLevelText = `${LogLevel[logLevel]}:`.padEnd(LOG_LEVEL_COLUMNS);
    appendFile(logFilePath, stripVTControlCharacters(text
        .join(' ')
        .split('\n')
        .map((l) => `${logLevelText} ${l}\n`)
        .join('')));
}
//# sourceMappingURL=logging.js.map