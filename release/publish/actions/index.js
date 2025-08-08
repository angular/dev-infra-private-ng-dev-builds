import { ConfigureNextAsMajorAction } from './configure-next-as-major.js';
import { CutLongTermSupportPatchAction } from './cut-lts-patch.js';
import { CutNewPatchAction } from './cut-new-patch.js';
import { CutNpmNextPrereleaseAction } from './cut-npm-next-prerelease.js';
import { CutNpmNextReleaseCandidateAction } from './cut-npm-next-release-candidate.js';
import { CutStableAction } from './cut-stable.js';
import { CutExceptionalMinorPrereleaseAction } from './exceptional-minor/cut-exceptional-minor-prerelease.js';
import { CutExceptionalMinorReleaseCandidateAction } from './exceptional-minor/cut-exceptional-minor-release-candidate.js';
import { PrepareExceptionalMinorAction } from './exceptional-minor/prepare-exceptional-minor.js';
import { MoveNextIntoFeatureFreezeAction } from './move-next-into-feature-freeze.js';
import { MoveNextIntoReleaseCandidateAction } from './move-next-into-release-candidate.js';
import { SpecialCutLongTermSupportMinorAction } from './special/cut-lts-minor.js';
import { TagRecentMajorAsLatest } from './tag-recent-major-as-latest.js';
export const actions = [
    CutExceptionalMinorReleaseCandidateAction,
    CutExceptionalMinorPrereleaseAction,
    TagRecentMajorAsLatest,
    CutStableAction,
    CutNpmNextReleaseCandidateAction,
    CutNewPatchAction,
    CutNpmNextPrereleaseAction,
    MoveNextIntoFeatureFreezeAction,
    MoveNextIntoReleaseCandidateAction,
    ConfigureNextAsMajorAction,
    PrepareExceptionalMinorAction,
    CutLongTermSupportPatchAction,
    SpecialCutLongTermSupportMinorAction,
];
//# sourceMappingURL=index.js.map