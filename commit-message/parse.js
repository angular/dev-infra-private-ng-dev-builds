import { sync as parse } from 'conventional-commits-parser';
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
export const parseCommitMessage = parseInternal;
export const parseCommitFromGitLog = parseInternal;
function parseInternal(fullText) {
    fullText = fullText.toString();
    const strippedCommitMsg = fullText
        .replace(FIXUP_PREFIX_RE, '')
        .replace(SQUASH_PREFIX_RE, '')
        .replace(REVERT_PREFIX_RE, '');
    const commit = parse(strippedCommitMsg, parseOptions);
    const breakingChanges = [];
    const deprecations = [];
    commit.notes.forEach((note) => {
        if (note.title === NoteSections.BREAKING_CHANGE) {
            breakingChanges.push(note);
        }
        else if (note.title === NoteSections.DEPRECATED) {
            deprecations.push(note);
        }
    });
    return {
        fullText,
        breakingChanges,
        deprecations,
        body: commit.body || '',
        footer: commit.footer || '',
        header: commit.header || '',
        references: commit.references,
        scope: commit.scope || '',
        subject: commit.subject || '',
        type: commit.type || '',
        isFixup: FIXUP_PREFIX_RE.test(fullText),
        isSquash: SQUASH_PREFIX_RE.test(fullText),
        isRevert: REVERT_PREFIX_RE.test(fullText),
        author: commit['author'] || undefined,
        hash: commit['hash'] || undefined,
        shortHash: commit['shortHash'] || undefined,
    };
}
//# sourceMappingURL=parse.js.map