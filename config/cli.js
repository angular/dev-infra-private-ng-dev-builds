import { ValidateModule } from './validate/cli.js';
export function buildConfigParser(localYargs) {
    return localYargs.help().strict().demandCommand().command(ValidateModule);
}
//# sourceMappingURL=cli.js.map