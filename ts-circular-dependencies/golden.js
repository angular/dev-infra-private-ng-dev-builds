import { relative } from 'path';
import { convertPathToForwardSlash } from './file_system.js';
export function convertReferenceChainToGolden(refs, baseDir) {
    return (refs
        .map((chain) => normalizeCircularDependency(chain.map(({ fileName }) => convertPathToForwardSlash(relative(baseDir, fileName)))))
        .sort(compareCircularDependency));
}
export function compareGoldens(actual, expected) {
    const newCircularDeps = [];
    const fixedCircularDeps = [];
    actual.forEach((a) => {
        if (!expected.find((e) => isSameCircularDependency(a, e))) {
            newCircularDeps.push(a);
        }
    });
    expected.forEach((e) => {
        if (!actual.find((a) => isSameCircularDependency(e, a))) {
            fixedCircularDeps.push(e);
        }
    });
    return { newCircularDeps, fixedCircularDeps };
}
function normalizeCircularDependency(path) {
    if (path.length <= 1) {
        return path;
    }
    let indexFirstNode = 0;
    let valueFirstNode = path[0];
    for (let i = 1; i < path.length; i++) {
        const value = path[i];
        if (value.localeCompare(valueFirstNode, 'en') < 0) {
            indexFirstNode = i;
            valueFirstNode = value;
        }
    }
    if (indexFirstNode === 0) {
        return path;
    }
    return [...path.slice(indexFirstNode), ...path.slice(0, indexFirstNode)];
}
function isSameCircularDependency(actual, expected) {
    if (actual.length !== expected.length) {
        return false;
    }
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) {
            return false;
        }
    }
    return true;
}
function compareCircularDependency(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const compareValue = a[i].localeCompare(b[i], 'en');
        if (compareValue !== 0) {
            return compareValue;
        }
    }
    return a.length - b.length;
}
//# sourceMappingURL=golden.js.map