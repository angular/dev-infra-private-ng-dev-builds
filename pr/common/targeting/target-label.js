/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getTargetLabelConfigsForActiveReleaseTrains } from './labels.js';
/**
 * Unique error that will be thrown if an invalid branch is targeted.
 */
export class InvalidTargetBranchError {
    constructor(failureMessage) {
        this.failureMessage = failureMessage;
    }
}
/**
 * Unique error that will be thrown if an invalid label has been
 * applied to a pull request.
 */
export class InvalidTargetLabelError {
    constructor(failureMessage) {
        this.failureMessage = failureMessage;
    }
}
/**
 * Gets the matching target label config based on pull request labels.
 *
 * @throws {InvalidTargetLabelError} An invalid target label error is thrown
 *   if no single valid target label is applied.
 */
export async function getMatchingTargetLabelConfigForPullRequest(labelsOnPullRequest, labelConfigs) {
    const matches = [];
    for (const prLabelName of labelsOnPullRequest) {
        const match = labelConfigs.find(({ label }) => label.name === prLabelName);
        if (match !== undefined) {
            matches.push(match);
        }
    }
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length === 0) {
        throw new InvalidTargetLabelError('Unable to determine target for the PR as it has no target label.');
    }
    throw new InvalidTargetLabelError('Unable to determine target for the PR as it has multiple target labels.');
}
/**
 * Gets the target branches and label of the given pull request.
 *
 * @throws {InvalidTargetLabelError} An invalid target label error is thrown
 *   if no single valid target label is applied.
 */
export async function getTargetBranchesAndLabelForPullRequest(activeReleaseTrains, github, config, labelsOnPullRequest, githubTargetBranch) {
    const labelConfigs = await getTargetLabelConfigsForActiveReleaseTrains(activeReleaseTrains, github, config);
    const matchingConfig = await getMatchingTargetLabelConfigForPullRequest(labelsOnPullRequest, labelConfigs);
    return {
        branches: await getBranchesForTargetLabel(matchingConfig, githubTargetBranch),
        label: matchingConfig.label,
    };
}
/**
 * Gets the branches for the specified target label config.
 *
 * @throws {InvalidTargetLabelError} Invalid label has been applied to pull request.
 * @throws {InvalidTargetBranchError} Invalid Github target branch has been selected.
 */
