/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Log, red } from '../../../utils/logging.js';
import { mergeLabels } from '../labels/index.js';
import { targetLabels } from '../labels/target.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
/** Assert the commits provided are allowed to merge to the provided target label. */
// TODO: update typings to make sure portability is properly handled for windows build.
export const changesAllowForTargetLabelValidation = createPullRequestValidation({ name: 'assertChangesAllowForTargetLabel', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    assert(commits, targetLabel, config, releaseTrains, labelsOnPullRequest) {
        if (labelsOnPullRequest.includes(mergeLabels.MERGE_FIX_COMMIT_MESSAGE.name)) {
            Log.debug('Skipping commit message target label validation because the commit message fixup label is ' +
                'applied.');
            return;
        }
        // List of commit scopes which are exempted from target label content requirements. i.e. no `feat`
        // scopes in patch branches, no breaking changes in minor or patch changes.
        const exemptedScopes = config.targetLabelExemptScopes || [];
        // List of commits which are subject to content requirements for the target label.
        commits = commits.filter((commit) => !exemptedScopes.includes(commit.scope));
        const hasBreakingChanges = commits.some((commit) => commit.breakingChanges.length !== 0);
        const hasDeprecations = commits.some((commit) => commit.deprecations.length !== 0);
        const hasFeatureCommits = commits.some((commit) => commit.type === 'feat');
        switch (targetLabel) {
            case targetLabels.TARGET_MAJOR:
                break;
            case targetLabels.TARGET_MINOR:
                if (hasBreakingChanges) {
                    throw this._createHasBreakingChangesError(targetLabel);
                }
                break;
            case targetLabels.TARGET_RC:
            case targetLabels.TARGET_LTS:
            case targetLabels.TARGET_PATCH:
                if (hasBreakingChanges) {
                    throw this._createHasBreakingChangesError(targetLabel);
                }
                if (hasFeatureCommits) {
                    throw this._createHasFeatureCommitsError(targetLabel);
                }
                // Deprecations should not be merged into RC, patch or LTS branches.
                // https://semver.org/#spec-item-7. Deprecations should be part of
                // minor releases, or major releases according to SemVer.
                if (hasDeprecations && !releaseTrains.isFeatureFreeze()) {
                    throw this._createHasDeprecationsError(targetLabel);
                }
                break;
            default:
                Log.warn(red('WARNING: Unable to confirm all commits in the pull request are'));
                Log.warn(red(`eligible to be merged into the target branches for: ${targetLabel.name}`));
                break;
        }
    }
    _createHasBreakingChangesError(label) {
        const message = `Cannot merge into branch for "${label.name}" as the pull request has ` +
            `breaking changes. Breaking changes can only be merged with the "target: major" label.`;
        return this._createError(message);
    }
    _createHasDeprecationsError(label) {
        const message = `Cannot merge into branch for "${label.name}" as the pull request ` +
            `contains deprecations. Deprecations can only be merged with the "target: minor" or ` +
            `"target: major" label.`;
        return this._createError(message);
    }
    _createHasFeatureCommitsError(label) {
        const message = `Cannot merge into branch for "${label.name}" as the pull request has ` +
            'commits with the "feat" type. New features can only be merged with the "target: minor" ' +
            'or "target: major" label.';
        return this._createError(message);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0LWFsbG93ZWQtdGFyZ2V0LWxhYmVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi92YWxpZGF0aW9uL2Fzc2VydC1hbGxvd2VkLXRhcmdldC1sYWJlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEVBQUMsR0FBRyxFQUFFLEdBQUcsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRW5ELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMvQyxPQUFPLEVBQWMsWUFBWSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDOUQsT0FBTyxFQUFDLDJCQUEyQixFQUFFLHFCQUFxQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFMUYscUZBQXFGO0FBQ3JGLHVGQUF1RjtBQUN2RixNQUFNLENBQUMsTUFBTSxvQ0FBb0MsR0FBRywyQkFBMkIsQ0FDN0UsRUFBQyxJQUFJLEVBQUUsa0NBQWtDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFDLEVBQ25FLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FDakIsQ0FBQztBQUVGLE1BQU0sVUFBVyxTQUFRLHFCQUFxQjtJQUM1QyxNQUFNLENBQ0osT0FBaUIsRUFDakIsV0FBd0IsRUFDeEIsTUFBeUIsRUFDekIsYUFBa0MsRUFDbEMsbUJBQTZCO1FBRTdCLElBQUksbUJBQW1CLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzVFLEdBQUcsQ0FBQyxLQUFLLENBQ1AsNEZBQTRGO2dCQUMxRixVQUFVLENBQ2IsQ0FBQztZQUNGLE9BQU87UUFDVCxDQUFDO1FBRUQsa0dBQWtHO1FBQ2xHLDJFQUEyRTtRQUMzRSxNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsdUJBQXVCLElBQUksRUFBRSxDQUFDO1FBQzVELGtGQUFrRjtRQUNsRixPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzdFLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDekYsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDbkYsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDO1FBQzNFLFFBQVEsV0FBVyxFQUFFLENBQUM7WUFDcEIsS0FBSyxZQUFZLENBQUMsWUFBWTtnQkFDNUIsTUFBTTtZQUNSLEtBQUssWUFBWSxDQUFDLFlBQVk7Z0JBQzVCLElBQUksa0JBQWtCLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxJQUFJLENBQUMsOEJBQThCLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3pELENBQUM7Z0JBQ0QsTUFBTTtZQUNSLEtBQUssWUFBWSxDQUFDLFNBQVMsQ0FBQztZQUM1QixLQUFLLFlBQVksQ0FBQyxVQUFVLENBQUM7WUFDN0IsS0FBSyxZQUFZLENBQUMsWUFBWTtnQkFDNUIsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO29CQUN2QixNQUFNLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDekQsQ0FBQztnQkFDRCxJQUFJLGlCQUFpQixFQUFFLENBQUM7b0JBQ3RCLE1BQU0sSUFBSSxDQUFDLDZCQUE2QixDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO2dCQUNELG9FQUFvRTtnQkFDcEUsa0VBQWtFO2dCQUNsRSx5REFBeUQ7Z0JBQ3pELElBQUksZUFBZSxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUM7b0JBQ3hELE1BQU0sSUFBSSxDQUFDLDJCQUEyQixDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUN0RCxDQUFDO2dCQUNELE1BQU07WUFDUjtnQkFDRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hGLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHVEQUF1RCxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6RixNQUFNO1FBQ1YsQ0FBQztJQUNILENBQUM7SUFFTyw4QkFBOEIsQ0FBQyxLQUFrQjtRQUN2RCxNQUFNLE9BQU8sR0FDWCxpQ0FBaUMsS0FBSyxDQUFDLElBQUksNEJBQTRCO1lBQ3ZFLHVGQUF1RixDQUFDO1FBQzFGLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRU8sMkJBQTJCLENBQUMsS0FBa0I7UUFDcEQsTUFBTSxPQUFPLEdBQ1gsaUNBQWlDLEtBQUssQ0FBQyxJQUFJLHdCQUF3QjtZQUNuRSxxRkFBcUY7WUFDckYsd0JBQXdCLENBQUM7UUFDM0IsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFTyw2QkFBNkIsQ0FBQyxLQUFrQjtRQUN0RCxNQUFNLE9BQU8sR0FDWCxpQ0FBaUMsS0FBSyxDQUFDLElBQUksNEJBQTRCO1lBQ3ZFLHlGQUF5RjtZQUN6RiwyQkFBMkIsQ0FBQztRQUM5QixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDcEMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q29tbWl0fSBmcm9tICcuLi8uLi8uLi9jb21taXQtbWVzc2FnZS9wYXJzZS5qcyc7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uLy4uLy4uL3JlbGVhc2UvdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMuanMnO1xuaW1wb3J0IHtMb2csIHJlZH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1B1bGxSZXF1ZXN0Q29uZmlnfSBmcm9tICcuLi8uLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHttZXJnZUxhYmVsc30gZnJvbSAnLi4vbGFiZWxzL2luZGV4LmpzJztcbmltcG9ydCB7VGFyZ2V0TGFiZWwsIHRhcmdldExhYmVsc30gZnJvbSAnLi4vbGFiZWxzL3RhcmdldC5qcyc7XG5pbXBvcnQge2NyZWF0ZVB1bGxSZXF1ZXN0VmFsaWRhdGlvbiwgUHVsbFJlcXVlc3RWYWxpZGF0aW9ufSBmcm9tICcuL3ZhbGlkYXRpb24tY29uZmlnLmpzJztcblxuLyoqIEFzc2VydCB0aGUgY29tbWl0cyBwcm92aWRlZCBhcmUgYWxsb3dlZCB0byBtZXJnZSB0byB0aGUgcHJvdmlkZWQgdGFyZ2V0IGxhYmVsLiAqL1xuLy8gVE9ETzogdXBkYXRlIHR5cGluZ3MgdG8gbWFrZSBzdXJlIHBvcnRhYmlsaXR5IGlzIHByb3Blcmx5IGhhbmRsZWQgZm9yIHdpbmRvd3MgYnVpbGQuXG5leHBvcnQgY29uc3QgY2hhbmdlc0FsbG93Rm9yVGFyZ2V0TGFiZWxWYWxpZGF0aW9uID0gY3JlYXRlUHVsbFJlcXVlc3RWYWxpZGF0aW9uKFxuICB7bmFtZTogJ2Fzc2VydENoYW5nZXNBbGxvd0ZvclRhcmdldExhYmVsJywgY2FuQmVGb3JjZUlnbm9yZWQ6IHRydWV9LFxuICAoKSA9PiBWYWxpZGF0aW9uLFxuKTtcblxuY2xhc3MgVmFsaWRhdGlvbiBleHRlbmRzIFB1bGxSZXF1ZXN0VmFsaWRhdGlvbiB7XG4gIGFzc2VydChcbiAgICBjb21taXRzOiBDb21taXRbXSxcbiAgICB0YXJnZXRMYWJlbDogVGFyZ2V0TGFiZWwsXG4gICAgY29uZmlnOiBQdWxsUmVxdWVzdENvbmZpZyxcbiAgICByZWxlYXNlVHJhaW5zOiBBY3RpdmVSZWxlYXNlVHJhaW5zLFxuICAgIGxhYmVsc09uUHVsbFJlcXVlc3Q6IHN0cmluZ1tdLFxuICApIHtcbiAgICBpZiAobGFiZWxzT25QdWxsUmVxdWVzdC5pbmNsdWRlcyhtZXJnZUxhYmVscy5NRVJHRV9GSVhfQ09NTUlUX01FU1NBR0UubmFtZSkpIHtcbiAgICAgIExvZy5kZWJ1ZyhcbiAgICAgICAgJ1NraXBwaW5nIGNvbW1pdCBtZXNzYWdlIHRhcmdldCBsYWJlbCB2YWxpZGF0aW9uIGJlY2F1c2UgdGhlIGNvbW1pdCBtZXNzYWdlIGZpeHVwIGxhYmVsIGlzICcgK1xuICAgICAgICAgICdhcHBsaWVkLicsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIExpc3Qgb2YgY29tbWl0IHNjb3BlcyB3aGljaCBhcmUgZXhlbXB0ZWQgZnJvbSB0YXJnZXQgbGFiZWwgY29udGVudCByZXF1aXJlbWVudHMuIGkuZS4gbm8gYGZlYXRgXG4gICAgLy8gc2NvcGVzIGluIHBhdGNoIGJyYW5jaGVzLCBubyBicmVha2luZyBjaGFuZ2VzIGluIG1pbm9yIG9yIHBhdGNoIGNoYW5nZXMuXG4gICAgY29uc3QgZXhlbXB0ZWRTY29wZXMgPSBjb25maWcudGFyZ2V0TGFiZWxFeGVtcHRTY29wZXMgfHwgW107XG4gICAgLy8gTGlzdCBvZiBjb21taXRzIHdoaWNoIGFyZSBzdWJqZWN0IHRvIGNvbnRlbnQgcmVxdWlyZW1lbnRzIGZvciB0aGUgdGFyZ2V0IGxhYmVsLlxuICAgIGNvbW1pdHMgPSBjb21taXRzLmZpbHRlcigoY29tbWl0KSA9PiAhZXhlbXB0ZWRTY29wZXMuaW5jbHVkZXMoY29tbWl0LnNjb3BlKSk7XG4gICAgY29uc3QgaGFzQnJlYWtpbmdDaGFuZ2VzID0gY29tbWl0cy5zb21lKChjb21taXQpID0+IGNvbW1pdC5icmVha2luZ0NoYW5nZXMubGVuZ3RoICE9PSAwKTtcbiAgICBjb25zdCBoYXNEZXByZWNhdGlvbnMgPSBjb21taXRzLnNvbWUoKGNvbW1pdCkgPT4gY29tbWl0LmRlcHJlY2F0aW9ucy5sZW5ndGggIT09IDApO1xuICAgIGNvbnN0IGhhc0ZlYXR1cmVDb21taXRzID0gY29tbWl0cy5zb21lKChjb21taXQpID0+IGNvbW1pdC50eXBlID09PSAnZmVhdCcpO1xuICAgIHN3aXRjaCAodGFyZ2V0TGFiZWwpIHtcbiAgICAgIGNhc2UgdGFyZ2V0TGFiZWxzLlRBUkdFVF9NQUpPUjpcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRhcmdldExhYmVscy5UQVJHRVRfTUlOT1I6XG4gICAgICAgIGlmIChoYXNCcmVha2luZ0NoYW5nZXMpIHtcbiAgICAgICAgICB0aHJvdyB0aGlzLl9jcmVhdGVIYXNCcmVha2luZ0NoYW5nZXNFcnJvcih0YXJnZXRMYWJlbCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRhcmdldExhYmVscy5UQVJHRVRfUkM6XG4gICAgICBjYXNlIHRhcmdldExhYmVscy5UQVJHRVRfTFRTOlxuICAgICAgY2FzZSB0YXJnZXRMYWJlbHMuVEFSR0VUX1BBVENIOlxuICAgICAgICBpZiAoaGFzQnJlYWtpbmdDaGFuZ2VzKSB7XG4gICAgICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlSGFzQnJlYWtpbmdDaGFuZ2VzRXJyb3IodGFyZ2V0TGFiZWwpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChoYXNGZWF0dXJlQ29tbWl0cykge1xuICAgICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUhhc0ZlYXR1cmVDb21taXRzRXJyb3IodGFyZ2V0TGFiZWwpO1xuICAgICAgICB9XG4gICAgICAgIC8vIERlcHJlY2F0aW9ucyBzaG91bGQgbm90IGJlIG1lcmdlZCBpbnRvIFJDLCBwYXRjaCBvciBMVFMgYnJhbmNoZXMuXG4gICAgICAgIC8vIGh0dHBzOi8vc2VtdmVyLm9yZy8jc3BlYy1pdGVtLTcuIERlcHJlY2F0aW9ucyBzaG91bGQgYmUgcGFydCBvZlxuICAgICAgICAvLyBtaW5vciByZWxlYXNlcywgb3IgbWFqb3IgcmVsZWFzZXMgYWNjb3JkaW5nIHRvIFNlbVZlci5cbiAgICAgICAgaWYgKGhhc0RlcHJlY2F0aW9ucyAmJiAhcmVsZWFzZVRyYWlucy5pc0ZlYXR1cmVGcmVlemUoKSkge1xuICAgICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUhhc0RlcHJlY2F0aW9uc0Vycm9yKHRhcmdldExhYmVsKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIExvZy53YXJuKHJlZCgnV0FSTklORzogVW5hYmxlIHRvIGNvbmZpcm0gYWxsIGNvbW1pdHMgaW4gdGhlIHB1bGwgcmVxdWVzdCBhcmUnKSk7XG4gICAgICAgIExvZy53YXJuKHJlZChgZWxpZ2libGUgdG8gYmUgbWVyZ2VkIGludG8gdGhlIHRhcmdldCBicmFuY2hlcyBmb3I6ICR7dGFyZ2V0TGFiZWwubmFtZX1gKSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZUhhc0JyZWFraW5nQ2hhbmdlc0Vycm9yKGxhYmVsOiBUYXJnZXRMYWJlbCkge1xuICAgIGNvbnN0IG1lc3NhZ2UgPVxuICAgICAgYENhbm5vdCBtZXJnZSBpbnRvIGJyYW5jaCBmb3IgXCIke2xhYmVsLm5hbWV9XCIgYXMgdGhlIHB1bGwgcmVxdWVzdCBoYXMgYCArXG4gICAgICBgYnJlYWtpbmcgY2hhbmdlcy4gQnJlYWtpbmcgY2hhbmdlcyBjYW4gb25seSBiZSBtZXJnZWQgd2l0aCB0aGUgXCJ0YXJnZXQ6IG1ham9yXCIgbGFiZWwuYDtcbiAgICByZXR1cm4gdGhpcy5fY3JlYXRlRXJyb3IobWVzc2FnZSk7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVIYXNEZXByZWNhdGlvbnNFcnJvcihsYWJlbDogVGFyZ2V0TGFiZWwpIHtcbiAgICBjb25zdCBtZXNzYWdlID1cbiAgICAgIGBDYW5ub3QgbWVyZ2UgaW50byBicmFuY2ggZm9yIFwiJHtsYWJlbC5uYW1lfVwiIGFzIHRoZSBwdWxsIHJlcXVlc3QgYCArXG4gICAgICBgY29udGFpbnMgZGVwcmVjYXRpb25zLiBEZXByZWNhdGlvbnMgY2FuIG9ubHkgYmUgbWVyZ2VkIHdpdGggdGhlIFwidGFyZ2V0OiBtaW5vclwiIG9yIGAgK1xuICAgICAgYFwidGFyZ2V0OiBtYWpvclwiIGxhYmVsLmA7XG4gICAgcmV0dXJuIHRoaXMuX2NyZWF0ZUVycm9yKG1lc3NhZ2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlSGFzRmVhdHVyZUNvbW1pdHNFcnJvcihsYWJlbDogVGFyZ2V0TGFiZWwpIHtcbiAgICBjb25zdCBtZXNzYWdlID1cbiAgICAgIGBDYW5ub3QgbWVyZ2UgaW50byBicmFuY2ggZm9yIFwiJHtsYWJlbC5uYW1lfVwiIGFzIHRoZSBwdWxsIHJlcXVlc3QgaGFzIGAgK1xuICAgICAgJ2NvbW1pdHMgd2l0aCB0aGUgXCJmZWF0XCIgdHlwZS4gTmV3IGZlYXR1cmVzIGNhbiBvbmx5IGJlIG1lcmdlZCB3aXRoIHRoZSBcInRhcmdldDogbWlub3JcIiAnICtcbiAgICAgICdvciBcInRhcmdldDogbWFqb3JcIiBsYWJlbC4nO1xuICAgIHJldHVybiB0aGlzLl9jcmVhdGVFcnJvcihtZXNzYWdlKTtcbiAgfVxufVxuIl19