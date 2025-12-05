import { Formatter } from './base-formatter.js';
export declare class Prettier extends Formatter {
    readonly name = "prettier";
    binaryFilePath: string;
    matchers: string[];
    private configPath;
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
