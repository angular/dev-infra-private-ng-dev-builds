
import {createRequire as __cjsCompatRequire} from 'module';
const require = __cjsCompatRequire(import.meta.url);

import {
  ActiveReleaseTrains,
  AuthenticatedGitClient,
  AuthenticatedGithubClient,
  COMMIT_TYPES,
  GitClient,
  GitCommandError,
  GithubClient,
  ReleaseNotesLevel,
  ReleasePrecheckError,
  ReleaseTrain,
  ScopeRequirement,
  _npmPackageInfoCache,
  actionLabels,
  allLabels,
  assertValidCaretakerConfig,
  assertValidCommitMessageConfig,
  assertValidFormatConfig,
  assertValidPullRequestConfig,
  computeLtsEndDateOfMajor,
  fetchLongTermSupportBranchesFromNpm,
  fetchProjectNpmPackageInfo,
  getBranchesForMajorVersions,
  getLtsNpmDistTagOfMajor,
  getNextBranchName,
  getVersionForVersionBranch,
  getVersionOfBranch,
  import_request_error,
  isLtsDistTag,
  isVersionBranch,
  isVersionPublishedToNpm,
  managedLabels,
  mergeLabels,
  priorityLabels,
  targetLabels
} from "./chunk-FJCG5APD.mjs";
import {
  ConfigValidationError,
  DEFAULT_LOG_LEVEL,
  Log,
  LogLevel,
  assertValidGithubConfig,
  assertValidReleaseConfig,
  blue,
  bold,
  captureLogOutputForCommand,
  getConfig,
  getUserConfig,
  green,
  red,
  reset,
  setConfig,
  yellow
} from "./chunk-N5IEFSCP.mjs";
import "./chunk-H4BWSXO4.mjs";
import "./chunk-QMLAZXI4.mjs";
var export_GithubApiRequestError = import_request_error.RequestError;
export {
  ActiveReleaseTrains,
  AuthenticatedGitClient,
  AuthenticatedGithubClient,
  COMMIT_TYPES,
  ConfigValidationError,
  DEFAULT_LOG_LEVEL,
  GitClient,
  GitCommandError,
  export_GithubApiRequestError as GithubApiRequestError,
  GithubClient,
  Log,
  LogLevel,
  ReleaseNotesLevel,
  ReleasePrecheckError,
  ReleaseTrain,
  ScopeRequirement,
  _npmPackageInfoCache,
  actionLabels,
  allLabels,
  assertValidCaretakerConfig,
  assertValidCommitMessageConfig,
  assertValidFormatConfig,
  assertValidGithubConfig,
  assertValidPullRequestConfig,
  assertValidReleaseConfig,
  blue,
  bold,
  captureLogOutputForCommand,
  computeLtsEndDateOfMajor,
  fetchLongTermSupportBranchesFromNpm,
  fetchProjectNpmPackageInfo,
  getBranchesForMajorVersions,
  getConfig,
  getLtsNpmDistTagOfMajor,
  getNextBranchName,
  getUserConfig,
  getVersionForVersionBranch,
  getVersionOfBranch,
  green,
  isLtsDistTag,
  isVersionBranch,
  isVersionPublishedToNpm,
  managedLabels,
  mergeLabels,
  priorityLabels,
  red,
  reset,
  setConfig,
  targetLabels,
  yellow
};
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
//# sourceMappingURL=index.mjs.map
