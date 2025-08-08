import { verify } from './verify.js';
export function buildPullapproveParser(localYargs) {
    return localYargs
        .help()
        .strict()
        .demandCommand()
        .command('verify', 'Verify the pullapprove config', {}, () => verify());
}
//# sourceMappingURL=cli.js.map