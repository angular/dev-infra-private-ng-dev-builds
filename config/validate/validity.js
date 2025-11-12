import { assertValidCommitMessageConfig } from '../../commit-message/config';
import { assertValidFormatConfig } from '../../format/config';
import { assertValidPullRequestConfig } from '../../pr/config';
import { assertValidReleaseConfig } from '../../release/config';
import { assertValidCaretakerConfig, assertValidGithubConfig, getConfig, } from '../../utils/config';
export async function checkValidity() {
    const config = (await getConfig());
    if (config['github']) {
        assertValidGithubConfig(config);
    }
    if (config['caretaker']) {
        assertValidCaretakerConfig(config);
    }
    if (config['commitMessage']) {
        assertValidCommitMessageConfig(config);
    }
    if (config['pullRequest']) {
        assertValidPullRequestConfig(config);
    }
    if (config['format']) {
        assertValidFormatConfig(config);
    }
    if (config['release']) {
        assertValidReleaseConfig(config);
    }
}
//# sourceMappingURL=validity.js.map