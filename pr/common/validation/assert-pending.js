/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
/** Assert the pull request is pending, not closed, merged or in draft. */
// TODO: update typings to make sure portability is properly handled for windows build.
export const pendingStateValidation = createPullRequestValidation({ name: 'assertPending', canBeForceIgnored: false }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest) {
        if (pullRequest.isDraft) {
            throw this._createError('Pull request is still a draft.');
        }
        switch (pullRequest.state) {
            case 'CLOSED':
                throw this._createError('Pull request is already closed.');
            case 'MERGED':
                throw this._createError('Pull request is already merged.');
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0LXBlbmRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY29tbW9uL3ZhbGlkYXRpb24vYXNzZXJ0LXBlbmRpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLDJCQUEyQixFQUFFLHFCQUFxQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFMUYsMEVBQTBFO0FBQzFFLHVGQUF1RjtBQUN2RixNQUFNLENBQUMsTUFBTSxzQkFBc0IsR0FBRywyQkFBMkIsQ0FDL0QsRUFBQyxJQUFJLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBQyxFQUNqRCxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQ2pCLENBQUM7QUFFRixNQUFNLFVBQVcsU0FBUSxxQkFBcUI7SUFDNUMsTUFBTSxDQUFDLFdBQWtDO1FBQ3ZDLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3hCLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFDRCxRQUFRLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMxQixLQUFLLFFBQVE7Z0JBQ1gsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDN0QsS0FBSyxRQUFRO2dCQUNYLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQy9ELENBQUM7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQdWxsUmVxdWVzdEZyb21HaXRodWJ9IGZyb20gJy4uL2ZldGNoLXB1bGwtcmVxdWVzdC5qcyc7XG5pbXBvcnQge2NyZWF0ZVB1bGxSZXF1ZXN0VmFsaWRhdGlvbiwgUHVsbFJlcXVlc3RWYWxpZGF0aW9ufSBmcm9tICcuL3ZhbGlkYXRpb24tY29uZmlnLmpzJztcblxuLyoqIEFzc2VydCB0aGUgcHVsbCByZXF1ZXN0IGlzIHBlbmRpbmcsIG5vdCBjbG9zZWQsIG1lcmdlZCBvciBpbiBkcmFmdC4gKi9cbi8vIFRPRE86IHVwZGF0ZSB0eXBpbmdzIHRvIG1ha2Ugc3VyZSBwb3J0YWJpbGl0eSBpcyBwcm9wZXJseSBoYW5kbGVkIGZvciB3aW5kb3dzIGJ1aWxkLlxuZXhwb3J0IGNvbnN0IHBlbmRpbmdTdGF0ZVZhbGlkYXRpb24gPSBjcmVhdGVQdWxsUmVxdWVzdFZhbGlkYXRpb24oXG4gIHtuYW1lOiAnYXNzZXJ0UGVuZGluZycsIGNhbkJlRm9yY2VJZ25vcmVkOiBmYWxzZX0sXG4gICgpID0+IFZhbGlkYXRpb24sXG4pO1xuXG5jbGFzcyBWYWxpZGF0aW9uIGV4dGVuZHMgUHVsbFJlcXVlc3RWYWxpZGF0aW9uIHtcbiAgYXNzZXJ0KHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdEZyb21HaXRodWIpIHtcbiAgICBpZiAocHVsbFJlcXVlc3QuaXNEcmFmdCkge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoJ1B1bGwgcmVxdWVzdCBpcyBzdGlsbCBhIGRyYWZ0LicpO1xuICAgIH1cbiAgICBzd2l0Y2ggKHB1bGxSZXF1ZXN0LnN0YXRlKSB7XG4gICAgICBjYXNlICdDTE9TRUQnOlxuICAgICAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcignUHVsbCByZXF1ZXN0IGlzIGFscmVhZHkgY2xvc2VkLicpO1xuICAgICAgY2FzZSAnTUVSR0VEJzpcbiAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoJ1B1bGwgcmVxdWVzdCBpcyBhbHJlYWR5IG1lcmdlZC4nKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==