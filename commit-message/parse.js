import { CommitParser, } from 'conventional-commits-parser';
const commitFields = {
    hash: '%H',
    shortHash: '%h',
    author: '%aN',
};
export const commitFieldsAsFormat = (fields) => {
    return Object.entries(fields)
        .map(([key, value]) => `%n-${key}-%n${value}`)
        .join('');
};
export const gitLogFormatForParsing = `%B${commitFieldsAsFormat(commitFields)}`;
var NoteSections;
(function (NoteSections) {
    NoteSections["BREAKING_CHANGE"] = "BREAKING CHANGE";
    NoteSections["DEPRECATED"] = "DEPRECATED";
})(NoteSections || (NoteSections = {}));
const FIXUP_PREFIX_RE = /^fixup! /i;
const SQUASH_PREFIX_RE = /^squash! /i;
const REVERT_PREFIX_RE = /^revert:? /i;
const headerPattern = /^(\w+)(?:\(([^)]+)\))?: (.*)$/;
const headerCorrespondence = ['type', 'scope', 'subject'];
const parseOptions = {
    commentChar: '#',
    headerPattern,
    headerCorrespondence,
    noteKeywords: [NoteSections.BREAKING_CHANGE, NoteSections.DEPRECATED],
    notesPattern: (keywords) => new RegExp(`^\\s*(${keywords}): ?(.*)`),
};
const commitParser = new CommitParser(parseOptions);
export const parseCommitMessage = parseInternal;
export const parseCommitFromGitLog = parseInternal;
function parseInternal(fullText) {
    fullText = fullText.toString().trim();
    const commit = commitParser.parse(fullText);
    const breakingChanges = [];
    const deprecations = [];
    const header = (commit.header || '')
        .replace(FIXUP_PREFIX_RE, '')
        .replace(SQUASH_PREFIX_RE, '')
        .replace(REVERT_PREFIX_RE, '');
    for (const note of commit.notes) {
        switch (note.title) {
            case NoteSections.BREAKING_CHANGE:
                breakingChanges.push(note);
                break;
            case NoteSections.DEPRECATED:
                deprecations.push(note);
                break;
        }
    }
    return {
        fullText,
        breakingChanges,
        deprecations,
        header,
        body: commit.body || '',
        footer: commit.footer || '',
        originalHeader: commit.header || '',
        references: commit.references,
        scope: commit['scope'] || '',
        subject: commit['subject'] || '',
        type: commit['type'] || '',
        isFixup: FIXUP_PREFIX_RE.test(fullText),
        isSquash: SQUASH_PREFIX_RE.test(fullText),
        isRevert: REVERT_PREFIX_RE.test(fullText),
        author: commit['author'] || undefined,
        hash: commit['hash'] || undefined,
        shortHash: commit['shortHash'] || undefined,
    };
}
//# sourceMappingURL=parse.js.map