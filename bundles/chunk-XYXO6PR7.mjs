
import {createRequire as __cjsCompatRequire} from 'module';
const require = __cjsCompatRequire(import.meta.url);


// node_modules/.aspect_rules_js/conventional-commits-parser@6.2.0/node_modules/conventional-commits-parser/dist/regex.js
var nomatchRegex = /(?!.*)/;
function join(parts, joiner) {
  return parts.map((val) => val.trim()).filter(Boolean).join(joiner);
}
function getNotesRegex(noteKeywords, notesPattern) {
  if (!noteKeywords) {
    return nomatchRegex;
  }
  const noteKeywordsSelection = join(noteKeywords, "|");
  if (!notesPattern) {
    return new RegExp(`^[\\s|*]*(${noteKeywordsSelection})[:\\s]+(.*)`, "i");
  }
  return notesPattern(noteKeywordsSelection);
}
function getReferencePartsRegex(issuePrefixes, issuePrefixesCaseSensitive) {
  if (!issuePrefixes) {
    return nomatchRegex;
  }
  const flags = issuePrefixesCaseSensitive ? "g" : "gi";
  return new RegExp(`(?:.*?)??\\s*([\\w-\\.\\/]*?)??(${join(issuePrefixes, "|")})([\\w-]*\\d+)`, flags);
}
function getReferencesRegex(referenceActions) {
  if (!referenceActions) {
    return /()(.+)/gi;
  }
  const joinedKeywords = join(referenceActions, "|");
  return new RegExp(`(${joinedKeywords})(?:\\s+(.*?))(?=(?:${joinedKeywords})|$)`, "gi");
}
function getParserRegexes(options = {}) {
  const notes = getNotesRegex(options.noteKeywords, options.notesPattern);
  const referenceParts = getReferencePartsRegex(options.issuePrefixes, options.issuePrefixesCaseSensitive);
  const references = getReferencesRegex(options.referenceActions);
  return {
    notes,
    referenceParts,
    references,
    mentions: /@([\w-]+)/g,
    url: /\b(?:https?):\/\/(?:www\.)?([-a-zA-Z0-9@:%_+.~#?&//=])+\b/
  };
}

// node_modules/.aspect_rules_js/conventional-commits-parser@6.2.0/node_modules/conventional-commits-parser/dist/utils.js
var SCISSOR = "------------------------ >8 ------------------------";
function trimNewLines(input) {
  const matches = input.match(/[^\r\n]/);
  if (typeof matches?.index !== "number") {
    return "";
  }
  const firstIndex = matches.index;
  let lastIndex = input.length - 1;
  while (input[lastIndex] === "\r" || input[lastIndex] === "\n") {
    lastIndex--;
  }
  return input.substring(firstIndex, lastIndex + 1);
}
function appendLine(src, line) {
  return src ? `${src}
${line || ""}` : line || "";
}
function getCommentFilter(char) {
  return char ? (line) => !line.startsWith(char) : () => true;
}
function truncateToScissor(lines, commentChar) {
  const scissorIndex = lines.indexOf(`${commentChar} ${SCISSOR}`);
  if (scissorIndex === -1) {
    return lines;
  }
  return lines.slice(0, scissorIndex);
}
function gpgFilter(line) {
  return !line.match(/^\s*gpg:/);
}
function assignMatchedCorrespondence(target, matches, correspondence) {
  const { groups } = matches;
  for (let i = 0, len = correspondence.length, key; i < len; i++) {
    key = correspondence[i];
    target[key] = (groups ? groups[key] : matches[i + 1]) || null;
  }
  return target;
}

// node_modules/.aspect_rules_js/conventional-commits-parser@6.2.0/node_modules/conventional-commits-parser/dist/options.js
var defaultOptions = {
  noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
  issuePrefixes: ["#"],
  referenceActions: [
    "close",
    "closes",
    "closed",
    "fix",
    "fixes",
    "fixed",
    "resolve",
    "resolves",
    "resolved"
  ],
  headerPattern: /^(\w*)(?:\(([\w$@.\-*/ ]*)\))?: (.*)$/,
  headerCorrespondence: [
    "type",
    "scope",
    "subject"
  ],
  revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (\w*)\./,
  revertCorrespondence: ["header", "hash"],
  fieldPattern: /^-(.*?)-$/
};

// node_modules/.aspect_rules_js/conventional-commits-parser@6.2.0/node_modules/conventional-commits-parser/dist/CommitParser.js
function createCommitObject(initialData = {}) {
  return {
    merge: null,
    revert: null,
    header: null,
    body: null,
    footer: null,
    notes: [],
    mentions: [],
    references: [],
    ...initialData
  };
}
var CommitParser = class {
  options;
  regexes;
  lines = [];
  lineIndex = 0;
  commit = createCommitObject();
  constructor(options = {}) {
    this.options = {
      ...defaultOptions,
      ...options
    };
    this.regexes = getParserRegexes(this.options);
  }
  currentLine() {
    return this.lines[this.lineIndex];
  }
  nextLine() {
    return this.lines[this.lineIndex++];
  }
  isLineAvailable() {
    return this.lineIndex < this.lines.length;
  }
  parseReference(input, action) {
    const { regexes } = this;
    if (regexes.url.test(input)) {
      return null;
    }
    const matches = regexes.referenceParts.exec(input);
    if (!matches) {
      return null;
    }
    let [raw, repository = null, prefix, issue] = matches;
    let owner = null;
    if (repository) {
      const slashIndex = repository.indexOf("/");
      if (slashIndex !== -1) {
        owner = repository.slice(0, slashIndex);
        repository = repository.slice(slashIndex + 1);
      }
    }
    return {
      raw,
      action,
      owner,
      repository,
      prefix,
      issue
    };
  }
  parseReferences(input) {
    const { regexes } = this;
    const regex = input.match(regexes.references) ? regexes.references : /()(.+)/gi;
    const references = [];
    let matches;
    let action;
    let sentence;
    let reference;
    while (true) {
      matches = regex.exec(input);
      if (!matches) {
        break;
      }
      action = matches[1] || null;
      sentence = matches[2] || "";
      while (true) {
        reference = this.parseReference(sentence, action);
        if (!reference) {
          break;
        }
        references.push(reference);
      }
    }
    return references;
  }
  skipEmptyLines() {
    let line = this.currentLine();
    while (line !== void 0 && !line.trim()) {
      this.nextLine();
      line = this.currentLine();
    }
  }
  parseMerge() {
    const { commit, options } = this;
    const correspondence = options.mergeCorrespondence || [];
    const merge = this.currentLine();
    const matches = merge && options.mergePattern ? merge.match(options.mergePattern) : null;
    if (matches) {
      this.nextLine();
      commit.merge = matches[0] || null;
      assignMatchedCorrespondence(commit, matches, correspondence);
      return true;
    }
    return false;
  }
  parseHeader(isMergeCommit) {
    if (isMergeCommit) {
      this.skipEmptyLines();
    }
    const { commit, options } = this;
    const correspondence = options.headerCorrespondence || [];
    const header = commit.header ?? this.nextLine();
    let matches = null;
    if (header) {
      if (options.breakingHeaderPattern) {
        matches = header.match(options.breakingHeaderPattern);
      }
      if (!matches && options.headerPattern) {
        matches = header.match(options.headerPattern);
      }
    }
    if (header) {
      commit.header = header;
    }
    if (matches) {
      assignMatchedCorrespondence(commit, matches, correspondence);
    }
  }
  parseMeta() {
    const { options, commit } = this;
    if (!options.fieldPattern || !this.isLineAvailable()) {
      return false;
    }
    let matches;
    let field = null;
    let parsed = false;
    while (this.isLineAvailable()) {
      matches = this.currentLine().match(options.fieldPattern);
      if (matches) {
        field = matches[1] || null;
        this.nextLine();
        continue;
      }
      if (field) {
        parsed = true;
        commit[field] = appendLine(commit[field], this.currentLine());
        this.nextLine();
      } else {
        break;
      }
    }
    return parsed;
  }
  parseNotes() {
    const { regexes, commit } = this;
    if (!this.isLineAvailable()) {
      return false;
    }
    const matches = this.currentLine().match(regexes.notes);
    let references = [];
    if (matches) {
      const note = {
        title: matches[1],
        text: matches[2]
      };
      commit.notes.push(note);
      commit.footer = appendLine(commit.footer, this.currentLine());
      this.nextLine();
      while (this.isLineAvailable()) {
        if (this.parseMeta()) {
          return true;
        }
        if (this.parseNotes()) {
          return true;
        }
        references = this.parseReferences(this.currentLine());
        if (references.length) {
          commit.references.push(...references);
        } else {
          note.text = appendLine(note.text, this.currentLine());
        }
        commit.footer = appendLine(commit.footer, this.currentLine());
        this.nextLine();
        if (references.length) {
          break;
        }
      }
      return true;
    }
    return false;
  }
  parseBodyAndFooter(isBody) {
    const { commit } = this;
    if (!this.isLineAvailable()) {
      return isBody;
    }
    const references = this.parseReferences(this.currentLine());
    const isStillBody = !references.length && isBody;
    if (isStillBody) {
      commit.body = appendLine(commit.body, this.currentLine());
    } else {
      commit.references.push(...references);
      commit.footer = appendLine(commit.footer, this.currentLine());
    }
    this.nextLine();
    return isStillBody;
  }
  parseBreakingHeader() {
    const { commit, options } = this;
    if (!options.breakingHeaderPattern || commit.notes.length || !commit.header) {
      return;
    }
    const matches = commit.header.match(options.breakingHeaderPattern);
    if (matches) {
      commit.notes.push({
        title: "BREAKING CHANGE",
        text: matches[3]
      });
    }
  }
  parseMentions(input) {
    const { commit, regexes } = this;
    let matches;
    for (; ; ) {
      matches = regexes.mentions.exec(input);
      if (!matches) {
        break;
      }
      commit.mentions.push(matches[1]);
    }
  }
  parseRevert(input) {
    const { commit, options } = this;
    const correspondence = options.revertCorrespondence || [];
    const matches = options.revertPattern ? input.match(options.revertPattern) : null;
    if (matches) {
      commit.revert = assignMatchedCorrespondence({}, matches, correspondence);
    }
  }
  cleanupCommit() {
    const { commit } = this;
    if (commit.body) {
      commit.body = trimNewLines(commit.body);
    }
    if (commit.footer) {
      commit.footer = trimNewLines(commit.footer);
    }
    commit.notes.forEach((note) => {
      note.text = trimNewLines(note.text);
    });
  }
  /**
   * Parse commit message string into an object.
   * @param input - Commit message string.
   * @returns Commit object.
   */
  parse(input) {
    if (!input.trim()) {
      throw new TypeError("Expected a raw commit");
    }
    const { commentChar } = this.options;
    const commentFilter = getCommentFilter(commentChar);
    const rawLines = trimNewLines(input).split(/\r?\n/);
    const lines = commentChar ? truncateToScissor(rawLines, commentChar).filter((line) => commentFilter(line) && gpgFilter(line)) : rawLines.filter((line) => gpgFilter(line));
    const commit = createCommitObject();
    this.lines = lines;
    this.lineIndex = 0;
    this.commit = commit;
    const isMergeCommit = this.parseMerge();
    this.parseHeader(isMergeCommit);
    if (commit.header) {
      commit.references = this.parseReferences(commit.header);
    }
    let isBody = true;
    while (this.isLineAvailable()) {
      this.parseMeta();
      if (this.parseNotes()) {
        isBody = false;
      }
      if (!this.parseBodyAndFooter(isBody)) {
        isBody = false;
      }
    }
    this.parseBreakingHeader();
    this.parseMentions(input);
    this.parseRevert(input);
    this.cleanupCommit();
    return commit;
  }
};

// node_modules/.aspect_rules_js/conventional-commits-parser@6.2.0/node_modules/conventional-commits-parser/dist/stream.js
import { Transform } from "stream";
function parseCommits(options = {}) {
  const warnOption = options.warn;
  const warn = warnOption === true ? (err) => {
    throw err;
  } : warnOption ? (err) => warnOption(err.toString()) : () => {
  };
  return async function* parse(rawCommits) {
    const parser = new CommitParser(options);
    let rawCommit;
    for await (rawCommit of rawCommits) {
      try {
        yield parser.parse(rawCommit.toString());
      } catch (err) {
        warn(err);
      }
    }
  };
}
function parseCommitsStream(options = {}) {
  return Transform.from(parseCommits(options));
}

export {
  createCommitObject,
  CommitParser,
  parseCommits,
  parseCommitsStream
};
