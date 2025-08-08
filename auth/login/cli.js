import { Log } from '../../utils/logging.js';
async function builder(yargs) {
    return yargs;
}
async function handler() {
    Log.warn('ng-dev auth login has been deprecated. Authentication will be done');
    Log.warn('using TOKEN from the local environment.');
}
export const LoginModule = {
    handler,
    builder,
    command: 'login',
    describe: 'Log into the ng-dev service',
};
//# sourceMappingURL=cli.js.map