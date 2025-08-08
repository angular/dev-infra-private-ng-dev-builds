import { COMMIT_TYPES, ReleaseNotesLevel } from '../../commit-message/config.js';
import { compareString } from '../../utils/locale.js';
const typesToIncludeInReleaseNotes = Object.values(COMMIT_TYPES)
    .filter((type) => type.releaseNotesLevel === ReleaseNotesLevel.Visible)
    .map((type) => type.name);
export class RenderContext {
    constructor(data) {
        this.data = data;
        this.groupOrder = this.data.groupOrder || [];
        this.hiddenScopes = this.data.hiddenScopes || [];
        this.title = this.data.title;
        this.version = this.data.version;
        this.dateStamp = buildDateStamp(this.data.date);
        this.urlFragmentForRelease = this.data.version;
        this.commits = this._categorizeCommits(this.data.commits);
        this._commitsWithinGroupComparator = (a, b) => {
            const typeCompareOrder = compareString(a.type, b.type);
            if (typeCompareOrder === 0) {
                return compareString(a.description, b.description);
            }
            return typeCompareOrder;
        };
    }
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
    asCommitGroups(commits) {
        const groups = new Map();
        commits.forEach((commit) => {
            const key = commit.groupName;
            const groupCommits = groups.get(key) || [];
            groups.set(key, groupCommits);
            groupCommits.push(commit);
        });
        const commitGroups = Array.from(groups.entries())
            .map(([title, groupCommits]) => ({
            title,
            commits: groupCommits.sort(this._commitsWithinGroupComparator),
        }))
            .sort((a, b) => compareString(a.title, b.title));
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
    hasBreakingChanges(commit) {
        return commit.breakingChanges.length !== 0;
    }
    hasDeprecations(commit) {
        return commit.deprecations.length !== 0;
    }
    includeInReleaseNotes() {
        return (commit) => {
            if (this.hiddenScopes.includes(commit.scope)) {
                return false;
            }
            if (this.hasBreakingChanges(commit) || this.hasDeprecations(commit)) {
                return true;
            }
            return typesToIncludeInReleaseNotes.includes(commit.type);
        };
    }
    unique(field) {
        const set = new Set();
        return (commit) => {
            const include = !set.has(commit[field]);
            set.add(commit[field]);
            return include;
        };
    }
    commitToLink(commit) {
        const url = `https://github.com/${this.data.github.owner}/${this.data.github.name}/commit/${commit.hash}`;
        return `[${commit.shortHash}](${url})`;
    }
    pullRequestToLink(prNumber) {
        const url = `https://github.com/${this.data.github.owner}/${this.data.github.name}/pull/${prNumber}`;
        return `[#${prNumber}](${url})`;
    }
    convertPullRequestReferencesToLinks(content) {
        return content.replace(/#(\d+)/g, (_, g) => this.pullRequestToLink(Number(g)));
    }
    bulletizeText(text) {
        return '- ' + text.replace(/\n/g, '\n  ');
    }
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
export function buildDateStamp(date = new Date()) {
    const year = `${date.getFullYear()}`;
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return [year, month, day].join('-');
}
//# sourceMappingURL=context.js.map