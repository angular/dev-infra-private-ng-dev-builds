import { Log } from '../../utils/logging.js';
async function builder(yargs) {
    return yargs;
}
async function handler() {
    Log.warn('ng-dev auth logout has been deprecated. Authentication will be done');
    Log.warn('using local environment.');
}
export const LogoutModule = {
    handler,
    builder,
    command: 'logout',
    describe: 'Log out of the ng-dev service',
};
//# sourceMappingURL=cli.js.map