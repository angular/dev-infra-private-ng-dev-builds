import { createTypedObject, Label } from './base.js';
export class TargetLabel extends Label {
    constructor() {
        super(...arguments);
        this.__hasTargetLabelMarker__ = true;
    }
}
export const targetLabels = createTypedObject(TargetLabel)({
    TARGET_AUTOMATION: {
        description: 'This PR is targeted to only merge into the branch defined in Github [bot use only]',
        name: 'target: automation',
    },
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
//# sourceMappingURL=target.js.map