/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/** Class that can be used to describe pull request validation failures. */
export class PullRequestValidationFailure {
    constructor(
    /** Human-readable message for the failure */
    message, 
    /** Validation config name for the failure. */
    validationName, 
    /** Validation config name for the failure. */
    canBeForceIgnored) {
        this.message = message;
        this.validationName = validationName;
        this.canBeForceIgnored = canBeForceIgnored;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGlvbi1mYWlsdXJlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi92YWxpZGF0aW9uL3ZhbGlkYXRpb24tZmFpbHVyZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCwyRUFBMkU7QUFDM0UsTUFBTSxPQUFPLDRCQUE0QjtJQUN2QztJQUNFLDZDQUE2QztJQUM3QixPQUFlO0lBQy9CLDhDQUE4QztJQUM5QixjQUFpRDtJQUNqRSw4Q0FBOEM7SUFDOUIsaUJBQTBCO1FBSjFCLFlBQU8sR0FBUCxPQUFPLENBQVE7UUFFZixtQkFBYyxHQUFkLGNBQWMsQ0FBbUM7UUFFakQsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFTO0lBQ3pDLENBQUM7Q0FDTCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1B1bGxSZXF1ZXN0VmFsaWRhdGlvbkNvbmZpZ30gZnJvbSAnLi4vLi4vY29uZmlnL2luZGV4LmpzJztcblxuLyoqIENsYXNzIHRoYXQgY2FuIGJlIHVzZWQgdG8gZGVzY3JpYmUgcHVsbCByZXF1ZXN0IHZhbGlkYXRpb24gZmFpbHVyZXMuICovXG5leHBvcnQgY2xhc3MgUHVsbFJlcXVlc3RWYWxpZGF0aW9uRmFpbHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIC8qKiBIdW1hbi1yZWFkYWJsZSBtZXNzYWdlIGZvciB0aGUgZmFpbHVyZSAqL1xuICAgIHB1YmxpYyByZWFkb25seSBtZXNzYWdlOiBzdHJpbmcsXG4gICAgLyoqIFZhbGlkYXRpb24gY29uZmlnIG5hbWUgZm9yIHRoZSBmYWlsdXJlLiAqL1xuICAgIHB1YmxpYyByZWFkb25seSB2YWxpZGF0aW9uTmFtZToga2V5b2YgUHVsbFJlcXVlc3RWYWxpZGF0aW9uQ29uZmlnLFxuICAgIC8qKiBWYWxpZGF0aW9uIGNvbmZpZyBuYW1lIGZvciB0aGUgZmFpbHVyZS4gKi9cbiAgICBwdWJsaWMgcmVhZG9ubHkgY2FuQmVGb3JjZUlnbm9yZWQ6IGJvb2xlYW4sXG4gICkge31cbn1cbiJdfQ==