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
/** List of commit authors which are bots. */
const botsAuthorNames = [
    'dependabot[bot]',
    'Renovate Bot',
    'angular-robot',
    'angular-robot[bot]',
    'Angular Robot',
];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL25vdGVzL2NvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBRSxpQkFBaUIsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBSS9FLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUVwRCx5REFBeUQ7QUFDekQsTUFBTSw0QkFBNEIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztLQUM3RCxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsS0FBSyxpQkFBaUIsQ0FBQyxPQUFPLENBQUM7S0FDdEUsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFNUIsNkNBQTZDO0FBQzdDLE1BQU0sZUFBZSxHQUFHO0lBQ3RCLGlCQUFpQjtJQUNqQixjQUFjO0lBQ2QsZUFBZTtJQUNmLG9CQUFvQjtJQUNwQixlQUFlO0NBQ2hCLENBQUM7QUFvQkYsc0RBQXNEO0FBQ3RELE1BQU0sT0FBTyxhQUFhO0lBZ0J4QixZQUE2QixJQUF1QjtRQUF2QixTQUFJLEdBQUosSUFBSSxDQUFtQjtRQWZwRCx3REFBd0Q7UUFDdkMsZUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztRQUN6RCxnRUFBZ0U7UUFDL0MsaUJBQVksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxFQUFFLENBQUM7UUFDN0QsdUVBQXVFO1FBQzlELFVBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUNqQyxrQ0FBa0M7UUFDekIsWUFBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxD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LEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUVqRCxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NPTU1JVF9UWVBFUywgUmVsZWFzZU5vdGVzTGV2ZWx9IGZyb20gJy4uLy4uL2NvbW1pdC1tZXNzYWdlL2NvbmZpZy5qcyc7XG5pbXBvcnQge0NvbW1pdEZyb21HaXRMb2d9IGZyb20gJy4uLy4uL2NvbW1pdC1tZXNzYWdlL3BhcnNlLmpzJztcbmltcG9ydCB7R2l0aHViQ29uZmlnfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHtSZWxlYXNlTm90ZXNDb25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge2NvbXBhcmVTdHJpbmd9IGZyb20gJy4uLy4uL3V0aWxzL2xvY2FsZS5qcyc7XG5cbi8qKiBMaXN0IG9mIHR5cGVzIHRvIGJlIGluY2x1ZGVkIGluIHRoZSByZWxlYXNlIG5vdGVzLiAqL1xuY29uc3QgdHlwZXNUb0luY2x1ZGVJblJlbGVhc2VOb3RlcyA9IE9iamVjdC52YWx1ZXMoQ09NTUlUX1RZUEVTKVxuICAuZmlsdGVyKCh0eXBlKSA9PiB0eXBlLnJlbGVhc2VOb3Rlc0xldmVsID09PSBSZWxlYXNlTm90ZXNMZXZlbC5WaXNpYmxlKVxuICAubWFwKCh0eXBlKSA9PiB0eXBlLm5hbWUpO1xuXG4vKiogTGlzdCBvZiBjb21taXQgYXV0aG9ycyB3aGljaCBhcmUgYm90cy4gKi9cbmNvbnN0IGJvdHNBdXRob3JOYW1lcyA9IFtcbiAgJ2RlcGVuZGFib3RbYm90XScsXG4gICdSZW5vdmF0ZSBCb3QnLFxuICAnYW5ndWxhci1yb2JvdCcsXG4gICdhbmd1bGFyLXJvYm90W2JvdF0nLFxuICAnQW5ndWxhciBSb2JvdCcsXG5dO1xuXG4vKiogRGF0YSB1c2VkIGZvciBjb250ZXh0IGR1cmluZyByZW5kZXJpbmcuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlckNvbnRleHREYXRhIHtcbiAgdGl0bGU6IHN0cmluZyB8IGZhbHNlO1xuICBncm91cE9yZGVyOiBSZWxlYXNlTm90ZXNDb25maWdbJ2dyb3VwT3JkZXInXTtcbiAgaGlkZGVuU2NvcGVzOiBSZWxlYXNlTm90ZXNDb25maWdbJ2hpZGRlblNjb3BlcyddO1xuICBjYXRlZ29yaXplQ29tbWl0OiBSZWxlYXNlTm90ZXNDb25maWdbJ2NhdGVnb3JpemVDb21taXQnXTtcbiAgY29tbWl0czogQ29tbWl0RnJvbUdpdExvZ1tdO1xuICB2ZXJzaW9uOiBzdHJpbmc7XG4gIGdpdGh1YjogR2l0aHViQ29uZmlnO1xuICBkYXRlPzogRGF0ZTtcbn1cblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIGFuIGNhdGVnb3JpemVkIGNvbW1pdC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2F0ZWdvcml6ZWRDb21taXQgZXh0ZW5kcyBDb21taXRGcm9tR2l0TG9nIHtcbiAgZ3JvdXBOYW1lOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbi8qKiBDb250ZXh0IGNsYXNzIHVzZWQgZm9yIHJlbmRlcmluZyByZWxlYXNlIG5vdGVzLiAqL1xuZXhwb3J0IGNsYXNzIFJlbmRlckNvbnRleHQge1xuICAvKiogQW4gYXJyYXkgb2YgZ3JvdXAgbmFtZXMgaW4gc29ydCBvcmRlciBpZiBkZWZpbmVkLiAqL1xuICBwcml2YXRlIHJlYWRvbmx5IGdyb3VwT3JkZXIgPSB0aGlzLmRhdGEuZ3JvdXBPcmRlciB8fCBbXTtcbiAgLyoqIEFuIGFycmF5IG9mIHNjb3BlcyB0byBoaWRlIGZyb20gdGhlIHJlbGVhc2UgZW50cnkgb3V0cHV0LiAqL1xuICBwcml2YXRlIHJlYWRvbmx5IGhpZGRlblNjb3BlcyA9IHRoaXMuZGF0YS5oaWRkZW5TY29wZXMgfHwgW107XG4gIC8qKiBUaGUgdGl0bGUgb2YgdGhlIHJlbGVhc2UsIG9yIGBmYWxzZWAgaWYgbm8gdGl0bGUgc2hvdWxkIGJlIHVzZWQuICovXG4gIHJlYWRvbmx5IHRpdGxlID0gdGhpcy5kYXRhLnRpdGxlO1xuICAvKiogVGhlIHZlcnNpb24gb2YgdGhlIHJlbGVhc2UuICovXG4gIHJlYWRvbmx5IHZlcnNpb24gPSB0aGlzLmRhdGEudmVyc2lvbjtcbiAgLyoqIFRoZSBkYXRlIHN0YW1wIHN0cmluZyBmb3IgdXNlIGluIHRoZSByZWxlYXNlIG5vdGVzIGVudHJ5LiAqL1xuICByZWFkb25seSBkYXRlU3RhbXAgPSBidWlsZERhdGVTdGFtcCh0aGlzLmRhdGEuZGF0ZSk7XG4gIC8qKiBVUkwgZnJhZ21lbnQgdGhhdCBpcyB1c2VkIHRvIGNyZWF0ZSBhbiBhbmNob3IgZm9yIHRoZSByZWxlYXNlLiAqL1xuICByZWFkb25seSB1cmxGcmFnbWVudEZvclJlbGVhc2UgPSB0aGlzLmRhdGEudmVyc2lvbjtcbiAgLyoqIExpc3Qgb2YgY2F0ZWdvcml6ZWQgY29tbWl0cyBpbiB0aGUgcmVsZWFzZSBwZXJpb2QuICovXG4gIHJlYWRvbmx5IGNvbW1pdHMgPSB0aGlzLl9jYXRlZ29yaXplQ29tbWl0cyh0aGlzLmRhdGEuY29tbWl0cyk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBkYXRhOiBSZW5kZXJDb250ZXh0RGF0YSkge31cblxuICAvKiogR2V0cyBhIGxpc3Qgb2YgY2F0ZWdvcml6ZWQgY29tbWl0cyBmcm9tIGFsbCBjb21taXRzIGluIHRoZSByZWxlYXNlIHBlcmlvZC4gKi9cbiAgX2NhdGVnb3JpemVDb21taXRzKGNvbW1pdHM6IENvbW1pdEZyb21HaXRMb2dbXSk6IENhdGVnb3JpemVkQ29tbWl0W10ge1xuICAgIHJldHVybiBjb21taXRzLm1hcCgoY29tbWl0KSA9PiB7XG4gICAgICBjb25zdCB7ZGVzY3JpcHRpb24sIGdyb3VwTmFtZX0gPSB0aGlzLmRhdGEuY2F0ZWdvcml6ZUNvbW1pdD8uKGNvbW1pdCkgPz8ge307XG4gICAgICByZXR1cm4ge1xuICAgICAgICBncm91cE5hbWU6IGdyb3VwTmFtZSA/PyBjb21taXQuc2NvcGUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbiA/PyBjb21taXQuc3ViamVjdCxcbiAgICAgICAgLi4uY29tbWl0LFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wYXJhdG9yIHVzZWQgZm9yIHNvcnRpbmcgY29tbWl0cyB3aXRoaW4gYSByZWxlYXNlIG5vdGVzIGdyb3VwLiBDb21taXRzXG4gICAqIGFyZSBzb3J0ZWQgYWxwaGFiZXRpY2FsbHkgYmFzZWQgb24gdGhlaXIgdHlwZS4gQ29tbWl0cyBoYXZpbmcgdGhlIHNhbWUgdHlwZVxuICAgKiB3aWxsIGJlIHNvcnRlZCBhbHBoYWJldGljYWxseSBiYXNlZCBvbiB0aGVpciBkZXRlcm1pbmVkIGRlc2NyaXB0aW9uXG4gICAqL1xuICBwcml2YXRlIF9jb21taXRzV2l0aGluR3JvdXBDb21wYXJhdG9yID0gKGE6IENhdGVnb3JpemVkQ29tbWl0LCBiOiBDYXRlZ29yaXplZENvbW1pdCk6IG51bWJlciA9PiB7XG4gICAgY29uc3QgdHlwZUNvbXBhcmVPcmRlciA9IGNvbXBhcmVTdHJpbmcoYS50eXBlLCBiLnR5cGUpO1xuICAgIGlmICh0eXBlQ29tcGFyZU9yZGVyID09PSAwKSB7XG4gICAgICByZXR1cm4gY29tcGFyZVN0cmluZyhhLmRlc2NyaXB0aW9uLCBiLmRlc2NyaXB0aW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIHR5cGVDb21wYXJlT3JkZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIE9yZ2FuaXplcyBhbmQgc29ydHMgdGhlIGNvbW1pdHMgaW50byBncm91cHMgb2YgY29tbWl0cy5cbiAgICpcbiAgICogR3JvdXBzIGFyZSBzb3J0ZWQgZWl0aGVyIGJ5IGRlZmF1bHQgYEFycmF5LnNvcnRgIG9yZGVyLCBvciB1c2luZyB0aGUgcHJvdmlkZWQgZ3JvdXAgb3JkZXIgZnJvbVxuICAgKiB0aGUgY29uZmlndXJhdGlvbi4gQ29tbWl0cyBhcmUgb3JkZXIgaW4gdGhlIHNhbWUgb3JkZXIgd2l0aGluIGVhY2ggZ3JvdXBzIGNvbW1pdCBsaXN0IGFzIHRoZXlcbiAgICogYXBwZWFyIGluIHRoZSBwcm92aWRlZCBsaXN0IG9mIGNvbW1pdHMuXG4gICAqICovXG4gIGFzQ29tbWl0R3JvdXBzKGNvbW1pdHM6IENhdGVnb3JpemVkQ29tbWl0W10pIHtcbiAgICAvKiogVGhlIGRpc2NvdmVyZWQgZ3JvdXBzIHRvIG9yZ2FuaXplIGludG8uICovXG4gICAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxzdHJpbmcsIENhdGVnb3JpemVkQ29tbWl0W10+KCk7XG5cbiAgICAvLyBQbGFjZSBlYWNoIGNvbW1pdCBpbiB0aGUgbGlzdCBpbnRvIGl0cyBncm91cC5cbiAgICBjb21taXRzLmZvckVhY2goKGNvbW1pdCkgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gY29tbWl0Lmdyb3VwTmFtZTtcbiAgICAgIGNvbnN0IGdyb3VwQ29tbWl0cyA9IGdyb3Vwcy5nZXQoa2V5KSB8fCBbXTtcbiAgICAgIGdyb3Vwcy5zZXQoa2V5LCBncm91cENvbW1pdHMpO1xuICAgICAgZ3JvdXBDb21taXRzLnB1c2goY29tbWl0KTtcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIExpc3Qgb2YgZGlzY292ZXJlZCBjb21taXQgZ3JvdXBzIHdoaWNoIGFyZSBzb3J0ZWQgaW4gYWxwaGFudW1lcmljIG9yZGVyXG4gICAgICogYmFzZWQgb24gdGhlIGdyb3VwIHRpdGxlLlxuICAgICAqL1xuICAgIGNvbnN0IGNvbW1pdEdyb3VwcyA9IEFycmF5LmZyb20oZ3JvdXBzLmVudHJpZXMoKSlcbiAgICAgIC5tYXAoKFt0aXRsZSwgZ3JvdXBDb21taXRzXSkgPT4gKHtcbiAgICAgICAgdGl0bGUsXG4gICAgICAgIGNvbW1pdHM6IGdyb3VwQ29tbWl0cy5zb3J0KHRoaXMuX2NvbW1pdHNXaXRoaW5Hcm91cENvbXBhcmF0b3IpLFxuICAgICAgfSkpXG4gICAgICAuc29ydCgoYSwgYikgPT4gY29tcGFyZVN0cmluZyhhLnRpdGxlLCBiLnRpdGxlKSk7XG5cbiAgICAvLyBJZiB0aGUgY29uZmlndXJhdGlvbiBwcm92aWRlcyBhIHNvcnRpbmcgb3JkZXIsIHVwZGF0ZWQgdGhlIHNvcnRlZCBsaXN0IG9mIGdyb3VwIGtleXMgdG9cbiAgICAvLyBzYXRpc2Z5IHRoZSBvcmRlciBvZiB0aGUgZ3JvdXBzIHByb3ZpZGVkIGluIHRoZSBsaXN0IHdpdGggYW55IGdyb3VwcyBub3QgZm91bmQgaW4gdGhlIGxpc3QgYXRcbiAgICAvLyB0aGUgZW5kIG9mIHRoZSBzb3J0ZWQgbGlzdC5cbiAgICBpZiAodGhpcy5ncm91cE9yZGVyLmxlbmd0aCkge1xuICAgICAgZm9yIChjb25zdCBncm91cFRpdGxlIG9mIHRoaXMuZ3JvdXBPcmRlci5yZXZlcnNlKCkpIHtcbiAgICAgICAgY29uc3QgY3VycmVudElkeCA9IGNvbW1pdEdyb3Vwcy5maW5kSW5kZXgoKGspID0+IGsudGl0bGUgPT09IGdyb3VwVGl0bGUpO1xuICAgICAgICBpZiAoY3VycmVudElkeCAhPT0gLTEpIHtcbiAgICAgICAgICBjb25zdCByZW1vdmVkR3JvdXBzID0gY29tbWl0R3JvdXBzLnNwbGljZShjdXJyZW50SWR4LCAxKTtcbiAgICAgICAgICBjb21taXRHcm91cHMuc3BsaWNlKDAsIDAsIC4uLnJlbW92ZWRHcm91cHMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb21taXRHcm91cHM7XG4gIH1cblxuICAvKiogV2hldGhlciB0aGUgc3BlY2lmaWVkIGNvbW1pdCBjb250YWlucyBicmVha2luZyBjaGFuZ2VzLiAqL1xuICBoYXNCcmVha2luZ0NoYW5nZXMoY29tbWl0OiBDYXRlZ29yaXplZENvbW1pdCkge1xuICAgIHJldHVybiBjb21taXQuYnJlYWtpbmdDaGFuZ2VzLmxlbmd0aCAhPT0gMDtcbiAgfVxuXG4gIC8qKiBXaGV0aGVyIHRoZSBzcGVjaWZpZWQgY29tbWl0IGNvbnRhaW5zIGRlcHJlY2F0aW9ucy4gKi9cbiAgaGFzRGVwcmVjYXRpb25zKGNvbW1pdDogQ2F0ZWdvcml6ZWRDb21taXQpIHtcbiAgICByZXR1cm4gY29tbWl0LmRlcHJlY2F0aW9ucy5sZW5ndGggIT09IDA7XG4gIH1cblxuICAvKipcbiAgICogQSBmaWx0ZXIgZnVuY3Rpb24gZm9yIGZpbHRlcmluZyBhIGxpc3Qgb2YgY29tbWl0cyB0byBvbmx5IGluY2x1ZGUgY29tbWl0cyB3aGljaFxuICAgKiBzaG91bGQgYXBwZWFyIGluIHJlbGVhc2Ugbm90ZXMuXG4gICAqL1xuICBpbmNsdWRlSW5SZWxlYXNlTm90ZXMoKSB7XG4gICAgcmV0dXJuIChjb21taXQ6IENhdGVnb3JpemVkQ29tbWl0KSA9PiB7XG4gICAgICBpZiAodGhpcy5oaWRkZW5TY29wZXMuaW5jbHVkZXMoY29tbWl0LnNjb3BlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbW1pdHMgd2hpY2ggY29udGFpbiBicmVha2luZyBjaGFuZ2VzIG9yIGRlcHJlY2F0aW9ucyBhcmUgYWx3YXlzIGluY2x1ZGVkXG4gICAgICAvLyBpbiByZWxlYXNlIG5vdGVzLiBUaGUgYnJlYWtpbmcgY2hhbmdlIG9yIGRlcHJlY2F0aW9ucyB3aWxsIGFscmVhZHkgYmUgbGlzdGVkXG4gICAgICAvLyBpbiBhIGRlZGljYXRlZCBzZWN0aW9uIGJ1dCBpdCBpcyBzdGlsbCB2YWx1YWJsZSB0byBpbmNsdWRlIHRoZSBhY3R1YWwgY29tbWl0LlxuICAgICAgaWYgKHRoaXMuaGFzQnJlYWtpbmdDaGFuZ2VzKGNvbW1pdCkgfHwgdGhpcy5oYXNEZXByZWNhdGlvbnMoY29tbWl0KSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHR5cGVzVG9JbmNsdWRlSW5SZWxlYXNlTm90ZXMuaW5jbHVkZXMoY29tbWl0LnR5cGUpO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQSBmaWx0ZXIgZnVuY3Rpb24gZm9yIGZpbHRlcmluZyBhIGxpc3Qgb2YgY29tbWl0cyB0byBvbmx5IGluY2x1ZGUgY29tbWl0cyB3aGljaCBjb250YWluIGFcbiAgICogdW5pcXVlIHZhbHVlIGZvciB0aGUgcHJvdmlkZWQgZmllbGQgYWNyb3NzIGFsbCBjb21taXRzIGluIHRoZSBsaXN0LlxuICAgKi9cbiAgdW5pcXVlKGZpZWxkOiBrZXlvZiBDYXRlZ29yaXplZENvbW1pdCkge1xuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8Q2F0ZWdvcml6ZWRDb21taXRbdHlwZW9mIGZpZWxkXT4oKTtcbiAgICByZXR1cm4gKGNvbW1pdDogQ2F0ZWdvcml6ZWRDb21taXQpID0+IHtcbiAgICAgIGNvbnN0IGluY2x1ZGUgPSAhc2V0Lmhhcyhjb21taXRbZmllbGRdKTtcbiAgICAgIHNldC5hZGQoY29tbWl0W2ZpZWxkXSk7XG4gICAgICByZXR1cm4gaW5jbHVkZTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYSBjb21taXQgb2JqZWN0IHRvIGEgTWFya2Rvd24gbGluay5cbiAgICovXG4gIGNvbW1pdFRvTGluayhjb21taXQ6IENhdGVnb3JpemVkQ29tbWl0KTogc3RyaW5nIHtcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9naXRodWIuY29tLyR7dGhpcy5kYXRhLmdpdGh1Yi5vd25lcn0vJHt0aGlzLmRhdGEuZ2l0aHViLm5hbWV9L2NvbW1pdC8ke2NvbW1pdC5oYXNofWA7XG4gICAgcmV0dXJuIGBbJHtjb21taXQuc2hvcnRIYXNofV0oJHt1cmx9KWA7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhIHB1bGwgcmVxdWVzdCBudW1iZXIgdG8gYSBNYXJrZG93biBsaW5rLlxuICAgKi9cbiAgcHVsbFJlcXVlc3RUb0xpbmsocHJOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vZ2l0aHViLmNvbS8ke3RoaXMuZGF0YS5naXRodWIub3duZXJ9LyR7dGhpcy5kYXRhLmdpdGh1Yi5uYW1lfS9wdWxsLyR7cHJOdW1iZXJ9YDtcbiAgICByZXR1cm4gYFsjJHtwck51bWJlcn1dKCR7dXJsfSlgO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBhIGdpdmVuIHN0cmluZyBieSByZXBsYWNpbmcgYW55IHB1bGwgcmVxdWVzdCByZWZlcmVuY2VzIHdpdGggdGhlaXJcbiAgICogZXF1aXZhbGVudCBtYXJrZG93biBsaW5rcy5cbiAgICpcbiAgICogVGhpcyBpcyB1c2VmdWwgZm9yIHRoZSBjaGFuZ2Vsb2cgb3V0cHV0LiBHaXRodWIgdHJhbnNmb3JtcyBwdWxsIHJlcXVlc3QgcmVmZXJlbmNlc1xuICAgKiBhdXRvbWF0aWNhbGx5IGluIHJlbGVhc2Ugbm90ZSBlbnRyaWVzLCBpc3N1ZXMgYW5kIHB1bGwgcmVxdWVzdHMsIGJ1dCBub3QgZm9yIHBsYWluXG4gICAqIG1hcmtkb3duIGZpbGVzIChsaWtlIHRoZSBjaGFuZ2Vsb2cgZmlsZSkuXG4gICAqL1xuICBjb252ZXJ0UHVsbFJlcXVlc3RSZWZlcmVuY2VzVG9MaW5rcyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UoLyMoXFxkKykvZywgKF8sIGcpID0+IHRoaXMucHVsbFJlcXVlc3RUb0xpbmsoTnVtYmVyKGcpKSk7XG4gIH1cblxuICAvKipcbiAgICogQnVsbGV0aXplIGEgcGFyYWdyYXBoLlxuICAgKi9cbiAgYnVsbGV0aXplVGV4dCh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiAnLSAnICsgdGV4dC5yZXBsYWNlKC9cXG4vZywgJ1xcbiAgJyk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhIGNvbW1pdCBvYmplY3QgdG8gYSBNYXJrZG93biBsaW5rZWQgYmFkZ2VkLlxuICAgKi9cbiAgY29tbWl0VG9CYWRnZShjb21taXQ6IENhdGVnb3JpemVkQ29tbWl0KTogc3RyaW5nIHtcbiAgICBsZXQgY29sb3IgPSAneWVsbG93JztcbiAgICBzd2l0Y2ggKGNvbW1pdC50eXBlKSB7XG4gICAgICBjYXNlICdmaXgnOlxuICAgICAgICBjb2xvciA9ICdncmVlbic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZmVhdCc6XG4gICAgICAgIGNvbG9yID0gJ2JsdWUnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3BlcmYnOlxuICAgICAgICBjb2xvciA9ICdvcmFuZ2UnO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vZ2l0aHViLmNvbS8ke3RoaXMuZGF0YS5naXRodWIub3duZXJ9LyR7dGhpcy5kYXRhLmdpdGh1Yi5uYW1lfS9jb21taXQvJHtjb21taXQuaGFzaH1gO1xuICAgIGNvbnN0IGltZ1NyYyA9IGBodHRwczovL2ltZy5zaGllbGRzLmlvL2JhZGdlLyR7Y29tbWl0LnNob3J0SGFzaH0tJHtjb21taXQudHlwZX0tJHtjb2xvcn1gO1xuICAgIHJldHVybiBgWyFbJHtjb21taXQudHlwZX0gLSAke2NvbW1pdC5zaG9ydEhhc2h9XSgke2ltZ1NyY30pXSgke3VybH0pYDtcbiAgfVxufVxuXG4vKipcbiAqIEJ1aWxkcyBhIGRhdGUgc3RhbXAgZm9yIHN0YW1waW5nIGluIHJlbGVhc2Ugbm90ZXMuXG4gKlxuICogVXNlcyB0aGUgY3VycmVudCBkYXRlLCBvciBhIHByb3ZpZGVkIGRhdGUgaW4gdGhlIGZvcm1hdCBvZiBZWVlZLU1NLURELCBpLmUuIDE5NzAtMTEtMDUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZERhdGVTdGFtcChkYXRlID0gbmV3IERhdGUoKSkge1xuICBjb25zdCB5ZWFyID0gYCR7ZGF0ZS5nZXRGdWxsWWVhcigpfWA7XG4gIGNvbnN0IG1vbnRoID0gYCR7ZGF0ZS5nZXRNb250aCgpICsgMX1gLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IGRheSA9IGAke2RhdGUuZ2V0RGF0ZSgpfWAucGFkU3RhcnQoMiwgJzAnKTtcblxuICByZXR1cm4gW3llYXIsIG1vbnRoLCBkYXldLmpvaW4oJy0nKTtcbn1cbiJdfQ==