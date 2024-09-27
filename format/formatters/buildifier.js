/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { join } from 'path';
import { Log } from '../../utils/logging.js';
import { Formatter } from './base-formatter.js';
/**
 * Formatter for running buildifier against bazel related files.
 */
export class Buildifier extends Formatter {
    constructor() {
        super(...arguments);
        this.name = 'buildifier';
        this.binaryFilePath = join(this.git.baseDir, 'node_modules/.bin/buildifier');
        this.defaultFileMatcher = ['**/*.bzl', '**/BUILD.bazel', '**/WORKSPACE', '**/BUILD'];
        this.actions = {
            check: {
                commandFlags: `${BAZEL_WARNING_FLAG} --lint=warn --mode=check --format=json`,
                callback: (_, code, stdout) => {
                    // For cases where `stdout` is empty, we instead use an empty object to still allow parsing.
                    stdout = stdout || '{}';
                    return code !== 0 || !JSON.parse(stdout).success;
                },
            },
            format: {
                commandFlags: `${BAZEL_WARNING_FLAG} --lint=fix --mode=fix`,
                callback: (file, code, _, stderr) => {
                    if (code !== 0) {
                        Log.error(`Error running buildifier on: ${file}`);
                        Log.error(stderr);
                        Log.error();
                        return true;
                    }
                    return false;
                },
            },
        };
    }
}
// The warning flag for buildifier copied from angular/angular's usage.
const BAZEL_WARNING_FLAG = `--warnings=attr-cfg,attr-license,attr-non-empty,attr-output-default,` +
    `attr-single-file,ctx-args,depset-iteration,depset-union,dict-concatenation,` +
    `duplicated-name,filetype,git-repository,http-archive,integer-division,load,` +
    `native-build,native-package,output-group,package-name,package-on-top,positional-args,` +
    `redefined-variable,repository-name,string-iteration,unused-variable`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRpZmllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9mb3JtYXQvZm9ybWF0dGVycy9idWlsZGlmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFFMUIsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRTNDLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUU5Qzs7R0FFRztBQUNILE1BQU0sT0FBTyxVQUFXLFNBQVEsU0FBUztJQUF6Qzs7UUFDVyxTQUFJLEdBQUcsWUFBWSxDQUFDO1FBRXBCLG1CQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLDhCQUE4QixDQUFDLENBQUM7UUFFeEUsdUJBQWtCLEdBQUcsQ0FBQyxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRWhGLFlBQU8sR0FBRztZQUNqQixLQUFLLEVBQUU7Z0JBQ0wsWUFBWSxFQUFFLEdBQUcsa0JBQWtCLHlDQUF5QztnQkFDNUUsUUFBUSxFQUFFLENBQUMsQ0FBUyxFQUFFLElBQTZCLEVBQUUsTUFBYyxFQUFFLEVBQUU7b0JBQ3JFLDRGQUE0RjtvQkFDNUYsTUFBTSxHQUFHLE1BQU0sSUFBSSxJQUFJLENBQUM7b0JBQ3hCLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUF3QixDQUFDLE9BQU8sQ0FBQztnQkFDM0UsQ0FBQzthQUNGO1lBQ0QsTUFBTSxFQUFFO2dCQUNOLFlBQVksRUFBRSxHQUFHLGtCQUFrQix3QkFBd0I7Z0JBQzNELFFBQVEsRUFBRSxDQUFDLElBQVksRUFBRSxJQUE2QixFQUFFLENBQVMsRUFBRSxNQUFjLEVBQUUsRUFBRTtvQkFDbkYsSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ2YsR0FBRyxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsSUFBSSxFQUFFLENBQUMsQ0FBQzt3QkFDbEQsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDbEIsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO3dCQUNaLE9BQU8sSUFBSSxDQUFDO29CQUNkLENBQUM7b0JBQ0QsT0FBTyxLQUFLLENBQUM7Z0JBQ2YsQ0FBQzthQUNGO1NBQ0YsQ0FBQztJQUNKLENBQUM7Q0FBQTtBQUVELHVFQUF1RTtBQUN2RSxNQUFNLGtCQUFrQixHQUN0QixzRUFBc0U7SUFDdEUsNkVBQTZFO0lBQzdFLDZFQUE2RTtJQUM3RSx1RkFBdUY7SUFDdkYscUVBQXFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtqb2lufSBmcm9tICdwYXRoJztcblxuaW1wb3J0IHtMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuXG5pbXBvcnQge0Zvcm1hdHRlcn0gZnJvbSAnLi9iYXNlLWZvcm1hdHRlci5qcyc7XG5cbi8qKlxuICogRm9ybWF0dGVyIGZvciBydW5uaW5nIGJ1aWxkaWZpZXIgYWdhaW5zdCBiYXplbCByZWxhdGVkIGZpbGVzLlxuICovXG5leHBvcnQgY2xhc3MgQnVpbGRpZmllciBleHRlbmRzIEZvcm1hdHRlciB7XG4gIG92ZXJyaWRlIG5hbWUgPSAnYnVpbGRpZmllcic7XG5cbiAgb3ZlcnJpZGUgYmluYXJ5RmlsZVBhdGggPSBqb2luKHRoaXMuZ2l0LmJhc2VEaXIsICdub2RlX21vZHVsZXMvLmJpbi9idWlsZGlmaWVyJyk7XG5cbiAgb3ZlcnJpZGUgZGVmYXVsdEZpbGVNYXRjaGVyID0gWycqKi8qLmJ6bCcsICcqKi9CVUlMRC5iYXplbCcsICcqKi9XT1JLU1BBQ0UnLCAnKiovQlVJTEQnXTtcblxuICBvdmVycmlkZSBhY3Rpb25zID0ge1xuICAgIGNoZWNrOiB7XG4gICAgICBjb21tYW5kRmxhZ3M6IGAke0JBWkVMX1dBUk5JTkdfRkxBR30gLS1saW50PXdhcm4gLS1tb2RlPWNoZWNrIC0tZm9ybWF0PWpzb25gLFxuICAgICAgY2FsbGJhY2s6IChfOiBzdHJpbmcsIGNvZGU6IG51bWJlciB8IE5vZGVKUy5TaWduYWxzLCBzdGRvdXQ6IHN0cmluZykgPT4ge1xuICAgICAgICAvLyBGb3IgY2FzZXMgd2hlcmUgYHN0ZG91dGAgaXMgZW1wdHksIHdlIGluc3RlYWQgdXNlIGFuIGVtcHR5IG9iamVjdCB0byBzdGlsbCBhbGxvdyBwYXJzaW5nLlxuICAgICAgICBzdGRvdXQgPSBzdGRvdXQgfHwgJ3t9JztcbiAgICAgICAgcmV0dXJuIGNvZGUgIT09IDAgfHwgIShKU09OLnBhcnNlKHN0ZG91dCkgYXMge3N1Y2Nlc3M6IGJvb2xlYW59KS5zdWNjZXNzO1xuICAgICAgfSxcbiAgICB9LFxuICAgIGZvcm1hdDoge1xuICAgICAgY29tbWFuZEZsYWdzOiBgJHtCQVpFTF9XQVJOSU5HX0ZMQUd9IC0tbGludD1maXggLS1tb2RlPWZpeGAsXG4gICAgICBjYWxsYmFjazogKGZpbGU6IHN0cmluZywgY29kZTogbnVtYmVyIHwgTm9kZUpTLlNpZ25hbHMsIF86IHN0cmluZywgc3RkZXJyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICBMb2cuZXJyb3IoYEVycm9yIHJ1bm5pbmcgYnVpbGRpZmllciBvbjogJHtmaWxlfWApO1xuICAgICAgICAgIExvZy5lcnJvcihzdGRlcnIpO1xuICAgICAgICAgIExvZy5lcnJvcigpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cblxuLy8gVGhlIHdhcm5pbmcgZmxhZyBmb3IgYnVpbGRpZmllciBjb3BpZWQgZnJvbSBhbmd1bGFyL2FuZ3VsYXIncyB1c2FnZS5cbmNvbnN0IEJBWkVMX1dBUk5JTkdfRkxBRyA9XG4gIGAtLXdhcm5pbmdzPWF0dHItY2ZnLGF0dHItbGljZW5zZSxhdHRyLW5vbi1lbXB0eSxhdHRyLW91dHB1dC1kZWZhdWx0LGAgK1xuICBgYXR0ci1zaW5nbGUtZmlsZSxjdHgtYXJncyxkZXBzZXQtaXRlcmF0aW9uLGRlcHNldC11bmlvbixkaWN0LWNvbmNhdGVuYXRpb24sYCArXG4gIGBkdXBsaWNhdGVkLW5hbWUsZmlsZXR5cGUsZ2l0LXJlcG9zaXRvcnksaHR0cC1hcmNoaXZlLGludGVnZXItZGl2aXNpb24sbG9hZCxgICtcbiAgYG5hdGl2ZS1idWlsZCxuYXRpdmUtcGFja2FnZSxvdXRwdXQtZ3JvdXAscGFja2FnZS1uYW1lLHBhY2thZ2Utb24tdG9wLHBvc2l0aW9uYWwtYXJncyxgICtcbiAgYHJlZGVmaW5lZC12YXJpYWJsZSxyZXBvc2l0b3J5LW5hbWUsc3RyaW5nLWl0ZXJhdGlvbix1bnVzZWQtdmFyaWFibGVgO1xuIl19