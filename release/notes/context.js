/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { COMMIT_TYPES, ReleaseNotesLevel } from '../../commit-message/config.js';
import { compareString } from '../../utils/locale.js';
/** List of types to be included in the release notes. */
const typesToIncludeInReleaseNotes = Object.values(COMMIT_TYPES)
    .filter((type) => type.releaseNotesLevel === ReleaseNotesLevel.Visible)
    .map((type) => type.name);
/** Context class used for rendering release notes. */
export class RenderContext {
    constructor(data) {
        this.data = data;
        /** An array of group names in sort order if defined. */
        this.groupOrder = this.data.groupOrder || [];
        /** An array of scopes to hide from the release entry output. */
        this.hiddenScopes = this.data.hiddenScopes || [];
        /** The title of the release, or `false` if no title should be used. */
        this.title = this.data.title;
        /** The version of the release. */
        this.version = this.data.version;
        /** The date stamp string for use in the release notes entry. */
        this.dateStamp = buildDateStamp(this.data.date);
        /** URL fragment that is used to create an anchor for the release. */
        this.urlFragmentForRelease = this.data.version;
        /** List of categorized commits in the release period. */
        this.commits = this._categorizeCommits(this.data.commits);
        /**
         * Comparator used for sorting commits within a release notes group. Commits
         * are sorted alphabetically based on their type. Commits having the same type
         * will be sorted alphabetically based on their determined description
         */
        this._commitsWithinGroupComparator = (a, b) => {
            const typeCompareOrder = compareString(a.type, b.type);
            if (typeCompareOrder === 0) {
                return compareString(a.description, b.description);
            }
            return typeCompareOrder;
        };
    }
    /** Gets a list of categorized commits from all commits in the release period. */
    _categorizeCommits(commits) {
        return commits.map((commit) => {
            const { description, groupName } = this.data.categorizeCommit?.(commit) ?? {};
            return {
                groupName: groupName ?? commit.scope,
                description: description ?? commit.subject,
                ...commit,
            };
        });
    }
    /**
     * Organizes and sorts the commits into groups of commits.
     *
     * Groups are sorted either by default `Array.sort` order, or using the provided group order from
     * the configuration. Commits are order in the same order within each groups commit list as they
     * appear in the provided list of commits.
     * */
    asCommitGroups(commits) {
        /** The discovered groups to organize into. */
        const groups = new Map();
        // Place each commit in the list into its group.
        commits.forEach((commit) => {
            const key = commit.groupName;
            const groupCommits = groups.get(key) || [];
            groups.set(key, groupCommits);
            groupCommits.push(commit);
        });
        /**
         * List of discovered commit groups which are sorted in alphanumeric order
         * based on the group title.
         */
        const commitGroups = Array.from(groups.entries())
            .map(([title, groupCommits]) => ({
            title,
            commits: groupCommits.sort(this._commitsWithinGroupComparator),
        }))
            .sort((a, b) => compareString(a.title, b.title));
        // If the configuration provides a sorting order, updated the sorted list of group keys to
        // satisfy the order of the groups provided in the list with any groups not found in the list at
        // the end of the sorted list.
        if (this.groupOrder.length) {
            for (const groupTitle of this.groupOrder.reverse()) {
                const currentIdx = commitGroups.findIndex((k) => k.title === groupTitle);
                if (currentIdx !== -1) {
                    const removedGroups = commitGroups.splice(currentIdx, 1);
                    commitGroups.splice(0, 0, ...removedGroups);
                }
            }
        }
        return commitGroups;
    }
    /** Whether the specified commit contains breaking changes. */
    hasBreakingChanges(commit) {
        return commit.breakingChanges.length !== 0;
    }
    /** Whether the specified commit contains deprecations. */
    hasDeprecations(commit) {
        return commit.deprecations.length !== 0;
    }
    /**
     * A filter function for filtering a list of commits to only include commits which
     * should appear in release notes.
     */
    includeInReleaseNotes() {
        return (commit) => {
            if (this.hiddenScopes.includes(commit.scope)) {
                return false;
            }
            // Commits which contain breaking changes or deprecations are always included
            // in release notes. The breaking change or deprecations will already be listed
            // in a dedicated section but it is still valuable to include the actual commit.
            if (this.hasBreakingChanges(commit) || this.hasDeprecations(commit)) {
                return true;
            }
            return typesToIncludeInReleaseNotes.includes(commit.type);
        };
    }
    /**
     * A filter function for filtering a list of commits to only include commits which contain a
     * unique value for the provided field across all commits in the list.
     */
    unique(field) {
        const set = new Set();
        return (commit) => {
            const include = !set.has(commit[field]);
            set.add(commit[field]);
            return include;
        };
    }
    /**
     * Convert a commit object to a Markdown link.
     */
    commitToLink(commit) {
        const url = `https://github.com/${this.data.github.owner}/${this.data.github.name}/commit/${commit.hash}`;
        return `[${commit.shortHash}](${url})`;
    }
    /**
     * Convert a pull request number to a Markdown link.
     */
    pullRequestToLink(prNumber) {
        const url = `https://github.com/${this.data.github.owner}/${this.data.github.name}/pull/${prNumber}`;
        return `[#${prNumber}](${url})`;
    }
    /**
     * Transform a given string by replacing any pull request references with their
     * equivalent markdown links.
     *
     * This is useful for the changelog output. Github transforms pull request references
     * automatically in release note entries, issues and pull requests, but not for plain
     * markdown files (like the changelog file).
     */
    convertPullRequestReferencesToLinks(content) {
        return content.replace(/#(\d+)/g, (_, g) => this.pullRequestToLink(Number(g)));
    }
    /**
     * Bulletize a paragraph.
     */
    bulletizeText(text) {
        return '- ' + text.replace(/\n/g, '\n  ');
    }
    /**
     * Convert a commit object to a Markdown linked badged.
     */
    commitToBadge(commit) {
        let color = 'yellow';
        switch (commit.type) {
            case 'fix':
                color = 'green';
                break;
            case 'feat':
                color = 'blue';
                break;
            case 'perf':
                color = 'orange';
                break;
        }
        const url = `https://github.com/${this.data.github.owner}/${this.data.github.name}/commit/${commit.hash}`;
        const imgSrc = `https://img.shields.io/badge/${commit.shortHash}-${commit.type}-${color}`;
        return `[![${commit.type} - ${commit.shortHash}](${imgSrc})](${url})`;
    }
}
/**
 * Builds a date stamp for stamping in release notes.
 *
 * Uses the current date, or a provided date in the format of YYYY-MM-DD, i.e. 1970-11-05.
 */
export function buildDateStamp(date = new Date()) {
    const year = `${date.getFullYear()}`;
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return [year, month, day].join('-');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL25vdGVzL2NvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBRSxpQkFBaUIsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBSS9FLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUVwRCx5REFBeUQ7QUFDekQsTUFBTSw0QkFBNEIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztLQUM3RCxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsS0FBSyxpQkFBaUIsQ0FBQyxPQUFPLENBQUM7S0FDdEUsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFvQjVCLHNEQUFzRDtBQUN0RCxNQUFNLE9BQU8sYUFBYTtJQWdCeEIsWUFBNkIsSUFBdUI7UUFBdkIsU0FBSSxHQUFKLElBQUksQ0FBbUI7UUFmcEQsd0RBQXdEO1FBQ3ZDLGVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUM7UUFDekQsZ0VBQWdFO1FBQy9DLGlCQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO1FBQzdELHVFQUF1RTtRQUM5RCxVQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDakMsa0NBQWtDO1FBQ3pCLFlBQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNyQyxnRUFBZ0U7UUFDdkQsY0FBUyxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BELHFFQUFxRTtRQUM1RCwwQkFB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LEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDT01NSVRfVFlQRVMsIFJlbGVhc2VOb3Rlc0xldmVsfSBmcm9tICcuLi8uLi9jb21taXQtbWVzc2FnZS9jb25maWcuanMnO1xuaW1wb3J0IHtDb21taXRGcm9tR2l0TG9nfSBmcm9tICcuLi8uLi9jb21taXQtbWVzc2FnZS9wYXJzZS5qcyc7XG5pbXBvcnQge0dpdGh1YkNvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7UmVsZWFzZU5vdGVzQ29uZmlnfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtjb21wYXJlU3RyaW5nfSBmcm9tICcuLi8uLi91dGlscy9sb2NhbGUuanMnO1xuXG4vKiogTGlzdCBvZiB0eXBlcyB0byBiZSBpbmNsdWRlZCBpbiB0aGUgcmVsZWFzZSBub3Rlcy4gKi9cbmNvbnN0IHR5cGVzVG9JbmNsdWRlSW5SZWxlYXNlTm90ZXMgPSBPYmplY3QudmFsdWVzKENPTU1JVF9UWVBFUylcbiAgLmZpbHRlcigodHlwZSkgPT4gdHlwZS5yZWxlYXNlTm90ZXNMZXZlbCA9PT0gUmVsZWFzZU5vdGVzTGV2ZWwuVmlzaWJsZSlcbiAgLm1hcCgodHlwZSkgPT4gdHlwZS5uYW1lKTtcblxuLyoqIERhdGEgdXNlZCBmb3IgY29udGV4dCBkdXJpbmcgcmVuZGVyaW5nLiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJDb250ZXh0RGF0YSB7XG4gIHRpdGxlOiBzdHJpbmcgfCBmYWxzZTtcbiAgZ3JvdXBPcmRlcjogUmVsZWFzZU5vdGVzQ29uZmlnWydncm91cE9yZGVyJ107XG4gIGhpZGRlblNjb3BlczogUmVsZWFzZU5vdGVzQ29uZmlnWydoaWRkZW5TY29wZXMnXTtcbiAgY2F0ZWdvcml6ZUNvbW1pdDogUmVsZWFzZU5vdGVzQ29uZmlnWydjYXRlZ29yaXplQ29tbWl0J107XG4gIGNvbW1pdHM6IENvbW1pdEZyb21HaXRMb2dbXTtcbiAgdmVyc2lvbjogc3RyaW5nO1xuICBnaXRodWI6IEdpdGh1YkNvbmZpZztcbiAgZGF0ZT86IERhdGU7XG59XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyBhbiBjYXRlZ29yaXplZCBjb21taXQuICovXG5leHBvcnQgaW50ZXJmYWNlIENhdGVnb3JpemVkQ29tbWl0IGV4dGVuZHMgQ29tbWl0RnJvbUdpdExvZyB7XG4gIGdyb3VwTmFtZTogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG4vKiogQ29udGV4dCBjbGFzcyB1c2VkIGZvciByZW5kZXJpbmcgcmVsZWFzZSBub3Rlcy4gKi9cbmV4cG9ydCBjbGFzcyBSZW5kZXJDb250ZXh0IHtcbiAgLyoqIEFuIGFycmF5IG9mIGdyb3VwIG5hbWVzIGluIHNvcnQgb3JkZXIgaWYgZGVmaW5lZC4gKi9cbiAgcHJpdmF0ZSByZWFkb25seSBncm91cE9yZGVyID0gdGhpcy5kYXRhLmdyb3VwT3JkZXIgfHwgW107XG4gIC8qKiBBbiBhcnJheSBvZiBzY29wZXMgdG8gaGlkZSBmcm9tIHRoZSByZWxlYXNlIGVudHJ5IG91dHB1dC4gKi9cbiAgcHJpdmF0ZSByZWFkb25seSBoaWRkZW5TY29wZXMgPSB0aGlzLmRhdGEuaGlkZGVuU2NvcGVzIHx8IFtdO1xuICAvKiogVGhlIHRpdGxlIG9mIHRoZSByZWxlYXNlLCBvciBgZmFsc2VgIGlmIG5vIHRpdGxlIHNob3VsZCBiZSB1c2VkLiAqL1xuICByZWFkb25seSB0aXRsZSA9IHRoaXMuZGF0YS50aXRsZTtcbiAgLyoqIFRoZSB2ZXJzaW9uIG9mIHRoZSByZWxlYXNlLiAqL1xuICByZWFkb25seSB2ZXJzaW9uID0gdGhpcy5kYXRhLnZlcnNpb247XG4gIC8qKiBUaGUgZGF0ZSBzdGFtcCBzdHJpbmcgZm9yIHVzZSBpbiB0aGUgcmVsZWFzZSBub3RlcyBlbnRyeS4gKi9cbiAgcmVhZG9ubHkgZGF0ZVN0YW1wID0gYnVpbGREYXRlU3RhbXAodGhpcy5kYXRhLmRhdGUpO1xuICAvKiogVVJMIGZyYWdtZW50IHRoYXQgaXMgdXNlZCB0byBjcmVhdGUgYW4gYW5jaG9yIGZvciB0aGUgcmVsZWFzZS4gKi9cbiAgcmVhZG9ubHkgdXJsRnJhZ21lbnRGb3JSZWxlYXNlID0gdGhpcy5kYXRhLnZlcnNpb247XG4gIC8qKiBMaXN0IG9mIGNhdGVnb3JpemVkIGNvbW1pdHMgaW4gdGhlIHJlbGVhc2UgcGVyaW9kLiAqL1xuICByZWFkb25seSBjb21taXRzID0gdGhpcy5fY2F0ZWdvcml6ZUNvbW1pdHModGhpcy5kYXRhLmNvbW1pdHMpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgZGF0YTogUmVuZGVyQ29udGV4dERhdGEpIHt9XG5cbiAgLyoqIEdldHMgYSBsaXN0IG9mIGNhdGVnb3JpemVkIGNvbW1pdHMgZnJvbSBhbGwgY29tbWl0cyBpbiB0aGUgcmVsZWFzZSBwZXJpb2QuICovXG4gIF9jYXRlZ29yaXplQ29tbWl0cyhjb21taXRzOiBDb21taXRGcm9tR2l0TG9nW10pOiBDYXRlZ29yaXplZENvbW1pdFtdIHtcbiAgICByZXR1cm4gY29tbWl0cy5tYXAoKGNvbW1pdCkgPT4ge1xuICAgICAgY29uc3Qge2Rlc2NyaXB0aW9uLCBncm91cE5hbWV9ID0gdGhpcy5kYXRhLmNhdGVnb3JpemVDb21taXQ/Lihjb21taXQpID8/IHt9O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZ3JvdXBOYW1lOiBncm91cE5hbWUgPz8gY29tbWl0LnNjb3BlLFxuICAgICAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24gPz8gY29tbWl0LnN1YmplY3QsXG4gICAgICAgIC4uLmNvbW1pdCxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGFyYXRvciB1c2VkIGZvciBzb3J0aW5nIGNvbW1pdHMgd2l0aGluIGEgcmVsZWFzZSBub3RlcyBncm91cC4gQ29tbWl0c1xuICAgKiBhcmUgc29ydGVkIGFscGhhYmV0aWNhbGx5IGJhc2VkIG9uIHRoZWlyIHR5cGUuIENvbW1pdHMgaGF2aW5nIHRoZSBzYW1lIHR5cGVcbiAgICogd2lsbCBiZSBzb3J0ZWQgYWxwaGFiZXRpY2FsbHkgYmFzZWQgb24gdGhlaXIgZGV0ZXJtaW5lZCBkZXNjcmlwdGlvblxuICAgKi9cbiAgcHJpdmF0ZSBfY29tbWl0c1dpdGhpbkdyb3VwQ29tcGFyYXRvciA9IChhOiBDYXRlZ29yaXplZENvbW1pdCwgYjogQ2F0ZWdvcml6ZWRDb21taXQpOiBudW1iZXIgPT4ge1xuICAgIGNvbnN0IHR5cGVDb21wYXJlT3JkZXIgPSBjb21wYXJlU3RyaW5nKGEudHlwZSwgYi50eXBlKTtcbiAgICBpZiAodHlwZUNvbXBhcmVPcmRlciA9PT0gMCkge1xuICAgICAgcmV0dXJuIGNvbXBhcmVTdHJpbmcoYS5kZXNjcmlwdGlvbiwgYi5kZXNjcmlwdGlvbik7XG4gICAgfVxuICAgIHJldHVybiB0eXBlQ29tcGFyZU9yZGVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBPcmdhbml6ZXMgYW5kIHNvcnRzIHRoZSBjb21taXRzIGludG8gZ3JvdXBzIG9mIGNvbW1pdHMuXG4gICAqXG4gICAqIEdyb3VwcyBhcmUgc29ydGVkIGVpdGhlciBieSBkZWZhdWx0IGBBcnJheS5zb3J0YCBvcmRlciwgb3IgdXNpbmcgdGhlIHByb3ZpZGVkIGdyb3VwIG9yZGVyIGZyb21cbiAgICogdGhlIGNvbmZpZ3VyYXRpb24uIENvbW1pdHMgYXJlIG9yZGVyIGluIHRoZSBzYW1lIG9yZGVyIHdpdGhpbiBlYWNoIGdyb3VwcyBjb21taXQgbGlzdCBhcyB0aGV5XG4gICAqIGFwcGVhciBpbiB0aGUgcHJvdmlkZWQgbGlzdCBvZiBjb21taXRzLlxuICAgKiAqL1xuICBhc0NvbW1pdEdyb3Vwcyhjb21taXRzOiBDYXRlZ29yaXplZENvbW1pdFtdKSB7XG4gICAgLyoqIFRoZSBkaXNjb3ZlcmVkIGdyb3VwcyB0byBvcmdhbml6ZSBpbnRvLiAqL1xuICAgIGNvbnN0IGdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBDYXRlZ29yaXplZENvbW1pdFtdPigpO1xuXG4gICAgLy8gUGxhY2UgZWFjaCBjb21taXQgaW4gdGhlIGxpc3QgaW50byBpdHMgZ3JvdXAuXG4gICAgY29tbWl0cy5mb3JFYWNoKChjb21taXQpID0+IHtcbiAgICAgIGNvbnN0IGtleSA9IGNvbW1pdC5ncm91cE5hbWU7XG4gICAgICBjb25zdCBncm91cENvbW1pdHMgPSBncm91cHMuZ2V0KGtleSkgfHwgW107XG4gICAgICBncm91cHMuc2V0KGtleSwgZ3JvdXBDb21taXRzKTtcbiAgICAgIGdyb3VwQ29tbWl0cy5wdXNoKGNvbW1pdCk7XG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IG9mIGRpc2NvdmVyZWQgY29tbWl0IGdyb3VwcyB3aGljaCBhcmUgc29ydGVkIGluIGFscGhhbnVtZXJpYyBvcmRlclxuICAgICAqIGJhc2VkIG9uIHRoZSBncm91cCB0aXRsZS5cbiAgICAgKi9cbiAgICBjb25zdCBjb21taXRHcm91cHMgPSBBcnJheS5mcm9tKGdyb3Vwcy5lbnRyaWVzKCkpXG4gICAgICAubWFwKChbdGl0bGUsIGdyb3VwQ29tbWl0c10pID0+ICh7XG4gICAgICAgIHRpdGxlLFxuICAgICAgICBjb21taXRzOiBncm91cENvbW1pdHMuc29ydCh0aGlzLl9jb21taXRzV2l0aGluR3JvdXBDb21wYXJhdG9yKSxcbiAgICAgIH0pKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGNvbXBhcmVTdHJpbmcoYS50aXRsZSwgYi50aXRsZSkpO1xuXG4gICAgLy8gSWYgdGhlIGNvbmZpZ3VyYXRpb24gcHJvdmlkZXMgYSBzb3J0aW5nIG9yZGVyLCB1cGRhdGVkIHRoZSBzb3J0ZWQgbGlzdCBvZiBncm91cCBrZXlzIHRvXG4gICAgLy8gc2F0aXNmeSB0aGUgb3JkZXIgb2YgdGhlIGdyb3VwcyBwcm92aWRlZCBpbiB0aGUgbGlzdCB3aXRoIGFueSBncm91cHMgbm90IGZvdW5kIGluIHRoZSBsaXN0IGF0XG4gICAgLy8gdGhlIGVuZCBvZiB0aGUgc29ydGVkIGxpc3QuXG4gICAgaWYgKHRoaXMuZ3JvdXBPcmRlci5sZW5ndGgpIHtcbiAgICAgIGZvciAoY29uc3QgZ3JvdXBUaXRsZSBvZiB0aGlzLmdyb3VwT3JkZXIucmV2ZXJzZSgpKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRJZHggPSBjb21taXRHcm91cHMuZmluZEluZGV4KChrKSA9PiBrLnRpdGxlID09PSBncm91cFRpdGxlKTtcbiAgICAgICAgaWYgKGN1cnJlbnRJZHggIT09IC0xKSB7XG4gICAgICAgICAgY29uc3QgcmVtb3ZlZEdyb3VwcyA9IGNvbW1pdEdyb3Vwcy5zcGxpY2UoY3VycmVudElkeCwgMSk7XG4gICAgICAgICAgY29tbWl0R3JvdXBzLnNwbGljZSgwLCAwLCAuLi5yZW1vdmVkR3JvdXBzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29tbWl0R3JvdXBzO1xuICB9XG5cbiAgLyoqIFdoZXRoZXIgdGhlIHNwZWNpZmllZCBjb21taXQgY29udGFpbnMgYnJlYWtpbmcgY2hhbmdlcy4gKi9cbiAgaGFzQnJlYWtpbmdDaGFuZ2VzKGNvbW1pdDogQ2F0ZWdvcml6ZWRDb21taXQpIHtcbiAgICByZXR1cm4gY29tbWl0LmJyZWFraW5nQ2hhbmdlcy5sZW5ndGggIT09IDA7XG4gIH1cblxuICAvKiogV2hldGhlciB0aGUgc3BlY2lmaWVkIGNvbW1pdCBjb250YWlucyBkZXByZWNhdGlvbnMuICovXG4gIGhhc0RlcHJlY2F0aW9ucyhjb21taXQ6IENhdGVnb3JpemVkQ29tbWl0KSB7XG4gICAgcmV0dXJuIGNvbW1pdC5kZXByZWNhdGlvbnMubGVuZ3RoICE9PSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgZmlsdGVyIGZ1bmN0aW9uIGZvciBmaWx0ZXJpbmcgYSBsaXN0IG9mIGNvbW1pdHMgdG8gb25seSBpbmNsdWRlIGNvbW1pdHMgd2hpY2hcbiAgICogc2hvdWxkIGFwcGVhciBpbiByZWxlYXNlIG5vdGVzLlxuICAgKi9cbiAgaW5jbHVkZUluUmVsZWFzZU5vdGVzKCkge1xuICAgIHJldHVybiAoY29tbWl0OiBDYXRlZ29yaXplZENvbW1pdCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaGlkZGVuU2NvcGVzLmluY2x1ZGVzKGNvbW1pdC5zY29wZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBDb21taXRzIHdoaWNoIGNvbnRhaW4gYnJlYWtpbmcgY2hhbmdlcyBvciBkZXByZWNhdGlvbnMgYXJlIGFsd2F5cyBpbmNsdWRlZFxuICAgICAgLy8gaW4gcmVsZWFzZSBub3Rlcy4gVGhlIGJyZWFraW5nIGNoYW5nZSBvciBkZXByZWNhdGlvbnMgd2lsbCBhbHJlYWR5IGJlIGxpc3RlZFxuICAgICAgLy8gaW4gYSBkZWRpY2F0ZWQgc2VjdGlvbiBidXQgaXQgaXMgc3RpbGwgdmFsdWFibGUgdG8gaW5jbHVkZSB0aGUgYWN0dWFsIGNvbW1pdC5cbiAgICAgIGlmICh0aGlzLmhhc0JyZWFraW5nQ2hhbmdlcyhjb21taXQpIHx8IHRoaXMuaGFzRGVwcmVjYXRpb25zKGNvbW1pdCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0eXBlc1RvSW5jbHVkZUluUmVsZWFzZU5vdGVzLmluY2x1ZGVzKGNvbW1pdC50eXBlKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEEgZmlsdGVyIGZ1bmN0aW9uIGZvciBmaWx0ZXJpbmcgYSBsaXN0IG9mIGNvbW1pdHMgdG8gb25seSBpbmNsdWRlIGNvbW1pdHMgd2hpY2ggY29udGFpbiBhXG4gICAqIHVuaXF1ZSB2YWx1ZSBmb3IgdGhlIHByb3ZpZGVkIGZpZWxkIGFjcm9zcyBhbGwgY29tbWl0cyBpbiB0aGUgbGlzdC5cbiAgICovXG4gIHVuaXF1ZShmaWVsZDoga2V5b2YgQ2F0ZWdvcml6ZWRDb21taXQpIHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PENhdGVnb3JpemVkQ29tbWl0W3R5cGVvZiBmaWVsZF0+KCk7XG4gICAgcmV0dXJuIChjb21taXQ6IENhdGVnb3JpemVkQ29tbWl0KSA9PiB7XG4gICAgICBjb25zdCBpbmNsdWRlID0gIXNldC5oYXMoY29tbWl0W2ZpZWxkXSk7XG4gICAgICBzZXQuYWRkKGNvbW1pdFtmaWVsZF0pO1xuICAgICAgcmV0dXJuIGluY2x1ZGU7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGEgY29tbWl0IG9iamVjdCB0byBhIE1hcmtkb3duIGxpbmsuXG4gICAqL1xuICBjb21taXRUb0xpbmsoY29tbWl0OiBDYXRlZ29yaXplZENvbW1pdCk6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vZ2l0aHViLmNvbS8ke3RoaXMuZGF0YS5naXRodWIub3duZXJ9LyR7dGhpcy5kYXRhLmdpdGh1Yi5uYW1lfS9jb21taXQvJHtjb21taXQuaGFzaH1gO1xuICAgIHJldHVybiBgWyR7Y29tbWl0LnNob3J0SGFzaH1dKCR7dXJsfSlgO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYSBwdWxsIHJlcXVlc3QgbnVtYmVyIHRvIGEgTWFya2Rvd24gbGluay5cbiAgICovXG4gIHB1bGxSZXF1ZXN0VG9MaW5rKHByTnVtYmVyOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL2dpdGh1Yi5jb20vJHt0aGlzLmRhdGEuZ2l0aHViLm93bmVyfS8ke3RoaXMuZGF0YS5naXRodWIubmFtZX0vcHVsbC8ke3ByTnVtYmVyfWA7XG4gICAgcmV0dXJuIGBbIyR7cHJOdW1iZXJ9XSgke3VybH0pYDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gYSBnaXZlbiBzdHJpbmcgYnkgcmVwbGFjaW5nIGFueSBwdWxsIHJlcXVlc3QgcmVmZXJlbmNlcyB3aXRoIHRoZWlyXG4gICAqIGVxdWl2YWxlbnQgbWFya2Rvd24gbGlua3MuXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZnVsIGZvciB0aGUgY2hhbmdlbG9nIG91dHB1dC4gR2l0aHViIHRyYW5zZm9ybXMgcHVsbCByZXF1ZXN0IHJlZmVyZW5jZXNcbiAgICogYXV0b21hdGljYWxseSBpbiByZWxlYXNlIG5vdGUgZW50cmllcywgaXNzdWVzIGFuZCBwdWxsIHJlcXVlc3RzLCBidXQgbm90IGZvciBwbGFpblxuICAgKiBtYXJrZG93biBmaWxlcyAobGlrZSB0aGUgY2hhbmdlbG9nIGZpbGUpLlxuICAgKi9cbiAgY29udmVydFB1bGxSZXF1ZXN0UmVmZXJlbmNlc1RvTGlua3MoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gY29udGVudC5yZXBsYWNlKC8jKFxcZCspL2csIChfLCBnKSA9PiB0aGlzLnB1bGxSZXF1ZXN0VG9MaW5rKE51bWJlcihnKSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1bGxldGl6ZSBhIHBhcmFncmFwaC5cbiAgICovXG4gIGJ1bGxldGl6ZVRleHQodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJy0gJyArIHRleHQucmVwbGFjZSgvXFxuL2csICdcXG4gICcpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYSBjb21taXQgb2JqZWN0IHRvIGEgTWFya2Rvd24gbGlua2VkIGJhZGdlZC5cbiAgICovXG4gIGNvbW1pdFRvQmFkZ2UoY29tbWl0OiBDYXRlZ29yaXplZENvbW1pdCk6IHN0cmluZyB7XG4gICAgbGV0IGNvbG9yID0gJ3llbGxvdyc7XG4gICAgc3dpdGNoIChjb21taXQudHlwZSkge1xuICAgICAgY2FzZSAnZml4JzpcbiAgICAgICAgY29sb3IgPSAnZ3JlZW4nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2ZlYXQnOlxuICAgICAgICBjb2xvciA9ICdibHVlJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwZXJmJzpcbiAgICAgICAgY29sb3IgPSAnb3JhbmdlJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IHVybCA9IGBodHRwczovL2dpdGh1Yi5jb20vJHt0aGlzLmRhdGEuZ2l0aHViLm93bmVyfS8ke3RoaXMuZGF0YS5naXRodWIubmFtZX0vY29tbWl0LyR7Y29tbWl0Lmhhc2h9YDtcbiAgICBjb25zdCBpbWdTcmMgPSBgaHR0cHM6Ly9pbWcuc2hpZWxkcy5pby9iYWRnZS8ke2NvbW1pdC5zaG9ydEhhc2h9LSR7Y29tbWl0LnR5cGV9LSR7Y29sb3J9YDtcbiAgICByZXR1cm4gYFshWyR7Y29tbWl0LnR5cGV9IC0gJHtjb21taXQuc2hvcnRIYXNofV0oJHtpbWdTcmN9KV0oJHt1cmx9KWA7XG4gIH1cbn1cblxuLyoqXG4gKiBCdWlsZHMgYSBkYXRlIHN0YW1wIGZvciBzdGFtcGluZyBpbiByZWxlYXNlIG5vdGVzLlxuICpcbiAqIFVzZXMgdGhlIGN1cnJlbnQgZGF0ZSwgb3IgYSBwcm92aWRlZCBkYXRlIGluIHRoZSBmb3JtYXQgb2YgWVlZWS1NTS1ERCwgaS5lLiAxOTcwLTExLTA1LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGREYXRlU3RhbXAoZGF0ZSA9IG5ldyBEYXRlKCkpIHtcbiAgY29uc3QgeWVhciA9IGAke2RhdGUuZ2V0RnVsbFllYXIoKX1gO1xuICBjb25zdCBtb250aCA9IGAke2RhdGUuZ2V0TW9udGgoKSArIDF9YC5wYWRTdGFydCgyLCAnMCcpO1xuICBjb25zdCBkYXkgPSBgJHtkYXRlLmdldERhdGUoKX1gLnBhZFN0YXJ0KDIsICcwJyk7XG5cbiAgcmV0dXJuIFt5ZWFyLCBtb250aCwgZGF5XS5qb2luKCctJyk7XG59XG4iXX0=