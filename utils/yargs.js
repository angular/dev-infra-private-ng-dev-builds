import yargs from 'yargs';
const completedFunctions = [];
export function registerCompletedFunction(fn) {
    completedFunctions.push(fn);
}
export async function runParserWithCompletedFunctions(applyConfiguration) {
    let err = null;
    try {
        await applyConfiguration(yargs(process.argv.slice(2)))
            .exitProcess(false)
            .parse();
    }
    catch (e) {
        err = e;
        if ([undefined, 0].includes(process.exitCode)) {
            process.exitCode = 1;
        }
    }
    finally {
        for (const completedFunc of completedFunctions) {
            await completedFunc(err);
        }
    }
}
//# sourceMappingURL=yargs.js.map