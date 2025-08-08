import * as fs from 'fs';
import * as path from 'path';
import which from 'which';
import { isNodeJSWrappedError } from './nodejs-errors.js';
import lockfile from '@yarnpkg/lockfile';
import { parse as parseYaml } from 'yaml';
import { ChildProcess } from './child-process.js';
import { Log } from './logging.js';
export const yarnConfigFiles = [
    { fileName: '.yarnrc', parse: (c) => lockfile.parse(c).object },
    { fileName: '.yarnrc.yml', parse: (c) => parseYaml(c) },
];
export async function resolveYarnScriptForProject(projectDir) {
    let info;
    const yarnPathFromConfig = await getYarnPathFromConfigurationIfPresent(projectDir);
    if (yarnPathFromConfig !== null) {
        info = { binary: 'node', args: [yarnPathFromConfig] };
    }
    if (!info) {
        const yarnPathFromNpmBin = await getYarnPathFromNpmGlobalBinaries();
        if (yarnPathFromNpmBin !== null) {
            info = { binary: yarnPathFromNpmBin, args: [] };
        }
    }
    info ?? (info = { binary: 'yarn', args: [] });
    const yarnVersion = await getYarnVersion(info);
    if (yarnVersion && Number(yarnVersion.split('.')[0]) < 2) {
        info.args.push('--silent');
        info.legacy = true;
    }
    return info;
}
export async function getYarnPathFromNpmGlobalBinaries() {
    const npmGlobalBinPath = await getNpmGlobalBinPath();
    if (npmGlobalBinPath === null) {
        return null;
    }
    try {
        return await which('yarn', { path: npmGlobalBinPath });
    }
    catch (e) {
        Log.debug('Could not find Yarn within NPM global binary directory. Error:', e);
        return null;
    }
}
async function getNpmGlobalBinPath() {
    try {
        return (await ChildProcess.spawn('npm', ['bin', '--global'], { mode: 'silent' })).stdout.trim();
    }
    catch (e) {
        Log.debug('Could not determine NPM global binary directory. Error:', e);
        return null;
    }
}
async function getYarnPathFromConfigurationIfPresent(projectDir) {
    const yarnRc = await findAndParseYarnConfiguration(projectDir);
    if (yarnRc === null) {
        return null;
    }
    const yarnPath = yarnRc['yarn-path'] ?? yarnRc['yarnPath'];
    if (yarnPath === undefined) {
        return null;
    }
    return path.resolve(projectDir, yarnPath);
}
async function getYarnVersion(info) {
    try {
        return (await ChildProcess.spawn(info.binary, [...info.args, '--version'], { mode: 'silent' })).stdout.trim();
    }
    catch (e) {
        Log.debug('Could not determine Yarn version. Error:', e);
        return null;
    }
}
async function findAndParseYarnConfiguration(projectDir) {
    const files = await Promise.all(yarnConfigFiles.map(async (entry) => ({
        entry,
        content: await readFileGracefully(path.join(projectDir, entry.fileName)),
    })));
    const config = files.find((entry) => entry.content !== null);
    if (config === undefined) {
        return null;
    }
    try {
        return config.entry.parse(config.content);
    }
    catch (e) {
        Log.debug(`Could not parse determined Yarn configuration file (${config.entry.fileName}).`);
        Log.debug(`Error:`, e);
        return null;
    }
}
async function readFileGracefully(filePath) {
    try {
        return await fs.promises.readFile(filePath, 'utf8');
    }
    catch (error) {
        if (isNodeJSWrappedError(error, Error) && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
//# sourceMappingURL=resolve-yarn-bin.js.map