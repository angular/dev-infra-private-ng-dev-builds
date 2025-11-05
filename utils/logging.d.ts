import { ChalkInstance } from 'chalk';
import { Arguments } from 'yargs';
export declare enum LogLevel {
    SILENT = 0,
    ERROR = 1,
    WARN = 2,
    LOG = 3,
    INFO = 4,
    DEBUG = 5
}
export declare const DEFAULT_LOG_LEVEL = LogLevel.INFO;
export declare const red: ChalkInstance;
export declare const reset: ChalkInstance;
export declare const green: ChalkInstance;
export declare const yellow: ChalkInstance;
export declare const bold: ChalkInstance;
export declare const blue: ChalkInstance;
export declare const underline: ChalkInstance;
export declare abstract class Log {
    static info: (...values: unknown[]) => void;
    static error: (...values: unknown[]) => void;
    static debug: (...values: unknown[]) => void;
    static log: (...values: unknown[]) => void;
    static warn: (...values: unknown[]) => void;
}
export declare function captureLogOutputForCommand(argv: Arguments): Promise<void>;
