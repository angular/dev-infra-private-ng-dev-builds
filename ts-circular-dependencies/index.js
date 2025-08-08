import { existsSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, relative, resolve } from 'path';
import glob from 'fast-glob';
import { green, Log, yellow } from '../utils/logging.js';
import { Analyzer } from './analyzer.js';
import { loadTestConfig } from './config.js';
import { convertPathToForwardSlash } from './file_system.js';
import { compareGoldens, convertReferenceChainToGolden } from './golden.js';
export function tsCircularDependenciesBuilder(localYargs) {
    return localYargs
        .help()
        .strict()
        .demandCommand()
        .option('config', {
        type: 'string',
        demandOption: true,
        description: 'Path to the configuration file.',
    })
        .option('warnings', { type: 'boolean', description: 'Prints all warnings.' })
        .command('check', 'Checks if the circular dependencies have changed.', (args) => args, async (argv) => {
        const { config: configArg, warnings } = argv;
        const configPath = isAbsolute(configArg) ? configArg : resolve(configArg);
        const config = await loadTestConfig(configPath);
        process.exit(main(false, config, !!warnings));
    })
        .command('approve', 'Approves the current circular dependencies.', (args) => args, async (argv) => {
        const { config: configArg, warnings } = argv;
        const configPath = isAbsolute(configArg) ? configArg : resolve(configArg);
        const config = await loadTestConfig(configPath);
        process.exit(main(true, config, !!warnings));
    });
}
export function main(approve, config, printWarnings) {
    const { baseDir, goldenFile, glob: globPattern, resolveModule, approveCommand, ignoreTypeOnlyChecks, } = config;
    const analyzer = new Analyzer(resolveModule, ignoreTypeOnlyChecks);
    const cycles = [];
    const checkedNodes = new WeakSet();
    glob
        .globSync(globPattern, { absolute: true, ignore: ['**/node_modules/**'] })
        .forEach((filePath) => {
        const sourceFile = analyzer.getSourceFile(filePath);
        cycles.push(...analyzer.findCycles(sourceFile, checkedNodes));
    });
    const actual = convertReferenceChainToGolden(cycles, baseDir);
    Log.info(green(`   Current number of cycles: ${yellow(cycles.length.toString())}`));
    const warningsCount = analyzer.unresolvedFiles.size + analyzer.unresolvedModules.size;
    if (printWarnings && warningsCount !== 0) {
        Log.info(yellow('⚠  The following imports could not be resolved:'));
        Array.from(analyzer.unresolvedModules)
            .sort()
            .forEach((specifier) => Log.info(`  • ${specifier}`));
        analyzer.unresolvedFiles.forEach((value, key) => {
            Log.info(`  • ${getRelativePath(baseDir, key)}`);
            value.sort().forEach((specifier) => Log.info(`      ${specifier}`));
        });
    }
    else {
        Log.warn(`⚠  ${warningsCount} imports could not be resolved.`);
        Log.warn(`   Please rerun with "--warnings" to inspect unresolved imports.`);
    }
    if (goldenFile === undefined) {
        if (approve) {
            Log.error(`x  Cannot approve circular depdencies within this repository as no golden file exists.`);
            return 1;
        }
        if (cycles.length > 0) {
            Log.error(`x  No circular dependencies are allow within this repository, but circular dependencies were found:`);
            actual.forEach((c) => Log.error(`     • ${convertReferenceChainToString(c)}`));
            return 1;
        }
        Log.info(green('✔  No circular dependencies found in this repository.'));
        return 0;
    }
    if (approve) {
        writeFileSync(goldenFile, JSON.stringify(actual, null, 2));
        Log.info(green('✔  Updated golden file.'));
        return 0;
    }
    if (!existsSync(goldenFile)) {
        Log.error(`x  Could not find golden file: ${goldenFile}`);
        return 1;
    }
    const expected = goldenFile ? JSON.parse(readFileSync(goldenFile, 'utf8')) : [];
    const { fixedCircularDeps, newCircularDeps } = compareGoldens(actual, expected);
    const isMatching = fixedCircularDeps.length === 0 && newCircularDeps.length === 0;
    if (isMatching) {
        Log.info(green('✔  Golden matches current circular dependencies.'));
        return 0;
    }
    Log.error('✘  Golden does not match current circular dependencies.');
    if (newCircularDeps.length !== 0) {
        Log.error(`   New circular dependencies which are not allowed:`);
        newCircularDeps.forEach((c) => Log.error(`     • ${convertReferenceChainToString(c)}`));
        Log.error();
    }
    if (fixedCircularDeps.length !== 0) {
        Log.error(`   Fixed circular dependencies that need to be removed from the golden:`);
        fixedCircularDeps.forEach((c) => Log.error(`     • ${convertReferenceChainToString(c)}`));
        Log.info(yellow(`\n   Total: ${newCircularDeps.length} new cycle(s), ${fixedCircularDeps.length} fixed cycle(s). \n`));
    }
    if (approveCommand) {
        Log.info(yellow(`   Please approve the new golden with: ${approveCommand}`));
    }
    else if (goldenFile) {
        Log.info(yellow(`   Please update the golden. The following command can be ` +
            `run: yarn ng-dev ts-circular-deps approve ${getRelativePath(process.cwd(), goldenFile)}.`));
    }
    return 1;
}
function getRelativePath(baseDir, path) {
    return convertPathToForwardSlash(relative(baseDir, path));
}
function convertReferenceChainToString(chain) {
    return chain.join(' → ');
}
//# sourceMappingURL=index.js.map