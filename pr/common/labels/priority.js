import { createTypedObject } from './base.js';
export const priorityLabels = createTypedObject()({
    P0: {
        name: 'P0',
        description: 'Issue that causes an outage, breakage, or major function to be unusable, with no known workarounds',
    },
    P1: {
        name: 'P1',
        description: 'Impacts a large percentage of users; if a workaround exists it is partial or overly painful',
    },
    P2: {
        name: 'P2',
        description: 'The issue is important to a large percentage of users, with a workaround',
    },
    P3: {
        name: 'P3',
        description: 'An issue that is relevant to core functions, but does not impede progress. Important, but not urgent',
    },
    P4: {
        name: 'P4',
        description: 'A relatively minor issue that is not relevant to core functions',
    },
    P5: {
        name: 'P5',
        description: 'The team acknowledges the request but does not plan to address it, it remains open for discussion',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJpb3JpdHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY29tbW9uL2xhYmVscy9wcmlvcml0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsaUJBQWlCLEVBQVEsTUFBTSxXQUFXLENBQUM7QUFJbkQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLGlCQUFpQixFQUFpQixDQUFDO0lBQy9ELEVBQUUsRUFBRTtRQUNGLElBQUksRUFBRSxJQUFJO1FBQ1YsV0FBVyxFQUNULG9HQUFvRztLQUN2RztJQUNELEVBQUUsRUFBRTtRQUNGLElBQUksRUFBRSxJQUFJO1FBQ1YsV0FBVyxFQUNULDZGQUE2RjtLQUNoRztJQUNELEVBQUUsRUFBRTtRQUNGLElBQUksRUFBRSxJQUFJO1FBQ1YsV0FBVyxFQUFFLDBFQUEwRTtLQUN4RjtJQUNELEVBQUUsRUFBRTtRQUNGLElBQUksRUFBRSxJQUFJO1FBQ1YsV0FBVyxFQUNULHNHQUFzRztLQUN6RztJQUNELEVBQUUsRUFBRTtRQUNGLElBQUksRUFBRSxJQUFJO1FBQ1YsV0FBVyxFQUFFLGlFQUFpRTtLQUMvRTtJQUNELEVBQUUsRUFBRTtRQUNGLElBQUksRUFBRSxJQUFJO1FBQ1YsV0FBVyxFQUNULG1HQUFtRztLQUN0RztDQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7Y3JlYXRlVHlwZWRPYmplY3QsIExhYmVsfSBmcm9tICcuL2Jhc2UuanMnO1xuXG5pbnRlcmZhY2UgUHJpb3JpdHlMYWJlbCBleHRlbmRzIExhYmVsIHt9XG5cbmV4cG9ydCBjb25zdCBwcmlvcml0eUxhYmVscyA9IGNyZWF0ZVR5cGVkT2JqZWN0PFByaW9yaXR5TGFiZWw+KCkoe1xuICBQMDoge1xuICAgIG5hbWU6ICdQMCcsXG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnSXNzdWUgdGhhdCBjYXVzZXMgYW4gb3V0YWdlLCBicmVha2FnZSwgb3IgbWFqb3IgZnVuY3Rpb24gdG8gYmUgdW51c2FibGUsIHdpdGggbm8ga25vd24gd29ya2Fyb3VuZHMnLFxuICB9LFxuICBQMToge1xuICAgIG5hbWU6ICdQMScsXG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnSW1wYWN0cyBhIGxhcmdlIHBlcmNlbnRhZ2Ugb2YgdXNlcnM7IGlmIGEgd29ya2Fyb3VuZCBleGlzdHMgaXQgaXMgcGFydGlhbCBvciBvdmVybHkgcGFpbmZ1bCcsXG4gIH0sXG4gIFAyOiB7XG4gICAgbmFtZTogJ1AyJyxcbiAgICBkZXNjcmlwdGlvbjogJ1RoZSBpc3N1ZSBpcyBpbXBvcnRhbnQgdG8gYSBsYXJnZSBwZXJjZW50YWdlIG9mIHVzZXJzLCB3aXRoIGEgd29ya2Fyb3VuZCcsXG4gIH0sXG4gIFAzOiB7XG4gICAgbmFtZTogJ1AzJyxcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdBbiBpc3N1ZSB0aGF0IGlzIHJlbGV2YW50IHRvIGNvcmUgZnVuY3Rpb25zLCBidXQgZG9lcyBub3QgaW1wZWRlIHByb2dyZXNzLiBJbXBvcnRhbnQsIGJ1dCBub3QgdXJnZW50JyxcbiAgfSxcbiAgUDQ6IHtcbiAgICBuYW1lOiAnUDQnLFxuICAgIGRlc2NyaXB0aW9uOiAnQSByZWxhdGl2ZWx5IG1pbm9yIGlzc3VlIHRoYXQgaXMgbm90IHJlbGV2YW50IHRvIGNvcmUgZnVuY3Rpb25zJyxcbiAgfSxcbiAgUDU6IHtcbiAgICBuYW1lOiAnUDUnLFxuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1RoZSB0ZWFtIGFja25vd2xlZGdlcyB0aGUgcmVxdWVzdCBidXQgZG9lcyBub3QgcGxhbiB0byBhZGRyZXNzIGl0LCBpdCByZW1haW5zIG9wZW4gZm9yIGRpc2N1c3Npb24nLFxuICB9LFxufSk7XG4iXX0=