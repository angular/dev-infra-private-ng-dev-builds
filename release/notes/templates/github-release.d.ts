/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
declare const _default: "\n<%_\nconst commitsInChangelog = commits.filter(includeInReleaseNotes());\nfor (const group of asCommitGroups(commitsInChangelog)) {\n_%>\n\n### <%- group.title %>\n| Commit | Description |\n| -- | -- |\n<%_\n  for (const commit of group.commits) {\n_%>\n| <%- commitToBadge(commit) %> | <%- commit.description %> |\n<%_\n  }\n}\n_%>\n\n<%_\nconst breakingChanges = commits.filter(hasBreakingChanges);\nif (breakingChanges.length) {\n_%>\n## Breaking Changes\n\n<%_\n  for (const group of asCommitGroups(breakingChanges)) {\n_%>\n### <%- group.title %>\n<%_\n    for (const commit of group.commits) {\n      for (const breakingChange of commit.breakingChanges) {\n_%>\n<%- bulletizeText(breakingChange.text) %>\n<%_\n      }\n    }\n  }\n}\n_%>\n\n<%_\nconst deprecations = commits.filter(hasDeprecations);\nif (deprecations.length) {\n_%>\n## Deprecations\n<%_\n  for (const group of asCommitGroups(deprecations)) {\n_%>\n### <%- group.title %>\n<%_\n    for (const commit of group.commits) {\n      for (const deprecation of commit.deprecations) {\n_%>\n<%- bulletizeText(deprecation.text) %>\n<%_\n      }\n    }\n  }\n}\n_%>\n";
export default _default;
