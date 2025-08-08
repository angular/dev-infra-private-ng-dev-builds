import { updateGeneratedFileTargets } from './update-generated-files.js';
async function builder(argv) {
    return argv;
}
async function handler() {
    await updateGeneratedFileTargets();
}
export const GeneratedFilesModule = {
    builder,
    handler,
    command: 'update-generated-files',
    describe: 'Automatically discover all bazel generated file targets and update them.',
};
//# sourceMappingURL=cli.js.map