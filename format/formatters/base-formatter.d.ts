import { GitClient } from '../../utils/git/git-client.js';
import { FormatConfig } from '../config.js';
export type CallbackFunc = (file: string, code: number | NodeJS.Signals, stdout: string, stderr: string) => boolean;
export type FormatterAction = 'check' | 'format';
interface FormatterActionMetadata {
    commandFlags: string[];
    callback: CallbackFunc;
}
export declare abstract class Formatter {
    protected git: GitClient;
    protected config: FormatConfig;
    abstract name: keyof FormatConfig;
    abstract binaryFilePath: string;
    abstract actions: {
        check: FormatterActionMetadata;
        format: FormatterActionMetadata;
    };
    abstract matchers: string[];
    constructor(git: GitClient, config: FormatConfig);
    commandFor(action: FormatterAction): string[];
    callbackFor(action: FormatterAction): CallbackFunc;
    isEnabled(): boolean;
    getFileMatcher(): string[];
    getFailureLine(_file: string, _action: FormatterAction, _code: number | NodeJS.Signals, _stdout: string, _stderr: string): Promise<number | undefined>;
}
export declare function findFirstDifferingLine(original: string, formatted: string): number | undefined;
export {};
