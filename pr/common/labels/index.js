import { managedLabels } from './managed.js';
import { actionLabels } from './action.js';
import { mergeLabels } from './merge.js';
import { targetLabels } from './target.js';
import { priorityLabels } from './priority.js';
import { featureLabels } from './feature.js';
import { requiresLabels } from './requires.js';
import { Label } from './base.js';
export const allLabels = {
    ...managedLabels,
    ...actionLabels,
    ...mergeLabels,
    ...targetLabels,
    ...priorityLabels,
    ...featureLabels,
    ...requiresLabels,
};
const _typeCheckEnforceAllLabels = allLabels;
export { managedLabels, actionLabels, mergeLabels, targetLabels, priorityLabels, requiresLabels };
export { Label };
//# sourceMappingURL=index.js.map