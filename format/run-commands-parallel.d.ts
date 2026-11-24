import { FormatterAction } from './formatters/index.js';
export interface FormatFailure {
    filePath: string;
    message: string;
    line?: number;
}
export declare function runFormatterInParallel(allFiles: string[], action: FormatterAction): Promise<false | FormatFailure[]>;
