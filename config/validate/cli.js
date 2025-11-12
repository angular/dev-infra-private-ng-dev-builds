import { green, Log, red } from '../../utils/logging';
import { checkPortability } from './portability';
import { checkValidity } from './validity';
import { ConfigValidationError } from '../../utils/config';
async function builder(yargs) {
    return yargs;
}
async function handler() {
    try {
        await checkPortability();
        await checkValidity();
        Log.info(`${green('✓')} ng-dev configuration validation passed`);
    }
    catch (error) {
        if (error instanceof ConfigValidationError) {
            error.errors.forEach((e) => Log.info(e));
        }
        else {
            Log.info(error);
        }
        Log.info(`${red('✘')} ng-dev configuration validation failed, see above for more details`);
    }
}
export const ValidateModule = {
    handler,
    builder,
    command: 'validate',
    describe: 'Validate that the configuration provided in .ng-dev/ is valid and portable',
};
//# sourceMappingURL=cli.js.map