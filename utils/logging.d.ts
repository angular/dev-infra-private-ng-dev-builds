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
export declare const red: (text: string, options?: import("util").StyleTextOptions | undefined) => string;
export declare const green: (text: string, options?: import("util").StyleTextOptions | undefined) => string;
export declare const yellow: (text: string, options?: import("util").StyleTextOptions | undefined) => string;
export declare const bold: (text: string, options?: import("util").StyleTextOptions | undefined) => string;
export declare const blue: (text: string, options?: import("util").StyleTextOptions | undefined) => string;
export declare const underline: (text: string, options?: import("util").StyleTextOptions | undefined) => string;
export declare abstract class Log {
    static info: (...values: unknown[]) => void;
    static error: (...values: unknown[]) => void;
    static debug: (...values: unknown[]) => void;
    static log: (...values: unknown[]) => void;
    static warn: (...values: unknown[]) => void;
}
export declare function captureLogOutputForCommand(argv: Arguments): Promise<void>;
