import { LoginModule } from './login/cli.js';
import { LogoutModule } from './logout/cli.js';
export function buildAuthParser(yargs) {
    return yargs.command(LoginModule).command(LogoutModule);
}
//# sourceMappingURL=cli.js.map