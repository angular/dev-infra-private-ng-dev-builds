export function addDryRunFlag(args) {
    return args.option('dry-run', {
        type: 'boolean',
        default: false,
        description: 'Whether to do a dry run',
        coerce: (dryRun) => {
            if (dryRun) {
                process.env['DRY_RUN'] = '1';
            }
            return dryRun;
        },
    });
}
export function isDryRun() {
    return process.env['DRY_RUN'] !== undefined;
}
export class DryRunError extends Error {
    constructor() {
        super('Cannot call this function in dryRun mode.');
    }
}
//# sourceMappingURL=dry-run.js.map