import { ConfigValidationError } from '../utils/config.js';
export function assertValidFormatConfig(config) {
    const errors = [];
    if (config.format === undefined) {
        throw new ConfigValidationError(`No configuration defined for "format"`);
    }
    for (const [key, value] of Object.entries(config.format)) {
        switch (typeof value) {
            case 'boolean':
                break;
            case 'object':
                checkFormatterConfig(key, value, errors);
                break;
            default:
                errors.push(`"format.${key}" is not a boolean or Formatter object`);
        }
    }
    if (errors.length) {
        throw new ConfigValidationError('Invalid "format" configuration', errors);
    }
}
function checkFormatterConfig(key, config, errors) {
    if (config.matchers === undefined) {
        errors.push(`Missing "format.${key}.matchers" value`);
    }
}
//# sourceMappingURL=config.js.map