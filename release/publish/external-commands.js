import { ChildProcess } from '../../utils/child-process.js';
import { Spinner } from '../../utils/spinner.js';
import { FatalReleaseActionError } from './actions-error.js';
import { resolveYarnScriptForProject } from '../../utils/resolve-yarn-bin.js';
import { green, Log } from '../../utils/logging.js';
import { getBazelBin } from '../../utils/bazel-bin.js';
import { PnpmVersioning } from './pnpm-versioning.js';
export class ExternalCommands {
    static async invokeSetNpmDist(projectDir, npmDistTag, version, options = { skipExperimentalPackages: false }) {
        try {
            await this._spawnNpmScript([
                'ng-dev',
                'release',
                'set-dist-tag',
                npmDistTag,
                version.format(),
                `--skip-experimental-packages=${options.skipExperimentalPackages}`,
            ], projectDir);
            Log.info(green(`  ✓   Set "${npmDistTag}" NPM dist tag for all packages to v${version}.`));
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while setting the NPM dist tag for "${npmDistTag}".`);
            throw new FatalReleaseActionError();
        }
    }
    static async invokeDeleteNpmDistTag(projectDir, npmDistTag) {
        try {
            await this._spawnNpmScript(['ng-dev', 'release', 'npm-dist-tag', 'delete', npmDistTag], projectDir);
            Log.info(green(`  ✓   Deleted "${npmDistTag}" NPM dist tag for all packages.`));
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while deleting the NPM dist tag: "${npmDistTag}".`);
            throw new FatalReleaseActionError();
        }
    }
    static async invokeReleaseBuild(projectDir) {
        const spinner = new Spinner('Building release output. This can take a few minutes.');
        try {
            const { stdout } = await this._spawnNpmScript(['ng-dev', 'release', 'build', '--json'], projectDir, {
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
    static async invokeReleaseInfo(projectDir) {
        try {
            const { stdout } = await this._spawnNpmScript(['ng-dev', 'release', 'info', '--json'], projectDir, { mode: 'silent' });
            return JSON.parse(stdout.trim());
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while retrieving the release information for ` +
                `the currently checked-out branch.`);
            throw new FatalReleaseActionError();
        }
    }
    static async invokeReleasePrecheck(projectDir, newVersion, builtPackagesWithInfo) {
        const precheckStdin = {
            builtPackagesWithInfo,
            newVersion: newVersion.format(),
        };
        try {
            await this._spawnNpmScript(['ng-dev', 'release', 'precheck'], projectDir, {
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
    static async _spawnNpmScript(args, projectDir, spawnOptions = {}) {
        if (PnpmVersioning.isUsingPnpm(projectDir)) {
            return ChildProcess.spawn('npx', ['--yes', 'pnpm', '-s', ...args], {
                ...spawnOptions,
                cwd: projectDir,
            });
        }
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        return ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, ...args], {
            ...spawnOptions,
            cwd: projectDir,
        });
    }
    static async invokeBazelUpdateAspectLockFiles(projectDir) {
        const spinner = new Spinner('Updating Aspect lock files');
        try {
            await ChildProcess.spawn(getBazelBin(), ['sync', '--only=repo'], {
                cwd: projectDir,
                mode: 'silent',
            });
        }
        catch (e) {
            Log.debug(e);
        }
        spinner.success(green(' Updated Aspect `rules_js` lock files.'));
    }
}
//# sourceMappingURL=external-commands.js.map