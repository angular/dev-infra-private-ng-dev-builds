import { ConfigValidationError } from '../utils/config.js';
export function assertValidFormatConfig(config) {
    const errors = [];
    if (config.format === undefined) {
        throw new ConfigValidationError(`No configuration defined for "format"`);
    }
    for (const [key, value] of Object.entries(config.format)) {
        if (typeof value !== 'boolean') {
            errors.push(`"format.${key}" is not a boolean`);
        }
    }
    if (errors.length) {
        throw new ConfigValidationError('Invalid "format" configuration', errors);
    }
}
//# sourceMappingURL=config.js.map