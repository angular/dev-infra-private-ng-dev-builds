import { ChildProcess } from '../../utils/child-process.js';
import { Spinner } from '../../utils/spinner.js';
import { FatalReleaseActionError } from './actions-error.js';
import { resolveYarnScriptForProject } from '../../utils/resolve-yarn-bin.js';
import { green, Log } from '../../utils/logging.js';
export class ExternalCommands {
    static async invokeSetNpmDist(projectDir, npmDistTag, version, pnpmVersioning, options = { skipExperimentalPackages: false }) {
        try {
            await this._spawnNpmScript([
                'ng-dev',
                'release',
                'set-dist-tag',
                npmDistTag,
                version.format(),
                `--skip-experimental-packages=${options.skipExperimentalPackages}`,
            ], projectDir, pnpmVersioning);
            Log.info(green(`  ✓   Set "${npmDistTag}" NPM dist tag for all packages to v${version}.`));
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while setting the NPM dist tag for "${npmDistTag}".`);
            throw new FatalReleaseActionError();
        }
    }
    static async invokeDeleteNpmDistTag(projectDir, npmDistTag, pnpmVersioning) {
        try {
            await this._spawnNpmScript(['ng-dev', 'release', 'npm-dist-tag', 'delete', npmDistTag], projectDir, pnpmVersioning);
            Log.info(green(`  ✓   Deleted "${npmDistTag}" NPM dist tag for all packages.`));
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while deleting the NPM dist tag: "${npmDistTag}".`);
            throw new FatalReleaseActionError();
        }
    }
    static async invokeReleaseBuild(projectDir, pnpmVersioning) {
        const spinner = new Spinner('Building release output. This can take a few minutes.');
        try {
            const { stdout } = await this._spawnNpmScript(['ng-dev', 'release', 'build', '--json'], projectDir, pnpmVersioning, {
                mode: 'silent',
            });
            spinner.complete();
            Log.info(green('  ✓   Built release output for all packages.'));
            return JSON.parse(stdout.trim());
        }
        catch (e) {
            spinner.complete();
            Log.error(e);
            Log.error('  ✘   An error occurred while building the release packages.');
            throw new FatalReleaseActionError();
        }
    }
    static async invokeReleaseInfo(projectDir, pnpmVersioning) {
        try {
            const { stdout } = await this._spawnNpmScript(['ng-dev', 'release', 'info', '--json'], projectDir, pnpmVersioning, { mode: 'silent' });
            return JSON.parse(stdout.trim());
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while retrieving the release information for ` +
                `the currently checked-out branch.`);
            throw new FatalReleaseActionError();
        }
    }
    static async invokeReleasePrecheck(projectDir, newVersion, builtPackagesWithInfo, pnpmVersioning) {
        const precheckStdin = {
            builtPackagesWithInfo,
            newVersion: newVersion.format(),
        };
        try {
            await this._spawnNpmScript(['ng-dev', 'release', 'precheck'], projectDir, pnpmVersioning, {
                input: JSON.stringify(precheckStdin),
            });
            Log.info(green(`  ✓   Executed release pre-checks for ${newVersion}`));
        }
        catch (e) {
            Log.debug(e);
            Log.error(`  ✘   An error occurred while running release pre-checks.`);
            throw new FatalReleaseActionError();
        }
    }
    static async invokeYarnInstall(projectDir) {
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        try {
            await ChildProcess.spawn(yarnCommand.binary, [
                ...yarnCommand.args,
                'install',
                ...(yarnCommand.legacy ? ['--frozen-lockfile', '--non-interactive'] : ['--immutable']),
            ], {
                cwd: projectDir,
                mode: 'on-error',
            });
            Log.info(green('  ✓   Installed project dependencies.'));
        }
        catch (e) {
            Log.error(e);
            Log.error('  ✘   An error occurred while installing dependencies.');
            throw new FatalReleaseActionError();
        }
    }
    static async invokePnpmInstall(projectDir) {
        try {
            await ChildProcess.spawn('pnpm', [
                'install',
                '--frozen-lockfile',
                '--config.confirmModulesPurge=false',
            ], {
                cwd: projectDir,
                mode: 'on-error',
            });
            Log.info(green('  ✓   Installed project dependencies.'));
        }
        catch (e) {
            Log.error(e);
            Log.error('  ✘   An error occurred while installing dependencies.');
            throw new FatalReleaseActionError();
        }
    }
    static async _spawnNpmScript(args, projectDir, pnpmVersioning, spawnOptions = {}) {
        if (await pnpmVersioning.isUsingPnpm(projectDir)) {
            const pnpmSpec = await pnpmVersioning.getPackageSpec(projectDir);
            return ChildProcess.spawn('npx', ['--yes', pnpmSpec, '-s', 'run', ...args], {
                ...spawnOptions,
                cwd: projectDir,
            });
        }
        else {
            const yarnCommand = await resolveYarnScriptForProject(projectDir);
            return ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, ...args], {
                ...spawnOptions,
                cwd: projectDir,
            });
        }
    }
}
//# sourceMappingURL=external-commands.js.map