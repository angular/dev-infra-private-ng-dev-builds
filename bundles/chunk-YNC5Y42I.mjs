
import {createRequire as __cjsCompatRequire} from 'module';
const require = __cjsCompatRequire(import.meta.url);

import {
  __commonJS,
  __require
} from "./chunk-UHIZKGIY.mjs";

// node_modules/.aspect_rules_js/conventional-commits-parser@5.0.0/node_modules/conventional-commits-parser/lib/parser.js
var require_parser = __commonJS({
  "node_modules/.aspect_rules_js/conventional-commits-parser@5.0.0/node_modules/conventional-commits-parser/lib/parser.js"(exports, module) {
    "use strict";
    var CATCH_ALL = /()(.+)/gi;
    var SCISSOR = "# ------------------------ >8 ------------------------";
    function trimOffNewlines(input) {
      const result = input.match(/[^\r\n]/);
      if (!result) {
        return "";
      }
      const firstIndex = result.index;
      let lastIndex = input.length - 1;
      while (input[lastIndex] === "\r" || input[lastIndex] === "\n") {
        lastIndex--;
      }
      return input.substring(firstIndex, lastIndex + 1);
    }
    function append(src, line) {
      if (src) {
        src += "\n" + line;
      } else {
        src = line;
      }
      return src;
    }
    function getCommentFilter(char) {
      return function(line) {
        return line.charAt(0) !== char;
      };
    }
    function truncateToScissor(lines) {
      const scissorIndex = lines.indexOf(SCISSOR);
      if (scissorIndex === -1) {
        return lines;
      }
      return lines.slice(0, scissorIndex);
    }
    function getReferences(input, regex) {
      const references = [];
      let referenceSentences;
      let referenceMatch;
      const reApplicable = input.match(regex.references) !== null ? regex.references : CATCH_ALL;
      while (referenceSentences = reApplicable.exec(input)) {
        const action = referenceSentences[1] || null;
        const sentence = referenceSentences[2];
        while (referenceMatch = regex.referenceParts.exec(sentence)) {
          let owner = null;
          let repository = referenceMatch[1] || "";
          const ownerRepo = repository.split("/");
          if (ownerRepo.length > 1) {
            owner = ownerRepo.shift();
            repository = ownerRepo.join("/");
          }
          const reference = {
            action,
            owner,
            repository: repository || null,
            issue: referenceMatch[3],
            raw: referenceMatch[0],
            prefix: referenceMatch[2]
          };
          references.push(reference);
        }
      }
      return references;
    }
    function passTrough() {
      return true;
    }
    function parser(raw, options, regex) {
      if (!raw || !raw.trim()) {
        throw new TypeError("Expected a raw commit");
      }
      if (!options || typeof options === "object" && !Object.keys(options).length) {
        throw new TypeError("Expected options");
      }
      if (!regex) {
        throw new TypeError("Expected regex");
      }
      let currentProcessedField;
      let mentionsMatch;
      const otherFields = {};
      const commentFilter = typeof options.commentChar === "string" ? getCommentFilter(options.commentChar) : passTrough;
      const gpgFilter = (line) => !line.match(/^\s*gpg:/);
      const rawLines = trimOffNewlines(raw).split(/\r?\n/);
      const lines = truncateToScissor(rawLines).filter(commentFilter).filter(gpgFilter);
      let continueNote = false;
      let isBody = true;
      const headerCorrespondence = options.headerCorrespondence?.map(function(part) {
        return part.trim();
      }) || [];
      const revertCorrespondence = options.revertCorrespondence?.map(function(field) {
        return field.trim();
      }) || [];
      const mergeCorrespondence = options.mergeCorrespondence?.map(function(field) {
        return field.trim();
      }) || [];
      let body = null;
      let footer = null;
      let header = null;
      const mentions = [];
      let merge = null;
      const notes = [];
      const references = [];
      let revert = null;
      if (lines.length === 0) {
        return {
          body,
          footer,
          header,
          mentions,
          merge,
          notes,
          references,
          revert,
          scope: null,
          subject: null,
          type: null
        };
      }
      merge = lines.shift();
      const mergeParts = {};
      const headerParts = {};
      body = "";
      footer = "";
      const mergeMatch = merge.match(options.mergePattern);
      if (mergeMatch && options.mergePattern) {
        merge = mergeMatch[0];
        header = lines.shift();
        while (header !== void 0 && !header.trim()) {
          header = lines.shift();
        }
        if (!header) {
          header = "";
        }
        mergeCorrespondence.forEach(function(partName, index) {
          const partValue = mergeMatch[index + 1] || null;
          mergeParts[partName] = partValue;
        });
      } else {
        header = merge;
        merge = null;
        mergeCorrespondence.forEach(function(partName) {
          mergeParts[partName] = null;
        });
      }
      const headerMatch = header.match(options.headerPattern);
      if (headerMatch) {
        headerCorrespondence.forEach(function(partName, index) {
          const partValue = headerMatch[index + 1] || null;
          headerParts[partName] = partValue;
        });
      } else {
        headerCorrespondence.forEach(function(partName) {
          headerParts[partName] = null;
        });
      }
      references.push(...getReferences(header, {
        references: regex.references,
        referenceParts: regex.referenceParts
      }));
      lines.forEach(function(line) {
        if (options.fieldPattern) {
          const fieldMatch = options.fieldPattern.exec(line);
          if (fieldMatch) {
            currentProcessedField = fieldMatch[1];
            return;
          }
          if (currentProcessedField) {
            otherFields[currentProcessedField] = append(otherFields[currentProcessedField], line);
            return;
          }
        }
        let referenceMatched;
        const notesMatch = line.match(regex.notes);
        if (notesMatch) {
          continueNote = true;
          isBody = false;
          footer = append(footer, line);
          const note = {
            title: notesMatch[1],
            text: notesMatch[2]
          };
          notes.push(note);
          return;
        }
        const lineReferences = getReferences(line, {
          references: regex.references,
          referenceParts: regex.referenceParts
        });
        if (lineReferences.length > 0) {
          isBody = false;
          referenceMatched = true;
          continueNote = false;
        }
        Array.prototype.push.apply(references, lineReferences);
        if (referenceMatched) {
          footer = append(footer, line);
          return;
        }
        if (continueNote) {
          notes[notes.length - 1].text = append(notes[notes.length - 1].text, line);
          footer = append(footer, line);
          return;
        }
        if (isBody) {
          body = append(body, line);
        } else {
          footer = append(footer, line);
        }
      });
      if (options.breakingHeaderPattern && notes.length === 0) {
        const breakingHeader = header.match(options.breakingHeaderPattern);
        if (breakingHeader) {
          const noteText = breakingHeader[3];
          notes.push({
            title: "BREAKING CHANGE",
            text: noteText
          });
        }
      }
      while (mentionsMatch = regex.mentions.exec(raw)) {
        mentions.push(mentionsMatch[1]);
      }
      const revertMatch = raw.match(options.revertPattern);
      if (revertMatch) {
        revert = {};
        revertCorrespondence.forEach(function(partName, index) {
          const partValue = revertMatch[index + 1] || null;
          revert[partName] = partValue;
        });
      } else {
        revert = null;
      }
      notes.forEach(function(note) {
        note.text = trimOffNewlines(note.text);
      });
      const msg = {
        ...headerParts,
        ...mergeParts,
        merge,
        header,
        body: body ? trimOffNewlines(body) : null,
        footer: footer ? trimOffNewlines(footer) : null,
        notes,
        references,
        mentions,
        revert,
        ...otherFields
      };
      return msg;
    }
    module.exports = parser;
  }
});