export async function getBranchesForTargetLabel(labelConfig, githubTargetBranch) {
    return typeof labelConfig.branches === 'function'
        ? await labelConfig.branches(githubTargetBranch)
        : await labelConfig.branches;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFyZ2V0LWxhYmVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi90YXJnZXRpbmcvdGFyZ2V0LWxhYmVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQywyQ0FBMkMsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQWdDeEU7O0dBRUc7QUFDSCxNQUFNLE9BQU8sd0JBQXdCO0lBQ25DLFlBQW1CLGNBQXNCO1FBQXRCLG1CQUFjLEdBQWQsY0FBYyxDQUFRO0lBQUcsQ0FBQztDQUM5QztBQUVEOzs7R0FHRztBQUNILE1BQU0sT0FBTyx1QkFBdUI7SUFDbEMsWUFBbUIsY0FBc0I7UUFBdEIsbUJBQWMsR0FBZCxjQUFjLENBQVE7SUFBRyxDQUFDO0NBQzlDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLDBDQUEwQyxDQUM5RCxtQkFBNkIsRUFDN0IsWUFBaUM7SUFFakMsTUFBTSxPQUFPLEdBQXdCLEVBQUUsQ0FBQztJQUV4QyxLQUFLLE1BQU0sV0FBVyxJQUFJLG1CQUFtQixFQUFFLENBQUM7UUFDOUMsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUMsS0FBSyxFQUFDLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUM7UUFDekUsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDeEIsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN0QixDQUFDO0lBQ0gsQ0FBQztJQUNELElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN6QixPQUFPLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwQixDQUFDO0lBQ0QsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3pCLE1BQU0sSUFBSSx1QkFBdUIsQ0FDL0Isa0VBQWtFLENBQ25FLENBQUM7SUFDSixDQUFDO0lBQ0QsTUFBTSxJQUFJLHVCQUF1QixDQUMvQix5RUFBeUUsQ0FDMUUsQ0FBQztBQUNKLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsdUNBQXVDLENBQzNELG1CQUF3QyxFQUN4QyxNQUFvQixFQUNwQixNQUEyRSxFQUMzRSxtQkFBNkIsRUFDN0Isa0JBQTBCO0lBRTFCLE1BQU0sWUFBWSxHQUFHLE1BQU0sMkNBQTJDLENBQ3BFLG1CQUFtQixFQUNuQixNQUFNLEVBQ04sTUFBTSxDQUNQLENBQUM7SUFDRixNQUFNLGNBQWMsR0FBRyxNQUFNLDBDQUEwQyxDQUNyRSxtQkFBbUIsRUFDbkIsWUFBWSxDQUNiLENBQUM7SUFFRixPQUFPO1FBQ0wsUUFBUSxFQUFFLE1BQU0seUJBQXlCLENBQUMsY0FBYyxFQUFFLGtCQUFrQixDQUFDO1FBQzdFLEtBQUssRUFBRSxjQUFjLENBQUMsS0FBSztLQUM1QixDQUFDO0FBQ0osQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSx5QkFBeUIsQ0FDN0MsV0FBOEIsRUFDOUIsa0JBQTBCO0lBRTFCLE9BQU8sT0FBTyxXQUFXLENBQUMsUUFBUSxLQUFLLFVBQVU7UUFDL0MsQ0FBQyxDQUFDLE1BQU0sV0FBVyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQztRQUNoRCxDQUFDLENBQUMsTUFBTSxXQUFXLENBQUMsUUFBUSxDQUFDO0FBQ2pDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQdWxsUmVxdWVzdENvbmZpZ30gZnJvbSAnLi4vLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7Z2V0VGFyZ2V0TGFiZWxDb25maWdzRm9yQWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi9sYWJlbHMuanMnO1xuaW1wb3J0IHtHaXRodWJDb25maWcsIE5nRGV2Q29uZmlnfSBmcm9tICcuLi8uLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHtHaXRodWJDbGllbnR9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2dpdC9naXRodWIuanMnO1xuaW1wb3J0IHtBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi8uLi8uLi9yZWxlYXNlL3ZlcnNpb25pbmcvaW5kZXguanMnO1xuaW1wb3J0IHtUYXJnZXRMYWJlbH0gZnJvbSAnLi4vbGFiZWxzL3RhcmdldC5qcyc7XG5cbi8qKiBUeXBlIGRlc2NyaWJpbmcgdGhlIGRldGVybWluZWQgdGFyZ2V0IG9mIGEgcHVsbCByZXF1ZXN0LiAqL1xuZXhwb3J0IGludGVyZmFjZSBQdWxsUmVxdWVzdFRhcmdldCB7XG4gIC8qKiBCcmFuY2hlcyB3aGljaCB0aGUgcHVsbCByZXF1ZXN0IHRhcmdldHMuICovXG4gIGJyYW5jaGVzOiBzdHJpbmdbXTtcbiAgLyoqIFRhcmdldCBsYWJlbCBhcHBsaWVkIHRvIHRoZSBwdWxsIHJlcXVlc3QuICovXG4gIGxhYmVsOiBUYXJnZXRMYWJlbDtcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIGZvciBhIHRhcmdldCBsYWJlbC4gVGhlIGNvbmZpZyBpcyByZXNwb25zaWJsZSBmb3JcbiAqIG1hcHBpbmcgYSBsYWJlbCB0byBpdHMgYnJhbmNoZXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVGFyZ2V0TGFiZWxDb25maWcge1xuICAvKiogVGFyZ2V0IGxhYmVsIGZvciB3aGljaCB0aGUgY29uZmlnIGFwcGxpZXMgdG8uICovXG4gIGxhYmVsOiBUYXJnZXRMYWJlbDtcbiAgLyoqXG4gICAqIExpc3Qgb2YgYnJhbmNoZXMgYSBwdWxsIHJlcXVlc3Qgd2l0aCB0aGlzIHRhcmdldCBsYWJlbCBzaG91bGQgYmUgbWVyZ2VkIGludG8uXG4gICAqIENhbiBhbHNvIGJlIHdyYXBwZWQgaW4gYSBmdW5jdGlvbiB0aGF0IGFjY2VwdHMgdGhlIHRhcmdldCBicmFuY2ggc3BlY2lmaWVkIGluIHRoZVxuICAgKiBHaXRodWIgV2ViIFVJLiBUaGlzIGlzIHVzZWZ1bCBmb3Igc3VwcG9ydGluZyBsYWJlbHMgbGlrZSBgdGFyZ2V0OiBkZXZlbG9wbWVudC1icmFuY2hgLlxuICAgKlxuICAgKiBAdGhyb3dzIHtJbnZhbGlkVGFyZ2V0TGFiZWxFcnJvcn0gSW52YWxpZCBsYWJlbCBoYXMgYmVlbiBhcHBsaWVkIHRvIHB1bGwgcmVxdWVzdC5cbiAgICogQHRocm93cyB7SW52YWxpZFRhcmdldEJyYW5jaEVycm9yfSBJbnZhbGlkIEdpdGh1YiB0YXJnZXQgYnJhbmNoIGhhcyBiZWVuIHNlbGVjdGVkLlxuICAgKi9cbiAgYnJhbmNoZXM6IChnaXRodWJUYXJnZXRCcmFuY2g6IHN0cmluZykgPT4gc3RyaW5nW10gfCBQcm9taXNlPHN0cmluZ1tdPjtcbn1cblxuLyoqXG4gKiBVbmlxdWUgZXJyb3IgdGhhdCB3aWxsIGJlIHRocm93biBpZiBhbiBpbnZhbGlkIGJyYW5jaCBpcyB0YXJnZXRlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIEludmFsaWRUYXJnZXRCcmFuY2hFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBmYWlsdXJlTWVzc2FnZTogc3RyaW5nKSB7fVxufVxuXG4vKipcbiAqIFVuaXF1ZSBlcnJvciB0aGF0IHdpbGwgYmUgdGhyb3duIGlmIGFuIGludmFsaWQgbGFiZWwgaGFzIGJlZW5cbiAqIGFwcGxpZWQgdG8gYSBwdWxsIHJlcXVlc3QuXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnZhbGlkVGFyZ2V0TGFiZWxFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBmYWlsdXJlTWVzc2FnZTogc3RyaW5nKSB7fVxufVxuXG4vKipcbiAqIEdldHMgdGhlIG1hdGNoaW5nIHRhcmdldCBsYWJlbCBjb25maWcgYmFzZWQgb24gcHVsbCByZXF1ZXN0IGxhYmVscy5cbiAqXG4gKiBAdGhyb3dzIHtJbnZhbGlkVGFyZ2V0TGFiZWxFcnJvcn0gQW4gaW52YWxpZCB0YXJnZXQgbGFiZWwgZXJyb3IgaXMgdGhyb3duXG4gKiAgIGlmIG5vIHNpbmdsZSB2YWxpZCB0YXJnZXQgbGFiZWwgaXMgYXBwbGllZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldE1hdGNoaW5nVGFyZ2V0TGFiZWxDb25maWdGb3JQdWxsUmVxdWVzdChcbiAgbGFiZWxzT25QdWxsUmVxdWVzdDogc3RyaW5nW10sXG4gIGxhYmVsQ29uZmlnczogVGFyZ2V0TGFiZWxDb25maWdbXSxcbik6IFByb21pc2U8VGFyZ2V0TGFiZWxDb25maWc+IHtcbiAgY29uc3QgbWF0Y2hlczogVGFyZ2V0TGFiZWxDb25maWdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgcHJMYWJlbE5hbWUgb2YgbGFiZWxzT25QdWxsUmVxdWVzdCkge1xuICAgIGNvbnN0IG1hdGNoID0gbGFiZWxDb25maWdzLmZpbmQoKHtsYWJlbH0pID0+IGxhYmVsLm5hbWUgPT09IHByTGFiZWxOYW1lKTtcbiAgICBpZiAobWF0Y2ggIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWF0Y2hlcy5wdXNoKG1hdGNoKTtcbiAgICB9XG4gIH1cbiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIG1hdGNoZXNbMF07XG4gIH1cbiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEludmFsaWRUYXJnZXRMYWJlbEVycm9yKFxuICAgICAgJ1VuYWJsZSB0byBkZXRlcm1pbmUgdGFyZ2V0IGZvciB0aGUgUFIgYXMgaXQgaGFzIG5vIHRhcmdldCBsYWJlbC4nLFxuICAgICk7XG4gIH1cbiAgdGhyb3cgbmV3IEludmFsaWRUYXJnZXRMYWJlbEVycm9yKFxuICAgICdVbmFibGUgdG8gZGV0ZXJtaW5lIHRhcmdldCBmb3IgdGhlIFBSIGFzIGl0IGhhcyBtdWx0aXBsZSB0YXJnZXQgbGFiZWxzLicsXG4gICk7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgdGFyZ2V0IGJyYW5jaGVzIGFuZCBsYWJlbCBvZiB0aGUgZ2l2ZW4gcHVsbCByZXF1ZXN0LlxuICpcbiAqIEB0aHJvd3Mge0ludmFsaWRUYXJnZXRMYWJlbEVycm9yfSBBbiBpbnZhbGlkIHRhcmdldCBsYWJlbCBlcnJvciBpcyB0aHJvd25cbiAqICAgaWYgbm8gc2luZ2xlIHZhbGlkIHRhcmdldCBsYWJlbCBpcyBhcHBsaWVkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VGFyZ2V0QnJhbmNoZXNBbmRMYWJlbEZvclB1bGxSZXF1ZXN0KFxuICBhY3RpdmVSZWxlYXNlVHJhaW5zOiBBY3RpdmVSZWxlYXNlVHJhaW5zLFxuICBnaXRodWI6IEdpdGh1YkNsaWVudCxcbiAgY29uZmlnOiBOZ0RldkNvbmZpZzx7cHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0Q29uZmlnOyBnaXRodWI6IEdpdGh1YkNvbmZpZ30+LFxuICBsYWJlbHNPblB1bGxSZXF1ZXN0OiBzdHJpbmdbXSxcbiAgZ2l0aHViVGFyZ2V0QnJhbmNoOiBzdHJpbmcsXG4pOiBQcm9taXNlPFB1bGxSZXF1ZXN0VGFyZ2V0PiB7XG4gIGNvbnN0IGxhYmVsQ29uZmlncyA9IGF3YWl0IGdldFRhcmdldExhYmVsQ29uZmlnc0ZvckFjdGl2ZVJlbGVhc2VUcmFpbnMoXG4gICAgYWN0aXZlUmVsZWFzZVRyYWlucyxcbiAgICBnaXRodWIsXG4gICAgY29uZmlnLFxuICApO1xuICBjb25zdCBtYXRjaGluZ0NvbmZpZyA9IGF3YWl0IGdldE1hdGNoaW5nVGFyZ2V0TGFiZWxDb25maWdGb3JQdWxsUmVxdWVzdChcbiAgICBsYWJlbHNPblB1bGxSZXF1ZXN0LFxuICAgIGxhYmVsQ29uZmlncyxcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIGJyYW5jaGVzOiBhd2FpdCBnZXRCcmFuY2hlc0ZvclRhcmdldExhYmVsKG1hdGNoaW5nQ29uZmlnLCBnaXRodWJUYXJnZXRCcmFuY2gpLFxuICAgIGxhYmVsOiBtYXRjaGluZ0NvbmZpZy5sYWJlbCxcbiAgfTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBicmFuY2hlcyBmb3IgdGhlIHNwZWNpZmllZCB0YXJnZXQgbGFiZWwgY29uZmlnLlxuICpcbiAqIEB0aHJvd3Mge0ludmFsaWRUYXJnZXRMYWJlbEVycm9yfSBJbnZhbGlkIGxhYmVsIGhhcyBiZWVuIGFwcGxpZWQgdG8gcHVsbCByZXF1ZXN0LlxuICogQHRocm93cyB7SW52YWxpZFRhcmdldEJyYW5jaEVycm9yfSBJbnZhbGlkIEdpdGh1YiB0YXJnZXQgYnJhbmNoIGhhcyBiZWVuIHNlbGVjdGVkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QnJhbmNoZXNGb3JUYXJnZXRMYWJlbChcbiAgbGFiZWxDb25maWc6IFRhcmdldExhYmVsQ29uZmlnLFxuICBnaXRodWJUYXJnZXRCcmFuY2g6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgcmV0dXJuIHR5cGVvZiBsYWJlbENvbmZpZy5icmFuY2hlcyA9PT0gJ2Z1bmN0aW9uJ1xuICAgID8gYXdhaXQgbGFiZWxDb25maWcuYnJhbmNoZXMoZ2l0aHViVGFyZ2V0QnJhbmNoKVxuICAgIDogYXdhaXQgbGFiZWxDb25maWcuYnJhbmNoZXM7XG59XG4iXX0=