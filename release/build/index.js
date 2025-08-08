import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
export class BuildWorker {
    static async invokeBuild() {
        return new Promise((resolve) => {
            const buildProcess = fork(getBuildWorkerScriptPath(), {
                stdio: ['inherit', 2, 2, 'ipc'],
            });
            let builtPackages = null;
            buildProcess.on('message', (buildResponse) => (builtPackages = buildResponse));
            buildProcess.on('exit', () => resolve(builtPackages));
        });
    }
}
function getBuildWorkerScriptPath() {
    const bundlesDir = dirname(fileURLToPath(import.meta.url));
    return join(bundlesDir, './release/build/build-worker.mjs');
}
//# sourceMappingURL=index.js.map