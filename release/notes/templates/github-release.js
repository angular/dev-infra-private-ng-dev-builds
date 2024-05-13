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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLXJlbGVhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9ub3Rlcy90ZW1wbGF0ZXMvZ2l0aHViLXJlbGVhc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsZUFBZTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBK0RkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0IGRlZmF1bHQgYFxuPGEgbmFtZT1cIjwlLSB1cmxGcmFnbWVudEZvclJlbGVhc2UgJT5cIj48L2E+XG4jIDwlLSB2ZXJzaW9uICU+PCUgaWYgKHRpdGxlKSB7ICU+IFwiPCUtIHRpdGxlICU+XCI8JSB9ICU+ICg8JS0gZGF0ZVN0YW1wICU+KVxuXG48JV9cbmNvbnN0IGNvbW1pdHNJbkNoYW5nZWxvZyA9IGNvbW1pdHMuZmlsdGVyKGluY2x1ZGVJblJlbGVhc2VOb3RlcygpKTtcbmZvciAoY29uc3QgZ3JvdXAgb2YgYXNDb21taXRHcm91cHMoY29tbWl0c0luQ2hhbmdlbG9nKSkge1xuXyU+XG5cbiMjIyA8JS0gZ3JvdXAudGl0bGUgJT5cbnwgQ29tbWl0IHwgRGVzY3JpcHRpb24gfFxufCAtLSB8IC0tIHxcbjwlX1xuICBmb3IgKGNvbnN0IGNvbW1pdCBvZiBncm91cC5jb21taXRzKSB7XG5fJT5cbnwgPCUtIGNvbW1pdFRvQmFkZ2UoY29tbWl0KSAlPiB8IDwlLSBjb21taXQuZGVzY3JpcHRpb24gJT4gfFxuPCVfXG4gIH1cbn1cbl8lPlxuXG48JV9cbmNvbnN0IGJyZWFraW5nQ2hhbmdlcyA9IGNvbW1pdHMuZmlsdGVyKGhhc0JyZWFraW5nQ2hhbmdlcyk7XG5pZiAoYnJlYWtpbmdDaGFuZ2VzLmxlbmd0aCkge1xuXyU+XG4jIyBCcmVha2luZyBDaGFuZ2VzXG5cbjwlX1xuICBmb3IgKGNvbnN0IGdyb3VwIG9mIGFzQ29tbWl0R3JvdXBzKGJyZWFraW5nQ2hhbmdlcykpIHtcbl8lPlxuIyMjIDwlLSBncm91cC50aXRsZSAlPlxuPCVfXG4gICAgZm9yIChjb25zdCBjb21taXQgb2YgZ3JvdXAuY29tbWl0cykge1xuICAgICAgZm9yIChjb25zdCBicmVha2luZ0NoYW5nZSBvZiBjb21taXQuYnJlYWtpbmdDaGFuZ2VzKSB7XG5fJT5cbjwlLSBidWxsZXRpemVUZXh0KGJyZWFraW5nQ2hhbmdlLnRleHQpICU+XG48JV9cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbl8lPlxuXG48JV9cbmNvbnN0IGRlcHJlY2F0aW9ucyA9IGNvbW1pdHMuZmlsdGVyKGhhc0RlcHJlY2F0aW9ucyk7XG5pZiAoZGVwcmVjYXRpb25zLmxlbmd0aCkge1xuXyU+XG4jIyBEZXByZWNhdGlvbnNcbjwlX1xuICBmb3IgKGNvbnN0IGdyb3VwIG9mIGFzQ29tbWl0R3JvdXBzKGRlcHJlY2F0aW9ucykpIHtcbl8lPlxuIyMjIDwlLSBncm91cC50aXRsZSAlPlxuPCVfXG4gICAgZm9yIChjb25zdCBjb21taXQgb2YgZ3JvdXAuY29tbWl0cykge1xuICAgICAgZm9yIChjb25zdCBkZXByZWNhdGlvbiBvZiBjb21taXQuZGVwcmVjYXRpb25zKSB7XG5fJT5cbjwlLSBidWxsZXRpemVUZXh0KGRlcHJlY2F0aW9uLnRleHQpICU+XG48JV9cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbl8lPlxuYDtcbiJdfQ==