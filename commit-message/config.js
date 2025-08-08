import { ConfigValidationError } from '../utils/config.js';
export function assertValidCommitMessageConfig(config) {
    if (config.commitMessage === undefined) {
        throw new ConfigValidationError(`No configuration defined for "commitMessage"`);
    }
}
export var ScopeRequirement;
(function (ScopeRequirement) {
    ScopeRequirement[ScopeRequirement["Required"] = 0] = "Required";
    ScopeRequirement[ScopeRequirement["Optional"] = 1] = "Optional";
    ScopeRequirement[ScopeRequirement["Forbidden"] = 2] = "Forbidden";
})(ScopeRequirement || (ScopeRequirement = {}));
export var ReleaseNotesLevel;
(function (ReleaseNotesLevel) {
    ReleaseNotesLevel[ReleaseNotesLevel["Hidden"] = 0] = "Hidden";
    ReleaseNotesLevel[ReleaseNotesLevel["Visible"] = 1] = "Visible";
})(ReleaseNotesLevel || (ReleaseNotesLevel = {}));
export const COMMIT_TYPES = {
    build: {
        name: 'build',
        description: 'Changes to local repository build system and tooling',
        scope: ScopeRequirement.Optional,
        releaseNotesLevel: ReleaseNotesLevel.Hidden,
    },
    ci: {
        name: 'ci',
        description: 'Changes to CI configuration and CI specific tooling',
        scope: ScopeRequirement.Forbidden,
        releaseNotesLevel: ReleaseNotesLevel.Hidden,
    },
    docs: {
        name: 'docs',
        description: 'Changes which exclusively affects documentation.',
        scope: ScopeRequirement.Optional,
        releaseNotesLevel: ReleaseNotesLevel.Hidden,
    },
    feat: {
        name: 'feat',
        description: 'Creates a new feature',
        scope: ScopeRequirement.Required,
        releaseNotesLevel: ReleaseNotesLevel.Visible,
    },
    fix: {
        name: 'fix',
        description: 'Fixes a previously discovered failure/bug',
        scope: ScopeRequirement.Required,
        releaseNotesLevel: ReleaseNotesLevel.Visible,
    },
    perf: {
        name: 'perf',
        description: 'Improves performance without any change in functionality or API',
        scope: ScopeRequirement.Required,
        releaseNotesLevel: ReleaseNotesLevel.Visible,
    },
    refactor: {
        name: 'refactor',
        description: 'Refactor without any change in functionality or API (includes style changes)',
        scope: ScopeRequirement.Optional,
        releaseNotesLevel: ReleaseNotesLevel.Hidden,
    },
    release: {
        name: 'release',
        description: 'A release point in the repository',
        scope: ScopeRequirement.Forbidden,
        releaseNotesLevel: ReleaseNotesLevel.Hidden,
    },
    test: {
        name: 'test',
        description: "Improvements or corrections made to the project's test suite",
        scope: ScopeRequirement.Optional,
        releaseNotesLevel: ReleaseNotesLevel.Hidden,
    },
};
//# sourceMappingURL=config.js.map