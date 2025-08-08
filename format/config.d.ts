import { NgDevConfig } from '../utils/config.js';
interface Formatter {
    matchers: string[];
}
export interface FormatConfig {
    [key: string]: boolean | Formatter;
}
export declare function assertValidFormatConfig<T extends NgDevConfig>(config: T & Partial<{
    format: FormatConfig;
}>): asserts config is T & {
    format: FormatConfig;
};
export {};
