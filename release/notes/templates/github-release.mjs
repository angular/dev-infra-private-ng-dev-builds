/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export default `
<%_
const commitsInChangelog = commits.filter(includeInReleaseNotes());
for (const group of asCommitGroups(commitsInChangelog)) {
_%>

### <%- group.title %>
| Commit | Description |
| -- | -- |
<%_
  for (const commit of group.commits) {
_%>
| <%- commitToBadge(commit) %> | <%- commit.description %> |
<%_
  }
}
_%>

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
`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLXJlbGVhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9ub3Rlcy90ZW1wbGF0ZXMvZ2l0aHViLXJlbGVhc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsZUFBZTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNERkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0IGRlZmF1bHQgYFxuPCVfXG5jb25zdCBjb21taXRzSW5DaGFuZ2Vsb2cgPSBjb21taXRzLmZpbHRlcihpbmNsdWRlSW5SZWxlYXNlTm90ZXMoKSk7XG5mb3IgKGNvbnN0IGdyb3VwIG9mIGFzQ29tbWl0R3JvdXBzKGNvbW1pdHNJbkNoYW5nZWxvZykpIHtcbl8lPlxuXG4jIyMgPCUtIGdyb3VwLnRpdGxlICU+XG58IENvbW1pdCB8IERlc2NyaXB0aW9uIHxcbnwgLS0gfCAtLSB8XG48JV9cbiAgZm9yIChjb25zdCBjb21taXQgb2YgZ3JvdXAuY29tbWl0cykge1xuXyU+XG58IDwlLSBjb21taXRUb0JhZGdlKGNvbW1pdCkgJT4gfCA8JS0gY29tbWl0LmRlc2NyaXB0aW9uICU+IHxcbjwlX1xuICB9XG59XG5fJT5cblxuPCVfXG5jb25zdCBicmVha2luZ0NoYW5nZXMgPSBjb21taXRzLmZpbHRlcihoYXNCcmVha2luZ0NoYW5nZXMpO1xuaWYgKGJyZWFraW5nQ2hhbmdlcy5sZW5ndGgpIHtcbl8lPlxuIyMgQnJlYWtpbmcgQ2hhbmdlc1xuXG48JV9cbiAgZm9yIChjb25zdCBncm91cCBvZiBhc0NvbW1pdEdyb3VwcyhicmVha2luZ0NoYW5nZXMpKSB7XG5fJT5cbiMjIyA8JS0gZ3JvdXAudGl0bGUgJT5cbjwlX1xuICAgIGZvciAoY29uc3QgY29tbWl0IG9mIGdyb3VwLmNvbW1pdHMpIHtcbiAgICAgIGZvciAoY29uc3QgYnJlYWtpbmdDaGFuZ2Ugb2YgY29tbWl0LmJyZWFraW5nQ2hhbmdlcykge1xuXyU+XG48JS0gYnVsbGV0aXplVGV4dChicmVha2luZ0NoYW5nZS50ZXh0KSAlPlxuPCVfXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5fJT5cblxuPCVfXG5jb25zdCBkZXByZWNhdGlvbnMgPSBjb21taXRzLmZpbHRlcihoYXNEZXByZWNhdGlvbnMpO1xuaWYgKGRlcHJlY2F0aW9ucy5sZW5ndGgpIHtcbl8lPlxuIyMgRGVwcmVjYXRpb25zXG48JV9cbiAgZm9yIChjb25zdCBncm91cCBvZiBhc0NvbW1pdEdyb3VwcyhkZXByZWNhdGlvbnMpKSB7XG5fJT5cbiMjIyA8JS0gZ3JvdXAudGl0bGUgJT5cbjwlX1xuICAgIGZvciAoY29uc3QgY29tbWl0IG9mIGdyb3VwLmNvbW1pdHMpIHtcbiAgICAgIGZvciAoY29uc3QgZGVwcmVjYXRpb24gb2YgY29tbWl0LmRlcHJlY2F0aW9ucykge1xuXyU+XG48JS0gYnVsbGV0aXplVGV4dChkZXByZWNhdGlvbi50ZXh0KSAlPlxuPCVfXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5fJT5cbmA7XG4iXX0=