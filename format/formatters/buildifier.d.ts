import { Formatter, FormatterAction } from './base-formatter.js';
export declare class Buildifier extends Formatter {
    readonly name = "buildifier";
    binaryFilePath: string;
    matchers: string[];
    actions: {
        check: {
            commandFlags: string[];
            callback: (_: string, code: number | NodeJS.Signals, stdout: string) => boolean;
        };
        format: {
            commandFlags: string[];
            callback: (file: string, code: number | NodeJS.Signals, _: string, stderr: string) => boolean;
        };
    };
    getFailureLine(file: string, action: FormatterAction, _code: number | NodeJS.Signals, stdout: string, stderr: string): Promise<number | undefined>;
}
