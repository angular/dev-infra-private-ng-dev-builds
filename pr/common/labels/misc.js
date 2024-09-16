import { createTypedObject, Label } from './base.js';
class MiscLabel extends Label {
}
export const miscLabels = createTypedObject(MiscLabel)({
    FEATURE: {
        name: 'feature',
        description: 'Label used to distinguish feature request from other issues',
    },
    GOOD_FIRST_ISSUE: {
        name: 'good first issue',
        description: 'Label noting a good first issue to be worked on by a community member',
    },
    HELP_WANTED: {
        name: 'help wanted',
        description: 'Label noting an issue which the team is looking for contribution from the community to fix',
    },
    RENOVATE_MANAGED: {
        name: 'renovate managed',
        description: 'Label noting that a pull request will automatically be managed and rebased by renovate',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlzYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9jb21tb24vbGFiZWxzL21pc2MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLGlCQUFpQixFQUFFLEtBQUssRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUVuRCxNQUFNLFNBQVUsU0FBUSxLQUFLO0NBQUc7QUFFaEMsTUFBTSxDQUFDLE1BQU0sVUFBVSxHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELE9BQU8sRUFBRTtRQUNQLElBQUksRUFBRSxTQUFTO1FBQ2YsV0FBVyxFQUFFLDZEQUE2RDtLQUMzRTtJQUNELGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxrQkFBa0I7UUFDeEIsV0FBVyxFQUFFLHVFQUF1RTtLQUNyRjtJQUNELFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxhQUFhO1FBQ25CLFdBQVcsRUFDVCw0RkFBNEY7S0FDL0Y7SUFDRCxnQkFBZ0IsRUFBRTtRQUNoQixJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLFdBQVcsRUFDVCx3RkFBd0Y7S0FDM0Y7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2NyZWF0ZVR5cGVkT2JqZWN0LCBMYWJlbH0gZnJvbSAnLi9iYXNlLmpzJztcblxuY2xhc3MgTWlzY0xhYmVsIGV4dGVuZHMgTGFiZWwge31cblxuZXhwb3J0IGNvbnN0IG1pc2NMYWJlbHMgPSBjcmVhdGVUeXBlZE9iamVjdChNaXNjTGFiZWwpKHtcbiAgRkVBVFVSRToge1xuICAgIG5hbWU6ICdmZWF0dXJlJyxcbiAgICBkZXNjcmlwdGlvbjogJ0xhYmVsIHVzZWQgdG8gZGlzdGluZ3Vpc2ggZmVhdHVyZSByZXF1ZXN0IGZyb20gb3RoZXIgaXNzdWVzJyxcbiAgfSxcbiAgR09PRF9GSVJTVF9JU1NVRToge1xuICAgIG5hbWU6ICdnb29kIGZpcnN0IGlzc3VlJyxcbiAgICBkZXNjcmlwdGlvbjogJ0xhYmVsIG5vdGluZyBhIGdvb2QgZmlyc3QgaXNzdWUgdG8gYmUgd29ya2VkIG9uIGJ5IGEgY29tbXVuaXR5IG1lbWJlcicsXG4gIH0sXG4gIEhFTFBfV0FOVEVEOiB7XG4gICAgbmFtZTogJ2hlbHAgd2FudGVkJyxcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdMYWJlbCBub3RpbmcgYW4gaXNzdWUgd2hpY2ggdGhlIHRlYW0gaXMgbG9va2luZyBmb3IgY29udHJpYnV0aW9uIGZyb20gdGhlIGNvbW11bml0eSB0byBmaXgnLFxuICB9LFxuICBSRU5PVkFURV9NQU5BR0VEOiB7XG4gICAgbmFtZTogJ3Jlbm92YXRlIG1hbmFnZWQnLFxuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0xhYmVsIG5vdGluZyB0aGF0IGEgcHVsbCByZXF1ZXN0IHdpbGwgYXV0b21hdGljYWxseSBiZSBtYW5hZ2VkIGFuZCByZWJhc2VkIGJ5IHJlbm92YXRlJyxcbiAgfSxcbn0pO1xuIl19