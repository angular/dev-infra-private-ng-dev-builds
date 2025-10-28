import { createTypedObject, Label, ManagedRepositories } from './base.js';
class ManagedLabel extends Label {
    constructor() {
        super(...arguments);
        this.commitCheck = this.params.commitCheck;
    }
}
export const managedLabels = createTypedObject(ManagedLabel)({
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
    DETECTED_PERF_CHANGE: {
        description: 'Issues related to performance',
        name: 'area: performance',
        commitCheck: (c) => c.type === 'perf',
    },
    DETECTED_HTTP_CHANGE: {
        description: 'Issues related to HTTP and HTTP Client',
        name: 'area: common/http',
        commitCheck: (c) => c.scope === 'common/http' || c.scope === 'http',
        repositories: [ManagedRepositories.ANGULAR],
    },
    DETECTED_COMPILER_CHANGE: {
        description: "Issues related to `ngc`, Angular's template compiler",
        name: 'area: compiler',
        commitCheck: (c) => c.scope === 'compiler' || c.scope === 'compiler-cli',
        repositories: [ManagedRepositories.ANGULAR],
    },
    DETECTED_PLATFORM_BROWSER_CHANGE: {
        description: 'Issues related to the framework runtime',
        name: 'area: core',
        commitCheck: (c) => c.scope === 'platform-browser' ||
            c.scope === 'core' ||
            c.scope === 'platform-browser-dynamic',
        repositories: [ManagedRepositories.ANGULAR],
    },
    DETECTED_PLATFORM_SERVER_CHANGE: {
        description: 'Issues related to server-side rendering',
        name: 'area: server',
        commitCheck: (c) => c.scope === 'platform-server',
        repositories: [ManagedRepositories.ANGULAR],
    },
    DETECTED_ZONES_CHANGE: {
        description: 'Issues related to zone.js',
        name: 'area: zones',
        commitCheck: (c) => c.scope === 'zone.js',
        repositories: [ManagedRepositories.ANGULAR],
    },
    DETECTED_LOCALIZE_CHANGE: {
        description: 'Issues related to localization and internationalization',
        name: 'area: i18n',
        commitCheck: (c) => c.scope === 'localize',
        repositories: [ManagedRepositories.ANGULAR],
    },
});
//# sourceMappingURL=managed.js.map