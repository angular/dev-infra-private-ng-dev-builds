/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { dirname, extname, isAbsolute, resolve } from 'path';
import { Log } from '../utils/logging.js';
/**
 * Loads the configuration for the circular dependencies test. If the config cannot be
 * loaded, an error will be printed and the process exists with a non-zero exit code.
 */
export async function loadTestConfig(configPath) {
    const configBaseDir = dirname(configPath);
    const resolveRelativePath = (relativePath) => resolve(configBaseDir, relativePath);
    try {
        let config;
        switch (extname(configPath)) {
            case '.mjs':
                // Load the ESM configuration file using the TypeScript dynamic import workaround.
                // Once TypeScript provides support for keeping the dynamic import this workaround can be
                // changed to a direct dynamic import.
                config = await loadEsmModule(configPath);
                break;
            case '.cjs':
                config = require(configPath);
                break;
            default:
                // The file could be either CommonJS or ESM.
                // CommonJS is tried first then ESM if loading fails.
                try {
                    config = require(configPath);
                }
                catch (e) {
                    if (e.code === 'ERR_REQUIRE_ESM') {
                        // Load the ESM configuration file using the TypeScript dynamic import workaround.
                        // Once TypeScript provides support for keeping the dynamic import this workaround can be
                        // changed to a direct dynamic import.
                        config = await loadEsmModule(configPath);
                    }
                    throw e;
                }
        }
        // Clone to config object. This is needed because in ESM the properties are non writeable
        config = { ...config };
        if (!isAbsolute(config.baseDir)) {
            config.baseDir = resolveRelativePath(config.baseDir);
        }
        if (config.goldenFile && !isAbsolute(config.goldenFile)) {
            config.goldenFile = resolveRelativePath(config.goldenFile);
        }
        if (!isAbsolute(config.glob)) {
            config.glob = resolveRelativePath(config.glob);
        }
        return config;
    }
    catch (e) {
        Log.error('Could not load test configuration file at: ' + configPath);
        Log.error(`Failed with error:`, e);
        process.exit(1);
    }
}
/**
 * Lazily compiled dynamic import loader function.
 */
let load;
/**
 * This uses a dynamic import to load a module which may be ESM.
 * CommonJS code can load ESM code via a dynamic import. Unfortunately, TypeScript
 * will currently, unconditionally downlevel dynamic import into a require call.
 * require calls cannot load ESM code and will result in a runtime error. To workaround
 * this, a Function constructor is used to prevent TypeScript from changing the dynamic import.
 * Once TypeScript provides support for keeping the dynamic import this workaround can
 * be dropped.
 *
 * @param modulePath The path of the module to load.
 * @returns A Promise that resolves to the dynamically imported module.
 */
