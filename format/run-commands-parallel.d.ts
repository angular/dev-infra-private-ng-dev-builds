import { FormatterAction } from './formatters/index.js';
export interface FormatFailure {
    filePath: string;
    message: string;
}
export declare function runFormatterInParallel(allFiles: string[], action: FormatterAction): Promise<false | FormatFailure[]>;
