/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * The base class for formatters to run against provided files.
 */
export class Formatter {
    constructor(git, config) {
        this.git = git;
        this.config = config;
    }
    /**
     * Retrieve the command to execute the provided action, including both the binary
     * and command line flags.
     */
    commandFor(action) {
        switch (action) {
            case 'check':
                return `${this.binaryFilePath} ${this.actions.check.commandFlags}`;
            case 'format':
                return `${this.binaryFilePath} ${this.actions.format.commandFlags}`;
            default:
                throw Error('Unknown action type');
        }
    }
    /**
     * Retrieve the callback for the provided action to determine if an action
     * failed in formatting.
     */
    callbackFor(action) {
        switch (action) {
            case 'check':
                return this.actions.check.callback;
            case 'format':
                return this.actions.format.callback;
            default:
                throw Error('Unknown action type');
        }
    }
    /** Whether the formatter is enabled in the provided config. */
    isEnabled() {
        return !!this.config[this.name];
    }
    /** Retrieve the active file matcher for the formatter. */
    getFileMatcher() {
        return this.getFileMatcherFromConfig() || this.defaultFileMatcher;
    }
    /**
     * Retrieves the file matcher from the config provided to the constructor if provided.
     */
    getFileMatcherFromConfig() {
        const formatterConfig = this.config[this.name];
        if (typeof formatterConfig === 'boolean') {
            return undefined;
        }
        return formatterConfig.matchers;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1mb3JtYXR0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvZm9ybWF0L2Zvcm1hdHRlcnMvYmFzZS1mb3JtYXR0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBc0JIOztHQUVHO0FBQ0gsTUFBTSxPQUFnQixTQUFTO0lBcUI3QixZQUNZLEdBQWMsRUFDZCxNQUFvQjtRQURwQixRQUFHLEdBQUgsR0FBRyxDQUFXO1FBQ2QsV0FBTSxHQUFOLE1BQU0sQ0FBYztJQUM3QixDQUFDO0lBRUo7OztPQUdHO0lBQ0gsVUFBVSxDQUFDLE1BQXVCO1FBQ2hDLFFBQVEsTUFBTSxFQUFFLENBQUM7WUFDZixLQUFLLE9BQU87Z0JBQ1YsT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDckUsS0FBSyxRQUFRO2dCQUNYLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3RFO2dCQUNFLE1BQU0sS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDdkMsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxXQUFXLENBQUMsTUFBdUI7UUFDakMsUUFBUSxNQUFNLEVBQUUsQ0FBQztZQUNmLEtBQUssT0FBTztnQkFDVixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxLQUFLLFFBQVE7Z0JBQ1gsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDdEM7Z0JBQ0UsTUFBTSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUN2QyxDQUFDO0lBQ0gsQ0FBQztJQUVELCtEQUErRDtJQUMvRCxTQUFTO1FBQ1AsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVELDBEQUEwRDtJQUMxRCxjQUFjO1FBQ1osT0FBTyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUM7SUFDcEUsQ0FBQztJQUVEOztPQUVHO0lBQ0ssd0JBQXdCO1FBQzlCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9DLElBQUksT0FBTyxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDekMsT0FBTyxTQUFTLENBQUM7UUFDbkIsQ0FBQztRQUNELE9BQU8sZUFBZSxDQUFDLFFBQVEsQ0FBQztJQUNsQyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXQtY2xpZW50LmpzJztcbmltcG9ydCB7Rm9ybWF0Q29uZmlnfSBmcm9tICcuLi9jb25maWcuanMnO1xuXG4vLyBBIGNhbGxiYWNrIHRvIGRldGVybWluZSBpZiB0aGUgZm9ybWF0dGVyIHJ1biBmb3VuZCBhIGZhaWx1cmUgaW4gZm9ybWF0dGluZy5cbmV4cG9ydCB0eXBlIENhbGxiYWNrRnVuYyA9IChcbiAgZmlsZTogc3RyaW5nLFxuICBjb2RlOiBudW1iZXIgfCBOb2RlSlMuU2lnbmFscyxcbiAgc3Rkb3V0OiBzdHJpbmcsXG4gIHN0ZGVycjogc3RyaW5nLFxuKSA9PiBib29sZWFuO1xuXG4vLyBUaGUgYWN0aW9ucyBhIGZvcm1hdHRlciBjYW4gdGFrZS5cbmV4cG9ydCB0eXBlIEZvcm1hdHRlckFjdGlvbiA9ICdjaGVjaycgfCAnZm9ybWF0JztcblxuLy8gVGhlIG1ldGFkYXRhIG5lZWRlZCBmb3IgcnVubmluZyBvbmUgb2YgdGhlIGBGb3JtYXR0ZXJBY3Rpb25gcyBvbiBhIGZpbGUuXG5pbnRlcmZhY2UgRm9ybWF0dGVyQWN0aW9uTWV0YWRhdGEge1xuICBjb21tYW5kRmxhZ3M6IHN0cmluZztcbiAgY2FsbGJhY2s6IENhbGxiYWNrRnVuYztcbn1cblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgZm9ybWF0dGVycyB0byBydW4gYWdhaW5zdCBwcm92aWRlZCBmaWxlcy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEZvcm1hdHRlciB7XG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGUgZm9ybWF0dGVyLCB0aGlzIGlzIHVzZWQgZm9yIGlkZW50aWZpY2F0aW9uIGluIGxvZ2dpbmcgYW5kIGZvciBlbmFibGluZyBhbmRcbiAgICogY29uZmlndXJpbmcgdGhlIGZvcm1hdHRlciBpbiB0aGUgY29uZmlnLlxuICAgKi9cbiAgYWJzdHJhY3QgbmFtZTogc3RyaW5nO1xuXG4gIC8qKiBUaGUgZnVsbCBwYXRoIGZpbGUgbG9jYXRpb24gb2YgdGhlIGZvcm1hdHRlciBiaW5hcnkuICovXG4gIGFic3RyYWN0IGJpbmFyeUZpbGVQYXRoOiBzdHJpbmc7XG5cbiAgLyoqIE1ldGFkYXRhIGZvciBlYWNoIGBGb3JtYXR0ZXJBY3Rpb25gIGF2YWlsYWJsZSB0byB0aGUgZm9ybWF0dGVyLiAqL1xuICBhYnN0cmFjdCBhY3Rpb25zOiB7XG4gICAgLy8gQW4gYWN0aW9uIHBlcmZvcm1pbmcgYSBjaGVjayBvZiBmb3JtYXQgd2l0aG91dCBtYWtpbmcgYW55IGNoYW5nZXMuXG4gICAgY2hlY2s6IEZvcm1hdHRlckFjdGlvbk1ldGFkYXRhO1xuICAgIC8vIEFuIGFjdGlvbiB0byBmb3JtYXQgZmlsZXMgaW4gcGxhY2UuXG4gICAgZm9ybWF0OiBGb3JtYXR0ZXJBY3Rpb25NZXRhZGF0YTtcbiAgfTtcblxuICAvKiogVGhlIGRlZmF1bHQgbWF0Y2hlcnMgZm9yIHRoZSBmb3JtYXR0ZXIgZm9yIGZpbHRlcmluZyBmaWxlcyB0byBiZSBmb3JtYXR0ZWQuICovXG4gIGFic3RyYWN0IGRlZmF1bHRGaWxlTWF0Y2hlcjogc3RyaW5nW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGdpdDogR2l0Q2xpZW50LFxuICAgIHByb3RlY3RlZCBjb25maWc6IEZvcm1hdENvbmZpZyxcbiAgKSB7fVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgY29tbWFuZCB0byBleGVjdXRlIHRoZSBwcm92aWRlZCBhY3Rpb24sIGluY2x1ZGluZyBib3RoIHRoZSBiaW5hcnlcbiAgICogYW5kIGNvbW1hbmQgbGluZSBmbGFncy5cbiAgICovXG4gIGNvbW1hbmRGb3IoYWN0aW9uOiBGb3JtYXR0ZXJBY3Rpb24pIHtcbiAgICBzd2l0Y2ggKGFjdGlvbikge1xuICAgICAgY2FzZSAnY2hlY2snOlxuICAgICAgICByZXR1cm4gYCR7dGhpcy5iaW5hcnlGaWxlUGF0aH0gJHt0aGlzLmFjdGlvbnMuY2hlY2suY29tbWFuZEZsYWdzfWA7XG4gICAgICBjYXNlICdmb3JtYXQnOlxuICAgICAgICByZXR1cm4gYCR7dGhpcy5iaW5hcnlGaWxlUGF0aH0gJHt0aGlzLmFjdGlvbnMuZm9ybWF0LmNvbW1hbmRGbGFnc31gO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgRXJyb3IoJ1Vua25vd24gYWN0aW9uIHR5cGUnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIGNhbGxiYWNrIGZvciB0aGUgcHJvdmlkZWQgYWN0aW9uIHRvIGRldGVybWluZSBpZiBhbiBhY3Rpb25cbiAgICogZmFpbGVkIGluIGZvcm1hdHRpbmcuXG4gICAqL1xuICBjYWxsYmFja0ZvcihhY3Rpb246IEZvcm1hdHRlckFjdGlvbikge1xuICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICBjYXNlICdjaGVjayc6XG4gICAgICAgIHJldHVybiB0aGlzLmFjdGlvbnMuY2hlY2suY2FsbGJhY2s7XG4gICAgICBjYXNlICdmb3JtYXQnOlxuICAgICAgICByZXR1cm4gdGhpcy5hY3Rpb25zLmZvcm1hdC5jYWxsYmFjaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IEVycm9yKCdVbmtub3duIGFjdGlvbiB0eXBlJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFdoZXRoZXIgdGhlIGZvcm1hdHRlciBpcyBlbmFibGVkIGluIHRoZSBwcm92aWRlZCBjb25maWcuICovXG4gIGlzRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gISF0aGlzLmNvbmZpZ1t0aGlzLm5hbWVdO1xuICB9XG5cbiAgLyoqIFJldHJpZXZlIHRoZSBhY3RpdmUgZmlsZSBtYXRjaGVyIGZvciB0aGUgZm9ybWF0dGVyLiAqL1xuICBnZXRGaWxlTWF0Y2hlcigpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRGaWxlTWF0Y2hlckZyb21Db25maWcoKSB8fCB0aGlzLmRlZmF1bHRGaWxlTWF0Y2hlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGZpbGUgbWF0Y2hlciBmcm9tIHRoZSBjb25maWcgcHJvdmlkZWQgdG8gdGhlIGNvbnN0cnVjdG9yIGlmIHByb3ZpZGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRGaWxlTWF0Y2hlckZyb21Db25maWcoKTogc3RyaW5nW10gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGZvcm1hdHRlckNvbmZpZyA9IHRoaXMuY29uZmlnW3RoaXMubmFtZV07XG4gICAgaWYgKHR5cGVvZiBmb3JtYXR0ZXJDb25maWcgPT09ICdib29sZWFuJykge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGZvcm1hdHRlckNvbmZpZy5tYXRjaGVycztcbiAgfVxufVxuIl19