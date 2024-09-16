import { createTypedObject, Label } from './base.js';
class MergeLabel extends Label {
}
export const mergeLabels = createTypedObject(MergeLabel)({
    MERGE_PRESERVE_COMMITS: {
        description: 'When the PR is merged, a rebase and merge should be performed',
        name: 'merge: preserve commits',
    },
    MERGE_SQUASH_COMMITS: {
        description: 'When the PR is merged, a squash and merge should be performed',
        name: 'merge: squash commits',
    },
    MERGE_FIX_COMMIT_MESSAGE: {
        description: 'When the PR is merged, rewrites/fixups of the commit messages are needed',
        name: 'merge: fix commit message',
    },
    MERGE_CARETAKER_NOTE: {
        description: 'Alert the caretaker performing the merge to check the PR for an out of normal action needed or note',
        name: 'merge: caretaker note',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY29tbW9uL2xhYmVscy9tZXJnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsS0FBSyxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBRW5ELE1BQU0sVUFBVyxTQUFRLEtBQUs7Q0FBRztBQUVqQyxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDdkQsc0JBQXNCLEVBQUU7UUFDdEIsV0FBVyxFQUFFLCtEQUErRDtRQUM1RSxJQUFJLEVBQUUseUJBQXlCO0tBQ2hDO0lBQ0Qsb0JBQW9CLEVBQUU7UUFDcEIsV0FBVyxFQUFFLCtEQUErRDtRQUM1RSxJQUFJLEVBQUUsdUJBQXVCO0tBQzlCO0lBQ0Qsd0JBQXdCLEVBQUU7UUFDeEIsV0FBVyxFQUFFLDBFQUEwRTtRQUN2RixJQUFJLEVBQUUsMkJBQTJCO0tBQ2xDO0lBQ0Qsb0JBQW9CLEVBQUU7UUFDcEIsV0FBVyxFQUNULHFHQUFxRztRQUN2RyxJQUFJLEVBQUUsdUJBQXVCO0tBQzlCO0NBQ0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtjcmVhdGVUeXBlZE9iamVjdCwgTGFiZWx9IGZyb20gJy4vYmFzZS5qcyc7XG5cbmNsYXNzIE1lcmdlTGFiZWwgZXh0ZW5kcyBMYWJlbCB7fVxuXG5leHBvcnQgY29uc3QgbWVyZ2VMYWJlbHMgPSBjcmVhdGVUeXBlZE9iamVjdChNZXJnZUxhYmVsKSh7XG4gIE1FUkdFX1BSRVNFUlZFX0NPTU1JVFM6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1doZW4gdGhlIFBSIGlzIG1lcmdlZCwgYSByZWJhc2UgYW5kIG1lcmdlIHNob3VsZCBiZSBwZXJmb3JtZWQnLFxuICAgIG5hbWU6ICdtZXJnZTogcHJlc2VydmUgY29tbWl0cycsXG4gIH0sXG4gIE1FUkdFX1NRVUFTSF9DT01NSVRTOiB7XG4gICAgZGVzY3JpcHRpb246ICdXaGVuIHRoZSBQUiBpcyBtZXJnZWQsIGEgc3F1YXNoIGFuZCBtZXJnZSBzaG91bGQgYmUgcGVyZm9ybWVkJyxcbiAgICBuYW1lOiAnbWVyZ2U6IHNxdWFzaCBjb21taXRzJyxcbiAgfSxcbiAgTUVSR0VfRklYX0NPTU1JVF9NRVNTQUdFOiB7XG4gICAgZGVzY3JpcHRpb246ICdXaGVuIHRoZSBQUiBpcyBtZXJnZWQsIHJld3JpdGVzL2ZpeHVwcyBvZiB0aGUgY29tbWl0IG1lc3NhZ2VzIGFyZSBuZWVkZWQnLFxuICAgIG5hbWU6ICdtZXJnZTogZml4IGNvbW1pdCBtZXNzYWdlJyxcbiAgfSxcbiAgTUVSR0VfQ0FSRVRBS0VSX05PVEU6IHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdBbGVydCB0aGUgY2FyZXRha2VyIHBlcmZvcm1pbmcgdGhlIG1lcmdlIHRvIGNoZWNrIHRoZSBQUiBmb3IgYW4gb3V0IG9mIG5vcm1hbCBhY3Rpb24gbmVlZGVkIG9yIG5vdGUnLFxuICAgIG5hbWU6ICdtZXJnZTogY2FyZXRha2VyIG5vdGUnLFxuICB9LFxufSk7XG4iXX0=