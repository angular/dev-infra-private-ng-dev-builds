import { ChildProcess } from '../../utils/child-process.js';
export class NpmCommand {
    static async publish(packagePath, distTag, registryUrl) {
        const args = ['publish', '--access', 'public', '--tag', distTag];
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        await ChildProcess.spawn('npm', args, { cwd: packagePath, mode: 'silent' });
    }
    static async setDistTagForPackage(packageName, distTag, version, registryUrl) {
        const args = ['dist-tag', 'add', `${packageName}@${version}`, distTag];
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        await ChildProcess.spawn('npm', args, { mode: 'silent' });
    }
    static async deleteDistTagForPackage(packageName, distTag, registryUrl) {
        const args = ['dist-tag', 'rm', packageName, distTag];
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        await ChildProcess.spawn('npm', args, { mode: 'silent' });
    }
    static async checkIsLoggedIn(registryUrl) {
        const args = ['whoami'];
        if (registryUrl !== undefined) {
            args.push('--registry', registryUrl);
        }
        try {
            await ChildProcess.spawn('npm', args, { mode: 'silent' });
        }
        catch (e) {
            return false;
        }
        return true;
    }
    static async startInteractiveLogin(registryUrl) {
        const args = ['login', '--no-browser'];
        if (registryUrl !== undefined) {
            args.splice(1, 0, '--registry', registryUrl);
        }
        await ChildProcess.spawnInteractive('npm', args);
    }
    static async logout(registryUrl) {
        const args = ['logout'];
        if (registryUrl !== undefined) {
            args.splice(1, 0, '--registry', registryUrl);
        }
        try {
            await ChildProcess.spawn('npm', args, { mode: 'silent' });
        }
        finally {
            return this.checkIsLoggedIn(registryUrl);
        }
    }
}
//# sourceMappingURL=npm-command.js.map