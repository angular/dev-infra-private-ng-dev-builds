
import {createRequire as __cjsCompatRequire_ngDev} from 'module';
const require = __cjsCompatRequire_ngDev(import.meta.url);

import "./chunk-RZTNU4LP.mjs";

// node_modules/.aspect_rules_js/conventional-commits-filter@5.0.0/node_modules/conventional-commits-filter/dist/utils.js
function isMatch(object, source) {
  let aValue;
  let bValue;
  for (const key in source) {
    aValue = object[key];
    bValue = source[key];
    if (typeof aValue === "string") {
      aValue = aValue.trim();
    }
    if (typeof bValue === "string") {
      bValue = bValue.trim();
    }
    if (aValue !== bValue) {
      return false;
    }
  }
  return true;
}
function findRevertCommit(commit, reverts) {
  if (!reverts.size) {
    return null;
  }
  const rawCommit = commit.raw || commit;
  for (const revertCommit of reverts) {
    if (revertCommit.revert && isMatch(rawCommit, revertCommit.revert)) {
      return revertCommit;
    }
  }
  return null;
}

// node_modules/.aspect_rules_js/conventional-commits-filter@5.0.0/node_modules/conventional-commits-filter/dist/RevertedCommitsFilter.js
var RevertedCommitsFilter = class {
  hold = /* @__PURE__ */ new Set();
  holdRevertsCount = 0;
  /**
   * Process commit to filter reverted commits
   * @param commit
   * @yields Commit
   */
  *process(commit) {
    const { hold } = this;
    const revertCommit = findRevertCommit(commit, hold);
    if (revertCommit) {
      hold.delete(revertCommit);
      this.holdRevertsCount--;
      return;
    }
    if (commit.revert) {
      hold.add(commit);
      this.holdRevertsCount++;
      return;
    }
    if (this.holdRevertsCount > 0) {
      hold.add(commit);
    } else {
      if (hold.size) {
        yield* hold;
        hold.clear();
      }
      yield commit;
    }
  }
  /**
   * Flush all held commits
   * @yields Held commits
   */
  *flush() {
    const { hold } = this;
    if (hold.size) {
      yield* hold;
      hold.clear();
    }
  }
};

// node_modules/.aspect_rules_js/conventional-commits-filter@5.0.0/node_modules/conventional-commits-filter/dist/filters.js
import { Transform } from "stream";
async function* filterRevertedCommits(commits) {
  const filter = new RevertedCommitsFilter();
  for await (const commit of commits) {
    yield* filter.process(commit);
  }
  yield* filter.flush();
}
function* filterRevertedCommitsSync(commits) {
  const filter = new RevertedCommitsFilter();
  for (const commit of commits) {
    yield* filter.process(commit);
  }
  yield* filter.flush();
}
function filterRevertedCommitsStream() {
  return Transform.from(filterRevertedCommits);
}
export {
  RevertedCommitsFilter,
  filterRevertedCommits,
  filterRevertedCommitsStream,
  filterRevertedCommitsSync
};
