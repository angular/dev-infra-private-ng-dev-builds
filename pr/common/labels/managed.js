import { createTypedObject } from './base.js';
export const managedLabels = createTypedObject()({
    DETECTED_BREAKING_CHANGE: {
        description: 'PR contains a commit with a breaking change',
        name: 'detected: breaking change',
        commitCheck: (c) => c.breakingChanges.length !== 0,
    },
    DETECTED_DEPRECATION: {
        description: 'PR contains a commit with a deprecation',
        name: 'detected: deprecation',
        commitCheck: (c) => c.deprecations.length !== 0,
    },
    DETECTED_FEATURE: {
        description: 'PR contains a feature commit',
        name: 'detected: feature',
        commitCheck: (c) => c.type === 'feat',
    },
    DETECTED_DOCS_CHANGE: {
        description: 'Related to the documentation',
        name: 'area: docs',
        commitCheck: (c) => c.type === 'docs',
    },
    DETECTED_INFRA_CHANGE: {
        description: 'Related the build and CI infrastructure of the project',
        name: 'area: build & ci',
        commitCheck: (c) => c.type === 'build' || c.type === 'ci',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9jb21tb24vbGFiZWxzL21hbmFnZWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFDLGlCQUFpQixFQUFRLE1BQU0sV0FBVyxDQUFDO0FBT25ELE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxpQkFBaUIsRUFBZ0IsQ0FBQztJQUM3RCx3QkFBd0IsRUFBRTtRQUN4QixXQUFXLEVBQUUsNkNBQTZDO1FBQzFELElBQUksRUFBRSwyQkFBMkI7UUFDakMsV0FBVyxFQUFFLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLE1BQU0sS0FBSyxDQUFDO0tBQzNEO0lBQ0Qsb0JBQW9CLEVBQUU7UUFDcEIsV0FBVyxFQUFFLHlDQUF5QztRQUN0RCxJQUFJLEVBQUUsdUJBQXVCO1FBQzdCLFdBQVcsRUFBRSxDQUFDLENBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQztLQUN4RDtJQUNELGdCQUFnQixFQUFFO1FBQ2hCLFdBQVcsRUFBRSw4QkFBOEI7UUFDM0MsSUFBSSxFQUFFLG1CQUFtQjtRQUN6QixXQUFXLEVBQUUsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssTUFBTTtLQUM5QztJQUNELG9CQUFvQixFQUFFO1FBQ3BCLFdBQVcsRUFBRSw4QkFBOEI7UUFDM0MsSUFBSSxFQUFFLFlBQVk7UUFDbEIsV0FBVyxFQUFFLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLE1BQU07S0FDOUM7SUFDRCxxQkFBcUIsRUFBRTtRQUNyQixXQUFXLEVBQUUsd0RBQXdEO1FBQ3JFLElBQUksRUFBRSxrQkFBa0I7UUFDeEIsV0FBVyxFQUFFLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLE9BQU8sSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUk7S0FDbEU7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0NvbW1pdH0gZnJvbSAnLi4vLi4vLi4vY29tbWl0LW1lc3NhZ2UvcGFyc2UuanMnO1xuaW1wb3J0IHtjcmVhdGVUeXBlZE9iamVjdCwgTGFiZWx9IGZyb20gJy4vYmFzZS5qcyc7XG5cbmludGVyZmFjZSBNYW5hZ2VkTGFiZWwgZXh0ZW5kcyBMYWJlbCB7XG4gIC8qKiBBIG1hdGNoaW5nIGZ1bmN0aW9uLCBpZiB0aGUgbGFiZWwgaXMgYXV0b21hdGljYWxseSBhcHBsaWVkIGJ5IG91ciBnaXRodWIgYWN0aW9uLCBvdGhlcndpc2UgZmFsc2UuICovXG4gIGNvbW1pdENoZWNrOiAoKGM6IENvbW1pdCkgPT4gYm9vbGVhbikgfCBmYWxzZTtcbn1cblxuZXhwb3J0IGNvbnN0IG1hbmFnZWRMYWJlbHMgPSBjcmVhdGVUeXBlZE9iamVjdDxNYW5hZ2VkTGFiZWw+KCkoe1xuICBERVRFQ1RFRF9CUkVBS0lOR19DSEFOR0U6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1BSIGNvbnRhaW5zIGEgY29tbWl0IHdpdGggYSBicmVha2luZyBjaGFuZ2UnLFxuICAgIG5hbWU6ICdkZXRlY3RlZDogYnJlYWtpbmcgY2hhbmdlJyxcbiAgICBjb21taXRDaGVjazogKGM6IENvbW1pdCkgPT4gYy5icmVha2luZ0NoYW5nZXMubGVuZ3RoICE9PSAwLFxuICB9LFxuICBERVRFQ1RFRF9ERVBSRUNBVElPTjoge1xuICAgIGRlc2NyaXB0aW9uOiAnUFIgY29udGFpbnMgYSBjb21taXQgd2l0aCBhIGRlcHJlY2F0aW9uJyxcbiAgICBuYW1lOiAnZGV0ZWN0ZWQ6IGRlcHJlY2F0aW9uJyxcbiAgICBjb21taXRDaGVjazogKGM6IENvbW1pdCkgPT4gYy5kZXByZWNhdGlvbnMubGVuZ3RoICE9PSAwLFxuICB9LFxuICBERVRFQ1RFRF9GRUFUVVJFOiB7XG4gICAgZGVzY3JpcHRpb246ICdQUiBjb250YWlucyBhIGZlYXR1cmUgY29tbWl0JyxcbiAgICBuYW1lOiAnZGV0ZWN0ZWQ6IGZlYXR1cmUnLFxuICAgIGNvbW1pdENoZWNrOiAoYzogQ29tbWl0KSA9PiBjLnR5cGUgPT09ICdmZWF0JyxcbiAgfSxcbiAgREVURUNURURfRE9DU19DSEFOR0U6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1JlbGF0ZWQgdG8gdGhlIGRvY3VtZW50YXRpb24nLFxuICAgIG5hbWU6ICdhcmVhOiBkb2NzJyxcbiAgICBjb21taXRDaGVjazogKGM6IENvbW1pdCkgPT4gYy50eXBlID09PSAnZG9jcycsXG4gIH0sXG4gIERFVEVDVEVEX0lORlJBX0NIQU5HRToge1xuICAgIGRlc2NyaXB0aW9uOiAnUmVsYXRlZCB0aGUgYnVpbGQgYW5kIENJIGluZnJhc3RydWN0dXJlIG9mIHRoZSBwcm9qZWN0JyxcbiAgICBuYW1lOiAnYXJlYTogYnVpbGQgJiBjaScsXG4gICAgY29tbWl0Q2hlY2s6IChjOiBDb21taXQpID0+IGMudHlwZSA9PT0gJ2J1aWxkJyB8fCBjLnR5cGUgPT09ICdjaScsXG4gIH0sXG59KTtcbiJdfQ==