export function loadEsmModule(modulePath) {
    load ?? (load = new Function('modulePath', `return import(modulePath);`));
    return load(modulePath);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L3RzLWNpcmN1bGFyLWRlcGVuZGVuY2llcy9jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUUzRCxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUE4QnhDOzs7R0FHRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsY0FBYyxDQUFDLFVBQWtCO0lBQ3JELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMxQyxNQUFNLG1CQUFtQixHQUFHLENBQUMsWUFBb0IsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUUzRixJQUFJLENBQUM7UUFDSCxJQUFJLE1BQXNDLENBQUM7UUFDM0MsUUFBUSxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUM1QixLQUFLLE1BQU07Z0JBQ1Qsa0ZBQWtGO2dCQUNsRix5RkFBeUY7Z0JBQ3pGLHNDQUFzQztnQkFDdEMsTUFBTSxHQUFHLE1BQU0sYUFBYSxDQUFpQyxVQUFVLENBQUMsQ0FBQztnQkFDekUsTUFBTTtZQUNSLEtBQUssTUFBTTtnQkFDVCxNQUFNLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM3QixNQUFNO1lBQ1I7Z0JBQ0UsNENBQTRDO2dCQUM1QyxxREFBcUQ7Z0JBQ3JELElBQUksQ0FBQztvQkFDSCxNQUFNLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMvQixDQUFDO2dCQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQ1gsSUFBSyxDQUFTLENBQUMsSUFBSSxLQUFLLGlCQUFpQixFQUFFLENBQUM7d0JBQzFDLGtGQUFrRjt3QkFDbEYseUZBQXlGO3dCQUN6RixzQ0FBc0M7d0JBQ3RDLE1BQU0sR0FBRyxNQUFNLGFBQWEsQ0FBaUMsVUFBVSxDQUFDLENBQUM7b0JBQzNFLENBQUM7b0JBRUQsTUFBTSxDQUFDLENBQUM7Z0JBQ1YsQ0FBQztRQUNMLENBQUM7UUFFRCx5RkFBeUY7UUFDekYsTUFBTSxHQUFHLEVBQUMsR0FBRyxNQUFNLEVBQUMsQ0FBQztRQUVyQixJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDRCxJQUFJLE1BQU0sQ0FBQyxVQUFVLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDeEQsTUFBTSxDQUFDLFVBQVUsR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUNELElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDN0IsTUFBTSxDQUFDLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ1gsR0FBRyxDQUFDLEtBQUssQ0FBQyw2Q0FBNkMsR0FBRyxVQUFVLENBQUMsQ0FBQztRQUN0RSxHQUFHLENBQUMsS0FBSyxDQUFDLG9CQUFvQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILElBQUksSUFBK0QsQ0FBQztBQUVwRTs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUksVUFBd0I7SUFDdkQsSUFBSSxLQUFKLElBQUksR0FBSyxJQUFJLFFBQVEsQ0FBQyxZQUFZLEVBQUUsNEJBQTRCLENBRy9ELEVBQUM7SUFFRixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZGlybmFtZSwgZXh0bmFtZSwgaXNBYnNvbHV0ZSwgcmVzb2x2ZX0gZnJvbSAncGF0aCc7XG5cbmltcG9ydCB7TG9nfSBmcm9tICcuLi91dGlscy9sb2dnaW5nLmpzJztcblxuaW1wb3J0IHtNb2R1bGVSZXNvbHZlcn0gZnJvbSAnLi9hbmFseXplci5qcyc7XG5cbi8qKiBPcHRpb25zIHVzZWQgYXQgcnVudGltZSBieSB0aGUgcGFyc2VyLiAgKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2lyY3VsYXJEZXBlbmRlbmNpZXNQYXJzZXJPcHRpb25zIHtcbiAgLyoqIFdoZXRoZXIgdG8gaWdub3JlIHR5cGUgb25seSBpbXBvcnRzIGluIGNpcmN1bGFyIGRlcGVuZGVuY3kgY2hlY2tzLiAqL1xuICBpZ25vcmVUeXBlT25seUNoZWNrcz86IHRydWU7XG59XG5cbi8qKiBDb25maWd1cmF0aW9uIGZvciBhIGNpcmN1bGFyIGRlcGVuZGVuY2llcyB0ZXN0LiAqL1xuZXhwb3J0IGludGVyZmFjZSBDaXJjdWxhckRlcGVuZGVuY2llc1Rlc3RDb25maWcgZXh0ZW5kcyBDaXJjdWxhckRlcGVuZGVuY2llc1BhcnNlck9wdGlvbnMge1xuICAvKiogQmFzZSBkaXJlY3RvcnkgdXNlZCBmb3Igc2hvcnRlbmluZyBwYXRocyBpbiB0aGUgZ29sZGVuIGZpbGUuICovXG4gIGJhc2VEaXI6IHN0cmluZztcbiAgLyoqIFBhdGggdG8gdGhlIGdvbGRlbiBmaWxlIHRoYXQgaXMgdXNlZCBmb3IgY2hlY2tpbmcgYW5kIGFwcHJvdmluZy4gKi9cbiAgZ29sZGVuRmlsZT86IHN0cmluZztcbiAgLyoqIEdsb2IgdGhhdCByZXNvbHZlcyBzb3VyY2UgZmlsZXMgd2hpY2ggc2hvdWxkIGJlIGNoZWNrZWQuICovXG4gIGdsb2I6IHN0cmluZztcbiAgLyoqXG4gICAqIE9wdGlvbmFsIG1vZHVsZSByZXNvbHZlciBmdW5jdGlvbiB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlc29sdmUgbW9kdWxlc1xuICAgKiB0byBhYnNvbHV0ZSBmaWxlIHBhdGhzLlxuICAgKi9cbiAgcmVzb2x2ZU1vZHVsZT86IE1vZHVsZVJlc29sdmVyO1xuICAvKipcbiAgICogT3B0aW9uYWwgY29tbWFuZCB0aGF0IHdpbGwgYmUgZGlzcGxheWVkIGlmIHRoZSBnb2xkZW4gY2hlY2sgZmFpbGVkLiBUaGlzIGNhbiBiZSB1c2VkXG4gICAqIHRvIGNvbnNpc3RlbnRseSB1c2Ugc2NyaXB0IGFsaWFzZXMgZm9yIGNoZWNraW5nL2FwcHJvdmluZyB0aGUgZ29sZGVuLlxuICAgKi9cbiAgYXBwcm92ZUNvbW1hbmQ/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogTG9hZHMgdGhlIGNvbmZpZ3VyYXRpb24gZm9yIHRoZSBjaXJjdWxhciBkZXBlbmRlbmNpZXMgdGVzdC4gSWYgdGhlIGNvbmZpZyBjYW5ub3QgYmVcbiAqIGxvYWRlZCwgYW4gZXJyb3Igd2lsbCBiZSBwcmludGVkIGFuZCB0aGUgcHJvY2VzcyBleGlzdHMgd2l0aCBhIG5vbi16ZXJvIGV4aXQgY29kZS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRUZXN0Q29uZmlnKGNvbmZpZ1BhdGg6IHN0cmluZyk6IFByb21pc2U8Q2lyY3VsYXJEZXBlbmRlbmNpZXNUZXN0Q29uZmlnPiB7XG4gIGNvbnN0IGNvbmZpZ0Jhc2VEaXIgPSBkaXJuYW1lKGNvbmZpZ1BhdGgpO1xuICBjb25zdCByZXNvbHZlUmVsYXRpdmVQYXRoID0gKHJlbGF0aXZlUGF0aDogc3RyaW5nKSA9PiByZXNvbHZlKGNvbmZpZ0Jhc2VEaXIsIHJlbGF0aXZlUGF0aCk7XG5cbiAgdHJ5IHtcbiAgICBsZXQgY29uZmlnOiBDaXJjdWxhckRlcGVuZGVuY2llc1Rlc3RDb25maWc7XG4gICAgc3dpdGNoIChleHRuYW1lKGNvbmZpZ1BhdGgpKSB7XG4gICAgICBjYXNlICcubWpzJzpcbiAgICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICBjb25maWcgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPENpcmN1bGFyRGVwZW5kZW5jaWVzVGVzdENvbmZpZz4oY29uZmlnUGF0aCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLmNqcyc6XG4gICAgICAgIGNvbmZpZyA9IHJlcXVpcmUoY29uZmlnUGF0aCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8gVGhlIGZpbGUgY291bGQgYmUgZWl0aGVyIENvbW1vbkpTIG9yIEVTTS5cbiAgICAgICAgLy8gQ29tbW9uSlMgaXMgdHJpZWQgZmlyc3QgdGhlbiBFU00gaWYgbG9hZGluZyBmYWlscy5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25maWcgPSByZXF1aXJlKGNvbmZpZ1BhdGgpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgaWYgKChlIGFzIGFueSkuY29kZSA9PT0gJ0VSUl9SRVFVSVJFX0VTTScpIHtcbiAgICAgICAgICAgIC8vIExvYWQgdGhlIEVTTSBjb25maWd1cmF0aW9uIGZpbGUgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICAgICAgY29uZmlnID0gYXdhaXQgbG9hZEVzbU1vZHVsZTxDaXJjdWxhckRlcGVuZGVuY2llc1Rlc3RDb25maWc+KGNvbmZpZ1BhdGgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDbG9uZSB0byBjb25maWcgb2JqZWN0LiBUaGlzIGlzIG5lZWRlZCBiZWNhdXNlIGluIEVTTSB0aGUgcHJvcGVydGllcyBhcmUgbm9uIHdyaXRlYWJsZVxuICAgIGNvbmZpZyA9IHsuLi5jb25maWd9O1xuXG4gICAgaWYgKCFpc0Fic29sdXRlKGNvbmZpZy5iYXNlRGlyKSkge1xuICAgICAgY29uZmlnLmJhc2VEaXIgPSByZXNvbHZlUmVsYXRpdmVQYXRoKGNvbmZpZy5iYXNlRGlyKTtcbiAgICB9XG4gICAgaWYgKGNvbmZpZy5nb2xkZW5GaWxlICYmICFpc0Fic29sdXRlKGNvbmZpZy5nb2xkZW5GaWxlKSkge1xuICAgICAgY29uZmlnLmdvbGRlbkZpbGUgPSByZXNvbHZlUmVsYXRpdmVQYXRoKGNvbmZpZy5nb2xkZW5GaWxlKTtcbiAgICB9XG4gICAgaWYgKCFpc0Fic29sdXRlKGNvbmZpZy5nbG9iKSkge1xuICAgICAgY29uZmlnLmdsb2IgPSByZXNvbHZlUmVsYXRpdmVQYXRoKGNvbmZpZy5nbG9iKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbmZpZztcbiAgfSBjYXRjaCAoZSkge1xuICAgIExvZy5lcnJvcignQ291bGQgbm90IGxvYWQgdGVzdCBjb25maWd1cmF0aW9uIGZpbGUgYXQ6ICcgKyBjb25maWdQYXRoKTtcbiAgICBMb2cuZXJyb3IoYEZhaWxlZCB3aXRoIGVycm9yOmAsIGUpO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxufVxuXG4vKipcbiAqIExhemlseSBjb21waWxlZCBkeW5hbWljIGltcG9ydCBsb2FkZXIgZnVuY3Rpb24uXG4gKi9cbmxldCBsb2FkOiAoPFQ+KG1vZHVsZVBhdGg6IHN0cmluZyB8IFVSTCkgPT4gUHJvbWlzZTxUPikgfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogVGhpcyB1c2VzIGEgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBhIG1vZHVsZSB3aGljaCBtYXkgYmUgRVNNLlxuICogQ29tbW9uSlMgY29kZSBjYW4gbG9hZCBFU00gY29kZSB2aWEgYSBkeW5hbWljIGltcG9ydC4gVW5mb3J0dW5hdGVseSwgVHlwZVNjcmlwdFxuICogd2lsbCBjdXJyZW50bHksIHVuY29uZGl0aW9uYWxseSBkb3dubGV2ZWwgZHluYW1pYyBpbXBvcnQgaW50byBhIHJlcXVpcmUgY2FsbC5cbiAqIHJlcXVpcmUgY2FsbHMgY2Fubm90IGxvYWQgRVNNIGNvZGUgYW5kIHdpbGwgcmVzdWx0IGluIGEgcnVudGltZSBlcnJvci4gVG8gd29ya2Fyb3VuZFxuICogdGhpcywgYSBGdW5jdGlvbiBjb25zdHJ1Y3RvciBpcyB1c2VkIHRvIHByZXZlbnQgVHlwZVNjcmlwdCBmcm9tIGNoYW5naW5nIHRoZSBkeW5hbWljIGltcG9ydC5cbiAqIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuXG4gKiBiZSBkcm9wcGVkLlxuICpcbiAqIEBwYXJhbSBtb2R1bGVQYXRoIFRoZSBwYXRoIG9mIHRoZSBtb2R1bGUgdG8gbG9hZC5cbiAqIEByZXR1cm5zIEEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSBkeW5hbWljYWxseSBpbXBvcnRlZCBtb2R1bGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb2FkRXNtTW9kdWxlPFQ+KG1vZHVsZVBhdGg6IHN0cmluZyB8IFVSTCk6IFByb21pc2U8VD4ge1xuICBsb2FkID8/PSBuZXcgRnVuY3Rpb24oJ21vZHVsZVBhdGgnLCBgcmV0dXJuIGltcG9ydChtb2R1bGVQYXRoKTtgKSBhcyBFeGNsdWRlPFxuICAgIHR5cGVvZiBsb2FkLFxuICAgIHVuZGVmaW5lZFxuICA+O1xuXG4gIHJldHVybiBsb2FkKG1vZHVsZVBhdGgpO1xufVxuIl19