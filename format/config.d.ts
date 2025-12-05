import { NgDevConfig } from '../utils/config.js';
export interface FormatConfig {
    prettier: boolean;
    buildifier: boolean;
}
export declare function assertValidFormatConfig<T extends NgDevConfig>(config: T & Partial<{
    format: FormatConfig;
}>): asserts config is T & {
    format: FormatConfig;
};
