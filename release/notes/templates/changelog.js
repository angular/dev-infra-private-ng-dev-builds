/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export default `
<a name="<%- urlFragmentForRelease %>"></a>
# <%- version %><% if (title) { %> "<%- title %>"<% } %> (<%- dateStamp %>)

<%_
const breakingChanges = commits.filter(hasBreakingChanges);
if (breakingChanges.length) {
_%>
## Breaking Changes

<%_
  for (const group of asCommitGroups(breakingChanges)) {
_%>
### <%- group.title %>
<%_
    for (const commit of group.commits) {
      for (const breakingChange of commit.breakingChanges) {
_%>
<%- bulletizeText(breakingChange.text) %>
<%_
      }
    }
  }
}
_%>

<%_
const deprecations = commits.filter(hasDeprecations);
if (deprecations.length) {
_%>
## Deprecations
<%_
  for (const group of asCommitGroups(deprecations)) {
_%>
### <%- group.title %>
<%_
    for (const commit of group.commits) {
      for (const deprecation of commit.deprecations) {
_%>
<%- bulletizeText(deprecation.text) %>
<%_
      }
    }
  }
}
_%>

<%_
const commitsInChangelog = commits.filter(includeInReleaseNotes());
for (const group of asCommitGroups(commitsInChangelog)) {
_%>

### <%- group.title %>
| Commit | Type | Description |
| -- | -- | -- |
<%_
  for (const commit of group.commits) {
    const descriptionWithMarkdownLinks = convertPullRequestReferencesToLinks(
      commit.description);
_%>
| <%- commitToLink(commit) %> | <%- commit.type %> | <%- descriptionWithMarkdownLinks %> |
<%_
  }
}
_%>

`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbmdlbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2Uvbm90ZXMvdGVtcGxhdGVzL2NoYW5nZWxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxlQUFlOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrRWQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5leHBvcnQgZGVmYXVsdCBgXG48YSBuYW1lPVwiPCUtIHVybEZyYWdtZW50Rm9yUmVsZWFzZSAlPlwiPjwvYT5cbiMgPCUtIHZlcnNpb24gJT48JSBpZiAodGl0bGUpIHsgJT4gXCI8JS0gdGl0bGUgJT5cIjwlIH0gJT4gKDwlLSBkYXRlU3RhbXAgJT4pXG5cbjwlX1xuY29uc3QgYnJlYWtpbmdDaGFuZ2VzID0gY29tbWl0cy5maWx0ZXIoaGFzQnJlYWtpbmdDaGFuZ2VzKTtcbmlmIChicmVha2luZ0NoYW5nZXMubGVuZ3RoKSB7XG5fJT5cbiMjIEJyZWFraW5nIENoYW5nZXNcblxuPCVfXG4gIGZvciAoY29uc3QgZ3JvdXAgb2YgYXNDb21taXRHcm91cHMoYnJlYWtpbmdDaGFuZ2VzKSkge1xuXyU+XG4jIyMgPCUtIGdyb3VwLnRpdGxlICU+XG48JV9cbiAgICBmb3IgKGNvbnN0IGNvbW1pdCBvZiBncm91cC5jb21taXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IGJyZWFraW5nQ2hhbmdlIG9mIGNvbW1pdC5icmVha2luZ0NoYW5nZXMpIHtcbl8lPlxuPCUtIGJ1bGxldGl6ZVRleHQoYnJlYWtpbmdDaGFuZ2UudGV4dCkgJT5cbjwlX1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXyU+XG5cbjwlX1xuY29uc3QgZGVwcmVjYXRpb25zID0gY29tbWl0cy5maWx0ZXIoaGFzRGVwcmVjYXRpb25zKTtcbmlmIChkZXByZWNhdGlvbnMubGVuZ3RoKSB7XG5fJT5cbiMjIERlcHJlY2F0aW9uc1xuPCVfXG4gIGZvciAoY29uc3QgZ3JvdXAgb2YgYXNDb21taXRHcm91cHMoZGVwcmVjYXRpb25zKSkge1xuXyU+XG4jIyMgPCUtIGdyb3VwLnRpdGxlICU+XG48JV9cbiAgICBmb3IgKGNvbnN0IGNvbW1pdCBvZiBncm91cC5jb21taXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IGRlcHJlY2F0aW9uIG9mIGNvbW1pdC5kZXByZWNhdGlvbnMpIHtcbl8lPlxuPCUtIGJ1bGxldGl6ZVRleHQoZGVwcmVjYXRpb24udGV4dCkgJT5cbjwlX1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXyU+XG5cbjwlX1xuY29uc3QgY29tbWl0c0luQ2hhbmdlbG9nID0gY29tbWl0cy5maWx0ZXIoaW5jbHVkZUluUmVsZWFzZU5vdGVzKCkpO1xuZm9yIChjb25zdCBncm91cCBvZiBhc0NvbW1pdEdyb3Vwcyhjb21taXRzSW5DaGFuZ2Vsb2cpKSB7XG5fJT5cblxuIyMjIDwlLSBncm91cC50aXRsZSAlPlxufCBDb21taXQgfCBUeXBlIHwgRGVzY3JpcHRpb24gfFxufCAtLSB8IC0tIHwgLS0gfFxuPCVfXG4gIGZvciAoY29uc3QgY29tbWl0IG9mIGdyb3VwLmNvbW1pdHMpIHtcbiAgICBjb25zdCBkZXNjcmlwdGlvbldpdGhNYXJrZG93bkxpbmtzID0gY29udmVydFB1bGxSZXF1ZXN0UmVmZXJlbmNlc1RvTGlua3MoXG4gICAgICBjb21taXQuZGVzY3JpcHRpb24pO1xuXyU+XG58IDwlLSBjb21taXRUb0xpbmsoY29tbWl0KSAlPiB8IDwlLSBjb21taXQudHlwZSAlPiB8IDwlLSBkZXNjcmlwdGlvbldpdGhNYXJrZG93bkxpbmtzICU+IHxcbjwlX1xuICB9XG59XG5fJT5cblxuYDtcbiJdfQ==