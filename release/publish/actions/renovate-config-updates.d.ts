/**
 * Updates the `renovate.json` configuration file to include a new base branch.
 *
 * @param projectDir - The project directory path.
 * @param newBranchName - The name of the new branch to add to the base branches list.
 * @returns A promise that resolves to an string containing the path to the modified `renovate.json` file,
 *          or null if config updating is disabled.
 */
export declare function updateRenovateConfig(projectDir: string, newBranchName: string): Promise<string | null>;
