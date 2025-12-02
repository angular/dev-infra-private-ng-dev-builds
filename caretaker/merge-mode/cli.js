import { Log } from '../../utils/logging';
import { addGithubTokenOption } from '../../utils/git/github-yargs';
import { setMergeModeRelease } from './release';
import { resetMergeMode } from './reset';
import { getCurrentMergeMode } from '../../utils/git/repository-merge-mode';
async function setMergeModeBuilder(argv) {
    return addGithubTokenOption(argv).positional('mode', {
        type: 'string',
        choices: ['release', 'reset'],
    });
}
async function setMergeModeHandler({ mode }) {
    if (mode === undefined) {
        const currentMode = await getCurrentMergeMode();
        Log.info(`Repository merge-mode is currently set to: ${currentMode}`);
        return;
    }
    if (mode === 'reset') {
        return await resetMergeMode();
    }
    if (mode === 'release') {
        return await setMergeModeRelease();
    }
    Log.error(`Unable to set the merge mode to the provided mode: ${mode}`);
}
export const MergeModeModule = {
    builder: setMergeModeBuilder,
    handler: setMergeModeHandler,
    command: ['merge-mode [mode]'],
    describe: 'Set the repository merge mode',
};
//# sourceMappingURL=cli.js.map