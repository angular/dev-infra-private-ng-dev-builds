import { createTypedObject, Label } from './base.js';
class PriorityLabel extends Label {
}
export const priorityLabels = createTypedObject(PriorityLabel)({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJpb3JpdHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY29tbW9uL2xhYmVscy9wcmlvcml0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsS0FBSyxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBRW5ELE1BQU0sYUFBYyxTQUFRLEtBQUs7Q0FBRztBQUVwQyxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsaUJBQWlCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDN0QsRUFBRSxFQUFFO1FBQ0YsSUFBSSxFQUFFLElBQUk7UUFDVixXQUFXLEVBQ1Qsb0dBQW9HO0tBQ3ZHO0lBQ0QsRUFBRSxFQUFFO1FBQ0YsSUFBSSxFQUFFLElBQUk7UUFDVixXQUFXLEVBQ1QsNkZBQTZGO0tBQ2hHO0lBQ0QsRUFBRSxFQUFFO1FBQ0YsSUFBSSxFQUFFLElBQUk7UUFDVixXQUFXLEVBQUUsMEVBQTBFO0tBQ3hGO0lBQ0QsRUFBRSxFQUFFO1FBQ0YsSUFBSSxFQUFFLElBQUk7UUFDVixXQUFXLEVBQ1Qsc0dBQXNHO0tBQ3pHO0lBQ0QsRUFBRSxFQUFFO1FBQ0YsSUFBSSxFQUFFLElBQUk7UUFDVixXQUFXLEVBQUUsaUVBQWlFO0tBQy9FO0lBQ0QsRUFBRSxFQUFFO1FBQ0YsSUFBSSxFQUFFLElBQUk7UUFDVixXQUFXLEVBQ1QsbUdBQW1HO0tBQ3RHO0NBQ0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtjcmVhdGVUeXBlZE9iamVjdCwgTGFiZWx9IGZyb20gJy4vYmFzZS5qcyc7XG5cbmNsYXNzIFByaW9yaXR5TGFiZWwgZXh0ZW5kcyBMYWJlbCB7fVxuXG5leHBvcnQgY29uc3QgcHJpb3JpdHlMYWJlbHMgPSBjcmVhdGVUeXBlZE9iamVjdChQcmlvcml0eUxhYmVsKSh7XG4gIFAwOiB7XG4gICAgbmFtZTogJ1AwJyxcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdJc3N1ZSB0aGF0IGNhdXNlcyBhbiBvdXRhZ2UsIGJyZWFrYWdlLCBvciBtYWpvciBmdW5jdGlvbiB0byBiZSB1bnVzYWJsZSwgd2l0aCBubyBrbm93biB3b3JrYXJvdW5kcycsXG4gIH0sXG4gIFAxOiB7XG4gICAgbmFtZTogJ1AxJyxcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdJbXBhY3RzIGEgbGFyZ2UgcGVyY2VudGFnZSBvZiB1c2VyczsgaWYgYSB3b3JrYXJvdW5kIGV4aXN0cyBpdCBpcyBwYXJ0aWFsIG9yIG92ZXJseSBwYWluZnVsJyxcbiAgfSxcbiAgUDI6IHtcbiAgICBuYW1lOiAnUDInLFxuICAgIGRlc2NyaXB0aW9uOiAnVGhlIGlzc3VlIGlzIGltcG9ydGFudCB0byBhIGxhcmdlIHBlcmNlbnRhZ2Ugb2YgdXNlcnMsIHdpdGggYSB3b3JrYXJvdW5kJyxcbiAgfSxcbiAgUDM6IHtcbiAgICBuYW1lOiAnUDMnLFxuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0FuIGlzc3VlIHRoYXQgaXMgcmVsZXZhbnQgdG8gY29yZSBmdW5jdGlvbnMsIGJ1dCBkb2VzIG5vdCBpbXBlZGUgcHJvZ3Jlc3MuIEltcG9ydGFudCwgYnV0IG5vdCB1cmdlbnQnLFxuICB9LFxuICBQNDoge1xuICAgIG5hbWU6ICdQNCcsXG4gICAgZGVzY3JpcHRpb246ICdBIHJlbGF0aXZlbHkgbWlub3IgaXNzdWUgdGhhdCBpcyBub3QgcmVsZXZhbnQgdG8gY29yZSBmdW5jdGlvbnMnLFxuICB9LFxuICBQNToge1xuICAgIG5hbWU6ICdQNScsXG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIHRlYW0gYWNrbm93bGVkZ2VzIHRoZSByZXF1ZXN0IGJ1dCBkb2VzIG5vdCBwbGFuIHRvIGFkZHJlc3MgaXQsIGl0IHJlbWFpbnMgb3BlbiBmb3IgZGlzY3Vzc2lvbicsXG4gIH0sXG59KTtcbiJdfQ==