// node_modules/.aspect_rules_js/conventional-commits-parser@5.0.0/node_modules/conventional-commits-parser/lib/regex.js
var require_regex = __commonJS({
  "node_modules/.aspect_rules_js/conventional-commits-parser@5.0.0/node_modules/conventional-commits-parser/lib/regex.js"(exports, module) {
    "use strict";
    var reNomatch = /(?!.*)/;
    function join(array, joiner) {
      return array.map(function(val) {
        return val.trim();
      }).filter(function(val) {
        return val.length;
      }).join(joiner);
    }
    function getNotesRegex(noteKeywords, notesPattern) {
      if (!noteKeywords) {
        return reNomatch;
      }
      const noteKeywordsSelection = join(noteKeywords, "|");
      if (!notesPattern) {
        return new RegExp("^[\\s|*]*(" + noteKeywordsSelection + ")[:\\s]+(.*)", "i");
      }
      return notesPattern(noteKeywordsSelection);
    }
    function getReferencePartsRegex(issuePrefixes, issuePrefixesCaseSensitive) {
      if (!issuePrefixes) {
        return reNomatch;
      }
      const flags = issuePrefixesCaseSensitive ? "g" : "gi";
      return new RegExp("(?:.*?)??\\s*([\\w-\\.\\/]*?)??(" + join(issuePrefixes, "|") + ")([\\w-]*\\d+)", flags);
    }
    function getReferencesRegex(referenceActions) {
      if (!referenceActions) {
        return /()(.+)/gi;
      }
      const joinedKeywords = join(referenceActions, "|");
      return new RegExp("(" + joinedKeywords + ")(?:\\s+(.*?))(?=(?:" + joinedKeywords + ")|$)", "gi");
    }
    module.exports = function(options) {
      options = options || {};
      const reNotes = getNotesRegex(options.noteKeywords, options.notesPattern);
      const reReferenceParts = getReferencePartsRegex(options.issuePrefixes, options.issuePrefixesCaseSensitive);
      const reReferences = getReferencesRegex(options.referenceActions);
      return {
        notes: reNotes,
        referenceParts: reReferenceParts,
        references: reReferences,
        mentions: /@([\w-]+)/g
      };
    };
  }
});

