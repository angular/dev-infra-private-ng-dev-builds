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
export const targetLabels = createTypedObject()({
    TARGET_FEATURE: new TargetLabel({
        description: 'This PR is targeted for a feature branch (outside of main and semver branches)',
        name: 'target: feature',
    }),
    TARGET_LTS: new TargetLabel({
        description: 'This PR is targeting a version currently in long-term support',
        name: 'target: lts',
    }),
    TARGET_MAJOR: new TargetLabel({
        description: 'This PR is targeted for the next major release',
        name: 'target: major',
    }),
    TARGET_MINOR: new TargetLabel({
        description: 'This PR is targeted for the next minor release',
        name: 'target: minor',
    }),
    TARGET_PATCH: new TargetLabel({
        description: 'This PR is targeted for the next patch release',
        name: 'target: patch',
    }),
    TARGET_RC: new TargetLabel({
        description: 'This PR is targeted for the next release-candidate',
        name: 'target: rc',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFyZ2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi9sYWJlbHMvdGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxLQUFLLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFbkQsTUFBTSxPQUFPLFdBQVksU0FBUSxLQUFLO0lBQXRDOztRQUNFLG9FQUFvRTtRQUNwRSw2QkFBd0IsR0FBRyxJQUFJLENBQUM7SUFDbEMsQ0FBQztDQUFBO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixFQUFlLENBQUM7SUFDM0QsY0FBYyxFQUFFLElBQUksV0FBVyxDQUFDO1FBQzlCLFdBQVcsRUFBRSxnRkFBZ0Y7UUFDN0YsSUFBSSxFQUFFLGlCQUFpQjtLQUN4QixDQUFDO0lBQ0YsVUFBVSxFQUFFLElBQUksV0FBVyxDQUFDO1FBQzFCLFdBQVcsRUFBRSwrREFBK0Q7UUFDNUUsSUFBSSxFQUFFLGFBQWE7S0FDcEIsQ0FBQztJQUNGLFlBQVksRUFBRSxJQUFJLFdBQVcsQ0FBQztRQUM1QixXQUFXLEVBQUUsZ0RBQWdEO1FBQzdELElBQUksRUFBRSxlQUFlO0tBQ3RCLENBQUM7SUFDRixZQUFZLEVBQUUsSUFBSSxXQUFXLENBQUM7UUFDNUIsV0FBVyxFQUFFLGdEQUFnRDtRQUM3RCxJQUFJLEVBQUUsZUFBZTtLQUN0QixDQUFDO0lBQ0YsWUFBWSxFQUFFLElBQUksV0FBVyxDQUFDO1FBQzVCLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsSUFBSSxFQUFFLGVBQWU7S0FDdEIsQ0FBQztJQUNGLFNBQVMsRUFBRSxJQUFJLFdBQVcsQ0FBQztRQUN6QixXQUFXLEVBQUUsb0RBQW9EO1FBQ2pFLElBQUksRUFBRSxZQUFZO0tBQ25CLENBQUM7Q0FDSCxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2NyZWF0ZVR5cGVkT2JqZWN0LCBMYWJlbH0gZnJvbSAnLi9iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFRhcmdldExhYmVsIGV4dGVuZHMgTGFiZWwge1xuICAvLyBGaWVsZCB0byBlbnN1cmUgb3RoZXIgbGFiZWxzIGFyZSBub3QgYXNzaWduYWJsZSB0byBgVGFyZ2V0TGFiZWxgLlxuICBfX2hhc1RhcmdldExhYmVsTWFya2VyX18gPSB0cnVlO1xufVxuXG4vKipcbiAqIFJlY29yZCBjYXB0dXJpbmcgYXZhaWxhYmxlIHRhcmdldCBsYWJlbCBuYW1lcyBpbiB0aGUgQW5ndWxhciBvcmdhbml6YXRpb24uXG4gKiBBIHRhcmdldCBsYWJlbCBpcyBzZXQgb24gYSBwdWxsIHJlcXVlc3QgdG8gc3BlY2lmeSB3aGVyZSBpdHMgY2hhbmdlcyBzaG91bGQgbGFuZC5cbiAqXG4gKiBNb3JlIGRldGFpbHMgY2FuIGJlIGZvdW5kIGhlcmU6XG4gKiBodHRwczovL2RvY3MuZ29vZ2xlLmNvbS9kb2N1bWVudC9kLzE5N2tWaWxsRHd4LVJadFNWT0J0UGI0QkJJQXcwRTlSVDNxM3Y2RFpreWtVI2hlYWRpbmc9aC5sa3V5cGozOGgxNWRcbiAqL1xuZXhwb3J0IGNvbnN0IHRhcmdldExhYmVscyA9IGNyZWF0ZVR5cGVkT2JqZWN0PFRhcmdldExhYmVsPigpKHtcbiAgVEFSR0VUX0ZFQVRVUkU6IG5ldyBUYXJnZXRMYWJlbCh7XG4gICAgZGVzY3JpcHRpb246ICdUaGlzIFBSIGlzIHRhcmdldGVkIGZvciBhIGZlYXR1cmUgYnJhbmNoIChvdXRzaWRlIG9mIG1haW4gYW5kIHNlbXZlciBicmFuY2hlcyknLFxuICAgIG5hbWU6ICd0YXJnZXQ6IGZlYXR1cmUnLFxuICB9KSxcbiAgVEFSR0VUX0xUUzogbmV3IFRhcmdldExhYmVsKHtcbiAgICBkZXNjcmlwdGlvbjogJ1RoaXMgUFIgaXMgdGFyZ2V0aW5nIGEgdmVyc2lvbiBjdXJyZW50bHkgaW4gbG9uZy10ZXJtIHN1cHBvcnQnLFxuICAgIG5hbWU6ICd0YXJnZXQ6IGx0cycsXG4gIH0pLFxuICBUQVJHRVRfTUFKT1I6IG5ldyBUYXJnZXRMYWJlbCh7XG4gICAgZGVzY3JpcHRpb246ICdUaGlzIFBSIGlzIHRhcmdldGVkIGZvciB0aGUgbmV4dCBtYWpvciByZWxlYXNlJyxcbiAgICBuYW1lOiAndGFyZ2V0OiBtYWpvcicsXG4gIH0pLFxuICBUQVJHRVRfTUlOT1I6IG5ldyBUYXJnZXRMYWJlbCh7XG4gICAgZGVzY3JpcHRpb246ICdUaGlzIFBSIGlzIHRhcmdldGVkIGZvciB0aGUgbmV4dCBtaW5vciByZWxlYXNlJyxcbiAgICBuYW1lOiAndGFyZ2V0OiBtaW5vcicsXG4gIH0pLFxuICBUQVJHRVRfUEFUQ0g6IG5ldyBUYXJnZXRMYWJlbCh7XG4gICAgZGVzY3JpcHRpb246ICdUaGlzIFBSIGlzIHRhcmdldGVkIGZvciB0aGUgbmV4dCBwYXRjaCByZWxlYXNlJyxcbiAgICBuYW1lOiAndGFyZ2V0OiBwYXRjaCcsXG4gIH0pLFxuICBUQVJHRVRfUkM6IG5ldyBUYXJnZXRMYWJlbCh7XG4gICAgZGVzY3JpcHRpb246ICdUaGlzIFBSIGlzIHRhcmdldGVkIGZvciB0aGUgbmV4dCByZWxlYXNlLWNhbmRpZGF0ZScsXG4gICAgbmFtZTogJ3RhcmdldDogcmMnLFxuICB9KSxcbn0pO1xuIl19