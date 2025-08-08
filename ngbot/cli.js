import { verify } from './verify.js';
export function buildNgbotParser(localYargs) {
    return localYargs
        .help()
        .strict()
        .demandCommand()
        .command('verify', 'Verify the NgBot config', {}, () => verify());
}
//# sourceMappingURL=cli.js.map