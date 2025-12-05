import { Formatter } from './base-formatter.js';
export declare class Buildifier extends Formatter {
    readonly name = "buildifier";
    binaryFilePath: string;
    matchers: string[];
    actions: {
        check: {
            commandFlags: string;
            callback: (_: string, code: number | NodeJS.Signals, stdout: string) => boolean;
        };
        format: {
            commandFlags: string;
            callback: (file: string, code: number | NodeJS.Signals, _: string, stderr: string) => boolean;
        };
    };
}
