import { createTypedObject, Label } from './base.js';
export class TargetLabel extends Label {
    constructor() {
        super(...arguments);
        // Field to ensure other labels are not assignable to `TargetLabel`.
        this.__hasTargetLabelMarker__ = true;
    }
}
/**
 * Record capturing available target label names in the Angular organization.
 * A target label is set on a pull request to specify where its changes should land.
 *
 * More details can be found here:
 * https://docs.google.com/document/d/197kVillDwx-RZtSVOBtPb4BBIAw0E9RT3q3v6DZkykU#heading=h.lkuypj38h15d
 */
export const targetLabels = createTypedObject(TargetLabel)({
    TARGET_FEATURE: {
        description: 'This PR is targeted for a feature branch (outside of main and semver branches)',
        name: 'target: feature',
    },
    TARGET_LTS: {
        description: 'This PR is targeting a version currently in long-term support',
        name: 'target: lts',
    },
    TARGET_MAJOR: {
        description: 'This PR is targeted for the next major release',
        name: 'target: major',
    },
    TARGET_MINOR: {
        description: 'This PR is targeted for the next minor release',
        name: 'target: minor',
    },
    TARGET_PATCH: {
        description: 'This PR is targeted for the next patch release',
        name: 'target: patch',
    },
    TARGET_RC: {
        description: 'This PR is targeted for the next release-candidate',
        name: 'target: rc',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFyZ2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi9sYWJlbHMvdGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxLQUFLLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFbkQsTUFBTSxPQUFPLFdBQVksU0FBUSxLQUFLO0lBQXRDOztRQUNFLG9FQUFvRTtRQUNwRSw2QkFBd0IsR0FBRyxJQUFJLENBQUM7SUFDbEMsQ0FBQztDQUFBO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3pELGNBQWMsRUFBRTtRQUNkLFdBQVcsRUFBRSxnRkFBZ0Y7UUFDN0YsSUFBSSxFQUFFLGlCQUFpQjtLQUN4QjtJQUNELFVBQVUsRUFBRTtRQUNWLFdBQVcsRUFBRSwrREFBK0Q7UUFDNUUsSUFBSSxFQUFFLGFBQWE7S0FDcEI7SUFDRCxZQUFZLEVBQUU7UUFDWixXQUFXLEVBQUUsZ0RBQWdEO1FBQzdELElBQUksRUFBRSxlQUFlO0tBQ3RCO0lBQ0QsWUFBWSxFQUFFO1FBQ1osV0FBVyxFQUFFLGdEQUFnRDtRQUM3RCxJQUFJLEVBQUUsZUFBZTtLQUN0QjtJQUNELFlBQVksRUFBRTtRQUNaLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsSUFBSSxFQUFFLGVBQWU7S0FDdEI7SUFDRCxTQUFTLEVBQUU7UUFDVCxXQUFXLEVBQUUsb0RBQW9EO1FBQ2pFLElBQUksRUFBRSxZQUFZO0tBQ25CO0NBQ0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtjcmVhdGVUeXBlZE9iamVjdCwgTGFiZWx9IGZyb20gJy4vYmFzZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUYXJnZXRMYWJlbCBleHRlbmRzIExhYmVsIHtcbiAgLy8gRmllbGQgdG8gZW5zdXJlIG90aGVyIGxhYmVscyBhcmUgbm90IGFzc2lnbmFibGUgdG8gYFRhcmdldExhYmVsYC5cbiAgX19oYXNUYXJnZXRMYWJlbE1hcmtlcl9fID0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBSZWNvcmQgY2FwdHVyaW5nIGF2YWlsYWJsZSB0YXJnZXQgbGFiZWwgbmFtZXMgaW4gdGhlIEFuZ3VsYXIgb3JnYW5pemF0aW9uLlxuICogQSB0YXJnZXQgbGFiZWwgaXMgc2V0IG9uIGEgcHVsbCByZXF1ZXN0IHRvIHNwZWNpZnkgd2hlcmUgaXRzIGNoYW5nZXMgc2hvdWxkIGxhbmQuXG4gKlxuICogTW9yZSBkZXRhaWxzIGNhbiBiZSBmb3VuZCBoZXJlOlxuICogaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vZG9jdW1lbnQvZC8xOTdrVmlsbER3eC1SWnRTVk9CdFBiNEJCSUF3MEU5UlQzcTN2NkRaa3lrVSNoZWFkaW5nPWgubGt1eXBqMzhoMTVkXG4gKi9cbmV4cG9ydCBjb25zdCB0YXJnZXRMYWJlbHMgPSBjcmVhdGVUeXBlZE9iamVjdChUYXJnZXRMYWJlbCkoe1xuICBUQVJHRVRfRkVBVFVSRToge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhpcyBQUiBpcyB0YXJnZXRlZCBmb3IgYSBmZWF0dXJlIGJyYW5jaCAob3V0c2lkZSBvZiBtYWluIGFuZCBzZW12ZXIgYnJhbmNoZXMpJyxcbiAgICBuYW1lOiAndGFyZ2V0OiBmZWF0dXJlJyxcbiAgfSxcbiAgVEFSR0VUX0xUUzoge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhpcyBQUiBpcyB0YXJnZXRpbmcgYSB2ZXJzaW9uIGN1cnJlbnRseSBpbiBsb25nLXRlcm0gc3VwcG9ydCcsXG4gICAgbmFtZTogJ3RhcmdldDogbHRzJyxcbiAgfSxcbiAgVEFSR0VUX01BSk9SOiB7XG4gICAgZGVzY3JpcHRpb246ICdUaGlzIFBSIGlzIHRhcmdldGVkIGZvciB0aGUgbmV4dCBtYWpvciByZWxlYXNlJyxcbiAgICBuYW1lOiAndGFyZ2V0OiBtYWpvcicsXG4gIH0sXG4gIFRBUkdFVF9NSU5PUjoge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhpcyBQUiBpcyB0YXJnZXRlZCBmb3IgdGhlIG5leHQgbWlub3IgcmVsZWFzZScsXG4gICAgbmFtZTogJ3RhcmdldDogbWlub3InLFxuICB9LFxuICBUQVJHRVRfUEFUQ0g6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1RoaXMgUFIgaXMgdGFyZ2V0ZWQgZm9yIHRoZSBuZXh0IHBhdGNoIHJlbGVhc2UnLFxuICAgIG5hbWU6ICd0YXJnZXQ6IHBhdGNoJyxcbiAgfSxcbiAgVEFSR0VUX1JDOiB7XG4gICAgZGVzY3JpcHRpb246ICdUaGlzIFBSIGlzIHRhcmdldGVkIGZvciB0aGUgbmV4dCByZWxlYXNlLWNhbmRpZGF0ZScsXG4gICAgbmFtZTogJ3RhcmdldDogcmMnLFxuICB9LFxufSk7XG4iXX0=