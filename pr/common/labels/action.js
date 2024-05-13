import { createTypedObject } from './base.js';
export const actionLabels = createTypedObject()({
    ACTION_MERGE: {
        description: 'The PR is ready for merge by the caretaker',
        name: 'action: merge',
    },
    ACTION_CLEANUP: {
        description: 'The PR is in need of cleanup, either due to needing a rebase or in response to comments from reviews',
        name: 'action: cleanup',
    },
    ACTION_PRESUBMIT: {
        description: 'The PR is in need of a google3 presubmit',
        name: 'action: presubmit',
    },
    ACTION_GLOBAL_PRESUBMIT: {
        description: 'The PR is in need of a google3 global presubmit',
        name: 'action: global presubmit',
    },
    ACTION_REVIEW: {
        description: 'The PR is still awaiting reviews from at least one requested reviewer',
        name: 'action: review',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi9sYWJlbHMvYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxpQkFBaUIsRUFBUSxNQUFNLFdBQVcsQ0FBQztBQUluRCxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLEVBQWUsQ0FBQztJQUMzRCxZQUFZLEVBQUU7UUFDWixXQUFXLEVBQUUsNENBQTRDO1FBQ3pELElBQUksRUFBRSxlQUFlO0tBQ3RCO0lBQ0QsY0FBYyxFQUFFO1FBQ2QsV0FBVyxFQUNULHNHQUFzRztRQUN4RyxJQUFJLEVBQUUsaUJBQWlCO0tBQ3hCO0lBQ0QsZ0JBQWdCLEVBQUU7UUFDaEIsV0FBVyxFQUFFLDBDQUEwQztRQUN2RCxJQUFJLEVBQUUsbUJBQW1CO0tBQzFCO0lBQ0QsdUJBQXVCLEVBQUU7UUFDdkIsV0FBVyxFQUFFLGlEQUFpRDtRQUM5RCxJQUFJLEVBQUUsMEJBQTBCO0tBQ2pDO0lBQ0QsYUFBYSxFQUFFO1FBQ2IsV0FBVyxFQUFFLHVFQUF1RTtRQUNwRixJQUFJLEVBQUUsZ0JBQWdCO0tBQ3ZCO0NBQ0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtjcmVhdGVUeXBlZE9iamVjdCwgTGFiZWx9IGZyb20gJy4vYmFzZS5qcyc7XG5cbmludGVyZmFjZSBBY3Rpb25MYWJlbCBleHRlbmRzIExhYmVsIHt9XG5cbmV4cG9ydCBjb25zdCBhY3Rpb25MYWJlbHMgPSBjcmVhdGVUeXBlZE9iamVjdDxBY3Rpb25MYWJlbD4oKSh7XG4gIEFDVElPTl9NRVJHRToge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhlIFBSIGlzIHJlYWR5IGZvciBtZXJnZSBieSB0aGUgY2FyZXRha2VyJyxcbiAgICBuYW1lOiAnYWN0aW9uOiBtZXJnZScsXG4gIH0sXG4gIEFDVElPTl9DTEVBTlVQOiB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIFBSIGlzIGluIG5lZWQgb2YgY2xlYW51cCwgZWl0aGVyIGR1ZSB0byBuZWVkaW5nIGEgcmViYXNlIG9yIGluIHJlc3BvbnNlIHRvIGNvbW1lbnRzIGZyb20gcmV2aWV3cycsXG4gICAgbmFtZTogJ2FjdGlvbjogY2xlYW51cCcsXG4gIH0sXG4gIEFDVElPTl9QUkVTVUJNSVQ6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1RoZSBQUiBpcyBpbiBuZWVkIG9mIGEgZ29vZ2xlMyBwcmVzdWJtaXQnLFxuICAgIG5hbWU6ICdhY3Rpb246IHByZXN1Ym1pdCcsXG4gIH0sXG4gIEFDVElPTl9HTE9CQUxfUFJFU1VCTUlUOiB7XG4gICAgZGVzY3JpcHRpb246ICdUaGUgUFIgaXMgaW4gbmVlZCBvZiBhIGdvb2dsZTMgZ2xvYmFsIHByZXN1Ym1pdCcsXG4gICAgbmFtZTogJ2FjdGlvbjogZ2xvYmFsIHByZXN1Ym1pdCcsXG4gIH0sXG4gIEFDVElPTl9SRVZJRVc6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1RoZSBQUiBpcyBzdGlsbCBhd2FpdGluZyByZXZpZXdzIGZyb20gYXQgbGVhc3Qgb25lIHJlcXVlc3RlZCByZXZpZXdlcicsXG4gICAgbmFtZTogJ2FjdGlvbjogcmV2aWV3JyxcbiAgfSxcbn0pO1xuIl19