// node_modules/.aspect_rules_js/conventional-commits-parser@5.0.0/node_modules/conventional-commits-parser/index.js
var require_conventional_commits_parser = __commonJS({
  "node_modules/.aspect_rules_js/conventional-commits-parser@5.0.0/node_modules/conventional-commits-parser/index.js"(exports, module) {
    var { Transform } = __require("stream");
    var parser = require_parser();
    var regex = require_regex();
    function assignOpts(options) {
      options = {
        headerPattern: /^(\w*)(?:\(([\w$.\-*/ ]*)\))?: (.*)$/,
        headerCorrespondence: ["type", "scope", "subject"],
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
        issuePrefixes: ["#"],
        noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
        fieldPattern: /^-(.*?)-$/,
        revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (\w*)\./,
        revertCorrespondence: ["header", "hash"],
        warn: function() {
        },
        mergePattern: null,
        mergeCorrespondence: null,
        ...options
      };
      if (typeof options.headerPattern === "string") {
        options.headerPattern = new RegExp(options.headerPattern);
      }
      if (typeof options.headerCorrespondence === "string") {
        options.headerCorrespondence = options.headerCorrespondence.split(",");
      }
      if (typeof options.referenceActions === "string") {
        options.referenceActions = options.referenceActions.split(",");
      }
      if (typeof options.issuePrefixes === "string") {
        options.issuePrefixes = options.issuePrefixes.split(",");
      }
      if (typeof options.noteKeywords === "string") {
        options.noteKeywords = options.noteKeywords.split(",");
      }
      if (typeof options.fieldPattern === "string") {
        options.fieldPattern = new RegExp(options.fieldPattern);
      }
      if (typeof options.revertPattern === "string") {
        options.revertPattern = new RegExp(options.revertPattern);
      }
      if (typeof options.revertCorrespondence === "string") {
        options.revertCorrespondence = options.revertCorrespondence.split(",");
      }
      if (typeof options.mergePattern === "string") {
        options.mergePattern = new RegExp(options.mergePattern);
      }
      return options;
    }
    function conventionalCommitsParser(options) {
      options = assignOpts(options);
      const reg = regex(options);
      return new Transform({
        objectMode: true,
        highWaterMark: 16,
        transform(data, enc, cb) {
          let commit;
          try {
            commit = parser(data.toString(), options, reg);
            cb(null, commit);
          } catch (err) {
            if (options.warn === true) {
              cb(err);
            } else {
              options.warn(err.toString());
              cb(null, "");
            }
          }
        }
      });
    }
    function sync(commit, options) {
      options = assignOpts(options);
      const reg = regex(options);
      return parser(commit, options, reg);
    }
    module.exports = conventionalCommitsParser;
    module.exports.sync = sync;
  }
});

export {
  require_conventional_commits_parser
};
