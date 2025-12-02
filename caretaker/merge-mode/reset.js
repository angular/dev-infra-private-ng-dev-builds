import { assertValidGithubConfig, getConfig } from '../../utils/config';
import { setRepoMergeMode } from '../../utils/git/repository-merge-mode';
import { green, Log, red } from '../../utils/logging';
export async function resetMergeMode() {
    try {
        const { github: { mergeMode }, } = await getConfig([assertValidGithubConfig]);
        await setRepoMergeMode(mergeMode);
        Log.info(`${green('✔')} Repository has been reset to the normal mode: ${mergeMode}`);
    }
    catch (err) {
        Log.info(`${red('✘')} Failed to reset the merge mode of the repository`);
        if (err instanceof Error) {
            Log.info(err.message);
            Log.debug(err.stack);
            return;
        }
        Log.info(err);
    }
}
//# sourceMappingURL=reset.js.map