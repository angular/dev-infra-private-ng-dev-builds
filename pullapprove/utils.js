import { Minimatch } from 'minimatch';
const patternCache = new Map();
export function getOrCreateGlob(pattern) {
    if (patternCache.has(pattern)) {
        return patternCache.get(pattern);
    }
    const glob = new Minimatch(pattern, { dot: false, nobrace: false });
    patternCache.set(pattern, glob);
    return glob;
}
//# sourceMappingURL=utils.js.map