/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ConfigValidationError } from '../utils/config.js';
/** Retrieve and validate the config as `FormatConfig`. */
export function assertValidFormatConfig(config) {
    // List of errors encountered validating the config.
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
/** Validate an individual Formatter config. */
function checkFormatterConfig(key, config, errors) {
    if (config.matchers === undefined) {
        errors.push(`Missing "format.${key}.matchers" value`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L2Zvcm1hdC9jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHFCQUFxQixFQUFjLE1BQU0sb0JBQW9CLENBQUM7QUFVdEUsMERBQTBEO0FBQzFELE1BQU0sVUFBVSx1QkFBdUIsQ0FDckMsTUFBMkM7SUFFM0Msb0RBQW9EO0lBQ3BELE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUM1QixJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDaEMsTUFBTSxJQUFJLHFCQUFxQixDQUFDLHVDQUF1QyxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFPLENBQUMsRUFBRSxDQUFDO1FBQzFELFFBQVEsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNyQixLQUFLLFNBQVM7Z0JBQ1osTUFBTTtZQUNSLEtBQUssUUFBUTtnQkFDWCxvQkFBb0IsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUN6QyxNQUFNO1lBQ1I7Z0JBQ0UsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsd0NBQXdDLENBQUMsQ0FBQztRQUN4RSxDQUFDO0lBQ0gsQ0FBQztJQUNELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2xCLE1BQU0sSUFBSSxxQkFBcUIsQ0FBQyxnQ0FBZ0MsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1RSxDQUFDO0FBQ0gsQ0FBQztBQUVELCtDQUErQztBQUMvQyxTQUFTLG9CQUFvQixDQUFDLEdBQVcsRUFBRSxNQUEwQixFQUFFLE1BQWdCO0lBQ3JGLElBQUksTUFBTSxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLG1CQUFtQixHQUFHLGtCQUFrQixDQUFDLENBQUM7SUFDeEQsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb25maWdWYWxpZGF0aW9uRXJyb3IsIE5nRGV2Q29uZmlnfSBmcm9tICcuLi91dGlscy9jb25maWcuanMnO1xuXG5pbnRlcmZhY2UgRm9ybWF0dGVyIHtcbiAgbWF0Y2hlcnM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZvcm1hdENvbmZpZyB7XG4gIFtrZXk6IHN0cmluZ106IGJvb2xlYW4gfCBGb3JtYXR0ZXI7XG59XG5cbi8qKiBSZXRyaWV2ZSBhbmQgdmFsaWRhdGUgdGhlIGNvbmZpZyBhcyBgRm9ybWF0Q29uZmlnYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZEZvcm1hdENvbmZpZzxUIGV4dGVuZHMgTmdEZXZDb25maWc+KFxuICBjb25maWc6IFQgJiBQYXJ0aWFsPHtmb3JtYXQ6IEZvcm1hdENvbmZpZ30+LFxuKTogYXNzZXJ0cyBjb25maWcgaXMgVCAmIHtmb3JtYXQ6IEZvcm1hdENvbmZpZ30ge1xuICAvLyBMaXN0IG9mIGVycm9ycyBlbmNvdW50ZXJlZCB2YWxpZGF0aW5nIHRoZSBjb25maWcuXG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgaWYgKGNvbmZpZy5mb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBDb25maWdWYWxpZGF0aW9uRXJyb3IoYE5vIGNvbmZpZ3VyYXRpb24gZGVmaW5lZCBmb3IgXCJmb3JtYXRcImApO1xuICB9XG5cbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29uZmlnLmZvcm1hdCEpKSB7XG4gICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIGNoZWNrRm9ybWF0dGVyQ29uZmlnKGtleSwgdmFsdWUsIGVycm9ycyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgZXJyb3JzLnB1c2goYFwiZm9ybWF0LiR7a2V5fVwiIGlzIG5vdCBhIGJvb2xlYW4gb3IgRm9ybWF0dGVyIG9iamVjdGApO1xuICAgIH1cbiAgfVxuICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBDb25maWdWYWxpZGF0aW9uRXJyb3IoJ0ludmFsaWQgXCJmb3JtYXRcIiBjb25maWd1cmF0aW9uJywgZXJyb3JzKTtcbiAgfVxufVxuXG4vKiogVmFsaWRhdGUgYW4gaW5kaXZpZHVhbCBGb3JtYXR0ZXIgY29uZmlnLiAqL1xuZnVuY3Rpb24gY2hlY2tGb3JtYXR0ZXJDb25maWcoa2V5OiBzdHJpbmcsIGNvbmZpZzogUGFydGlhbDxGb3JtYXR0ZXI+LCBlcnJvcnM6IHN0cmluZ1tdKSB7XG4gIGlmIChjb25maWcubWF0Y2hlcnMgPT09IHVuZGVmaW5lZCkge1xuICAgIGVycm9ycy5wdXNoKGBNaXNzaW5nIFwiZm9ybWF0LiR7a2V5fS5tYXRjaGVyc1wiIHZhbHVlYCk7XG4gIH1cbn1cbiJdfQ==