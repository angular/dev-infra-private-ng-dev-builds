import https from 'node:https';
import { Log } from '../../utils/logging.js';
function builder(argv) {
    return argv
        .positional('nodeJsVersion', {
        type: 'string',
        demandOption: true,
    })
        .check(({ nodeJsVersion }) => {
        if (!/^\d+\.\d+\.\d+$/.test(nodeJsVersion)) {
            throw new Error(`Invalid version format "${nodeJsVersion}". Expected X.Y.Z (Example: 22.11.0)`);
        }
        return true;
    });
}
export const GeneratedNodeJsToolchainModule = {
    builder,
    handler,
    command: 'generate-nodejs-toolchain <nodeJsVersion>',
    describe: 'Generates a Bazel toolchain definition for a specific Node.js version.',
};
const REPOSITORY_TYPES = {
    'darwin-arm64.tar.gz': 'darwin_arm64',
    'darwin-x64.tar.gz': 'darwin_amd64',
    'linux-x64.tar.xz': 'linux_amd64',
    'linux-arm64.tar.xz': 'linux_arm64',
    'linux-s390x.tar.xz': 'linux_s390x',
    'win-x64.zip': 'windows_amd64',
    'linux-ppc64le.tar.xz': 'linux_ppc64le',
};
function getText(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to get ${url}. Status Code: ${res.statusCode ?? 'unknown'}`));
            }
            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => resolve(body.join('')));
        });
        request.on('error', (err) => reject(err));
    });
}
async function getNodeJsRepositories(version) {
    const text = await getText(`https://nodejs.org/dist/v${version}/SHASUMS256.txt`);
    const repositories = text
        .split('\n')
        .filter(Boolean)
        .map((line) => {
        const [sha, filename] = line.trim().split(/\s+/);
        if (!filename) {
            return undefined;
        }
        const fileTypeSuffix = filename.replace(/^node-v[\d.]+-/, '');
        const type = REPOSITORY_TYPES[fileTypeSuffix];
        return type ? { filename, sha, type } : undefined;
    })
        .filter((repo) => repo !== undefined);
    return {
        version,
        repositories,
    };
}
async function handler({ nodeJsVersion }) {
    try {
        const { version, repositories } = await getNodeJsRepositories(nodeJsVersion);
        if (!repositories?.length) {
            Log.error(`  ✘   Could not find any downloadable files for Node.js version ${version}. ` +
                `Please check if the version exists and has published binaries at https://nodejs.org/dist/v${version}/`);
            process.exit(1);
        }
        const [majorVersion] = version.split('.');
        console.log(`nodejs_register_toolchains(`);
        console.log(`    name = "node${majorVersion}",`);
        console.log(`    node_repositories = {`);
        for (const { filename, sha, type } of repositories) {
            const strippedFilename = filename.replace(/(\.tar)?\.[^.]+$/, '');
            console.log(`        "${version}-${type}": ("${filename}", "${strippedFilename}", "${sha}"),`);
        }
        console.log(`    },`);
        console.log(`    node_version = "${version}",`);
        console.log(`)\n`);
    }
    catch (error) {
        Log.error(`  ✘  Aborted due to an error:\n${error}`);
        process.exit(1);
    }
}
//# sourceMappingURL=cli.js.map