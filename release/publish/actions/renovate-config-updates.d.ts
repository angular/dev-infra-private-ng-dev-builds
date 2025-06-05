/**
 * Updates the `renovate.json` configuration file to include a new base branch.
 * It also updates specific target labels within the package rules.
 *
 * @param projectDir - The path to the project directory.
 * @param newBranchName - The name of the new branch to add to the base branches list.
 * @returns A promise that resolves to the path of the modified `renovate.json` file if updated,
 * or `null` if the file was not found or the `baseBranches` array has an unexpected format.
 */
export declare function updateRenovateConfig(projectDir: string, newBranchName: string): Promise<string | null>;
/**
 * Updates a specific target label in the `renovate.json` configuration file.
 * This function specifically targets and replaces one label with another within the `packageRules`.
 *
 * @param projectDir - The path to the project directory.
 * @param fromLabel - The label name to be replaced.
 * @param toLabel - The new label name to replace `fromLabel` with.
 * @returns A promise that resolves to the path of the modified `renovate.json` file if updated,
 * or `null` if the file was not found or the `baseBranches` array has an unexpected format.
 */
export declare function updateRenovateConfigTargetLabels(projectDir: string, fromLabel: string, toLabel: string): Promise<string | null>;
