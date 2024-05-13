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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1mb3JtYXR0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvZm9ybWF0L2Zvcm1hdHRlcnMvYmFzZS1mb3JtYXR0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBc0JIOztHQUVHO0FBQ0gsTUFBTSxPQUFnQixTQUFTO0lBcUI3QixZQUFzQixHQUFjLEVBQVksTUFBb0I7UUFBOUMsUUFBRyxHQUFILEdBQUcsQ0FBVztRQUFZLFdBQU0sR0FBTixNQUFNLENBQWM7SUFBRyxDQUFDO0lBRXhFOzs7T0FHRztJQUNILFVBQVUsQ0FBQyxNQUF1QjtRQUNoQyxRQUFRLE1BQU0sRUFBRSxDQUFDO1lBQ2YsS0FBSyxPQUFPO2dCQUNWLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3JFLEtBQUssUUFBUTtnQkFDWCxPQUFPLEdBQUcsSUFBSSxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN0RTtnQkFDRSxNQUFNLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLE1BQXVCO1FBQ2pDLFFBQVEsTUFBTSxFQUFFLENBQUM7WUFDZixLQUFLLE9BQU87Z0JBQ1YsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7WUFDckMsS0FBSyxRQUFRO2dCQUNYLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO1lBQ3RDO2dCQUNFLE1BQU0sS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDdkMsQ0FBQztJQUNILENBQUM7SUFFRCwrREFBK0Q7SUFDL0QsU0FBUztRQUNQLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCwwREFBMEQ7SUFDMUQsY0FBYztRQUNaLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixFQUFFLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDO0lBQ3BFLENBQUM7SUFFRDs7T0FFRztJQUNLLHdCQUF3QjtRQUM5QixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvQyxJQUFJLE9BQU8sZUFBZSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3pDLE9BQU8sU0FBUyxDQUFDO1FBQ25CLENBQUM7UUFDRCxPQUFPLGVBQWUsQ0FBQyxRQUFRLENBQUM7SUFDbEMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7R2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge0Zvcm1hdENvbmZpZ30gZnJvbSAnLi4vY29uZmlnLmpzJztcblxuLy8gQSBjYWxsYmFjayB0byBkZXRlcm1pbmUgaWYgdGhlIGZvcm1hdHRlciBydW4gZm91bmQgYSBmYWlsdXJlIGluIGZvcm1hdHRpbmcuXG5leHBvcnQgdHlwZSBDYWxsYmFja0Z1bmMgPSAoXG4gIGZpbGU6IHN0cmluZyxcbiAgY29kZTogbnVtYmVyIHwgTm9kZUpTLlNpZ25hbHMsXG4gIHN0ZG91dDogc3RyaW5nLFxuICBzdGRlcnI6IHN0cmluZyxcbikgPT4gYm9vbGVhbjtcblxuLy8gVGhlIGFjdGlvbnMgYSBmb3JtYXR0ZXIgY2FuIHRha2UuXG5leHBvcnQgdHlwZSBGb3JtYXR0ZXJBY3Rpb24gPSAnY2hlY2snIHwgJ2Zvcm1hdCc7XG5cbi8vIFRoZSBtZXRhZGF0YSBuZWVkZWQgZm9yIHJ1bm5pbmcgb25lIG9mIHRoZSBgRm9ybWF0dGVyQWN0aW9uYHMgb24gYSBmaWxlLlxuaW50ZXJmYWNlIEZvcm1hdHRlckFjdGlvbk1ldGFkYXRhIHtcbiAgY29tbWFuZEZsYWdzOiBzdHJpbmc7XG4gIGNhbGxiYWNrOiBDYWxsYmFja0Z1bmM7XG59XG5cbi8qKlxuICogVGhlIGJhc2UgY2xhc3MgZm9yIGZvcm1hdHRlcnMgdG8gcnVuIGFnYWluc3QgcHJvdmlkZWQgZmlsZXMuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBGb3JtYXR0ZXIge1xuICAvKipcbiAgICogVGhlIG5hbWUgb2YgdGhlIGZvcm1hdHRlciwgdGhpcyBpcyB1c2VkIGZvciBpZGVudGlmaWNhdGlvbiBpbiBsb2dnaW5nIGFuZCBmb3IgZW5hYmxpbmcgYW5kXG4gICAqIGNvbmZpZ3VyaW5nIHRoZSBmb3JtYXR0ZXIgaW4gdGhlIGNvbmZpZy5cbiAgICovXG4gIGFic3RyYWN0IG5hbWU6IHN0cmluZztcblxuICAvKiogVGhlIGZ1bGwgcGF0aCBmaWxlIGxvY2F0aW9uIG9mIHRoZSBmb3JtYXR0ZXIgYmluYXJ5LiAqL1xuICBhYnN0cmFjdCBiaW5hcnlGaWxlUGF0aDogc3RyaW5nO1xuXG4gIC8qKiBNZXRhZGF0YSBmb3IgZWFjaCBgRm9ybWF0dGVyQWN0aW9uYCBhdmFpbGFibGUgdG8gdGhlIGZvcm1hdHRlci4gKi9cbiAgYWJzdHJhY3QgYWN0aW9uczoge1xuICAgIC8vIEFuIGFjdGlvbiBwZXJmb3JtaW5nIGEgY2hlY2sgb2YgZm9ybWF0IHdpdGhvdXQgbWFraW5nIGFueSBjaGFuZ2VzLlxuICAgIGNoZWNrOiBGb3JtYXR0ZXJBY3Rpb25NZXRhZGF0YTtcbiAgICAvLyBBbiBhY3Rpb24gdG8gZm9ybWF0IGZpbGVzIGluIHBsYWNlLlxuICAgIGZvcm1hdDogRm9ybWF0dGVyQWN0aW9uTWV0YWRhdGE7XG4gIH07XG5cbiAgLyoqIFRoZSBkZWZhdWx0IG1hdGNoZXJzIGZvciB0aGUgZm9ybWF0dGVyIGZvciBmaWx0ZXJpbmcgZmlsZXMgdG8gYmUgZm9ybWF0dGVkLiAqL1xuICBhYnN0cmFjdCBkZWZhdWx0RmlsZU1hdGNoZXI6IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBnaXQ6IEdpdENsaWVudCwgcHJvdGVjdGVkIGNvbmZpZzogRm9ybWF0Q29uZmlnKSB7fVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgY29tbWFuZCB0byBleGVjdXRlIHRoZSBwcm92aWRlZCBhY3Rpb24sIGluY2x1ZGluZyBib3RoIHRoZSBiaW5hcnlcbiAgICogYW5kIGNvbW1hbmQgbGluZSBmbGFncy5cbiAgICovXG4gIGNvbW1hbmRGb3IoYWN0aW9uOiBGb3JtYXR0ZXJBY3Rpb24pIHtcbiAgICBzd2l0Y2ggKGFjdGlvbikge1xuICAgICAgY2FzZSAnY2hlY2snOlxuICAgICAgICByZXR1cm4gYCR7dGhpcy5iaW5hcnlGaWxlUGF0aH0gJHt0aGlzLmFjdGlvbnMuY2hlY2suY29tbWFuZEZsYWdzfWA7XG4gICAgICBjYXNlICdmb3JtYXQnOlxuICAgICAgICByZXR1cm4gYCR7dGhpcy5iaW5hcnlGaWxlUGF0aH0gJHt0aGlzLmFjdGlvbnMuZm9ybWF0LmNvbW1hbmRGbGFnc31gO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgRXJyb3IoJ1Vua25vd24gYWN0aW9uIHR5cGUnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIGNhbGxiYWNrIGZvciB0aGUgcHJvdmlkZWQgYWN0aW9uIHRvIGRldGVybWluZSBpZiBhbiBhY3Rpb25cbiAgICogZmFpbGVkIGluIGZvcm1hdHRpbmcuXG4gICAqL1xuICBjYWxsYmFja0ZvcihhY3Rpb246IEZvcm1hdHRlckFjdGlvbikge1xuICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICBjYXNlICdjaGVjayc6XG4gICAgICAgIHJldHVybiB0aGlzLmFjdGlvbnMuY2hlY2suY2FsbGJhY2s7XG4gICAgICBjYXNlICdmb3JtYXQnOlxuICAgICAgICByZXR1cm4gdGhpcy5hY3Rpb25zLmZvcm1hdC5jYWxsYmFjaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IEVycm9yKCdVbmtub3duIGFjdGlvbiB0eXBlJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFdoZXRoZXIgdGhlIGZvcm1hdHRlciBpcyBlbmFibGVkIGluIHRoZSBwcm92aWRlZCBjb25maWcuICovXG4gIGlzRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gISF0aGlzLmNvbmZpZ1t0aGlzLm5hbWVdO1xuICB9XG5cbiAgLyoqIFJldHJpZXZlIHRoZSBhY3RpdmUgZmlsZSBtYXRjaGVyIGZvciB0aGUgZm9ybWF0dGVyLiAqL1xuICBnZXRGaWxlTWF0Y2hlcigpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRGaWxlTWF0Y2hlckZyb21Db25maWcoKSB8fCB0aGlzLmRlZmF1bHRGaWxlTWF0Y2hlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGZpbGUgbWF0Y2hlciBmcm9tIHRoZSBjb25maWcgcHJvdmlkZWQgdG8gdGhlIGNvbnN0cnVjdG9yIGlmIHByb3ZpZGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRGaWxlTWF0Y2hlckZyb21Db25maWcoKTogc3RyaW5nW10gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGZvcm1hdHRlckNvbmZpZyA9IHRoaXMuY29uZmlnW3RoaXMubmFtZV07XG4gICAgaWYgKHR5cGVvZiBmb3JtYXR0ZXJDb25maWcgPT09ICdib29sZWFuJykge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGZvcm1hdHRlckNvbmZpZy5tYXRjaGVycztcbiAgfVxufVxuIl19