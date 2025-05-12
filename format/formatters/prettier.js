/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { join } from 'path';
import { ChildProcess } from '../../utils/child-process.js';
import { Log } from '../../utils/logging.js';
import { Formatter } from './base-formatter.js';
/**
 * Formatter for running prettier against Typescript and Javascript files.
 */
export class Prettier extends Formatter {
    constructor() {
        super(...arguments);
        this.name = 'prettier';
        this.binaryFilePath = join(this.git.baseDir, 'node_modules/.bin/prettier');
        this.defaultFileMatcher = [
            '**/*.{js,cjs,mjs}',
            '**/*.{ts,cts,mts}',
            '**/*.{json,json5}',
            '**/*.{yml,yaml}',
        ];
        /**
         * The configuration path of the prettier config, obtained during construction to prevent needing
         * to discover it repeatedly for each execution.
         */
        this.configPath = this.config['prettier']
            ? ChildProcess.spawnSync(this.binaryFilePath, [
                '--find-config-path',
                join(process.cwd(), 'dummy.js'),
            ]).stdout.trim()
            : '';
        this.actions = {
            check: {
                commandFlags: `--config ${this.configPath} --check`,
                callback: (_, code, stdout) => {
                    return code !== 0;
                },
            },
            format: {
                commandFlags: `--config ${this.configPath} --write`,
                callback: (file, code, _, stderr) => {
                    if (code !== 0) {
                        Log.error(`Error running prettier on: ${file}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJldHRpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvZm9ybWF0L2Zvcm1hdHRlcnMvcHJldHRpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLElBQUksRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUUxQixPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDMUQsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRTNDLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUU5Qzs7R0FFRztBQUNILE1BQU0sT0FBTyxRQUFTLFNBQVEsU0FBUztJQUF2Qzs7UUFDVyxTQUFJLEdBQUcsVUFBVSxDQUFDO1FBRWxCLG1CQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLDRCQUE0QixDQUFDLENBQUM7UUFFdEUsdUJBQWtCLEdBQUc7WUFDNUIsbUJBQW1CO1lBQ25CLG1CQUFtQjtZQUNuQixtQkFBbUI7WUFDbkIsaUJBQWlCO1NBQ2xCLENBQUM7UUFFRjs7O1dBR0c7UUFDSyxlQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFDMUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtnQkFDMUMsb0JBQW9CO2dCQUNwQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLFVBQVUsQ0FBQzthQUNoQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtZQUNsQixDQUFDLENBQUMsRUFBRSxDQUFDO1FBRUUsWUFBTyxHQUFHO1lBQ2pCLEtBQUssRUFBRTtnQkFDTCxZQUFZLEVBQUUsWUFBWSxJQUFJLENBQUMsVUFBVSxVQUFVO2dCQUNuRCxRQUFRLEVBQUUsQ0FBQyxDQUFTLEVBQUUsSUFBNkIsRUFBRSxNQUFjLEVBQUUsRUFBRTtvQkFDckUsT0FBTyxJQUFJLEtBQUssQ0FBQyxDQUFDO2dCQUNwQixDQUFDO2FBQ0Y7WUFDRCxNQUFNLEVBQUU7Z0JBQ04sWUFBWSxFQUFFLFlBQVksSUFBSSxDQUFDLFVBQVUsVUFBVTtnQkFDbkQsUUFBUSxFQUFFLENBQUMsSUFBWSxFQUFFLElBQTZCLEVBQUUsQ0FBUyxFQUFFLE1BQWMsRUFBRSxFQUFFO29CQUNuRixJQUFJLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDZixHQUFHLENBQUMsS0FBSyxDQUFDLDhCQUE4QixJQUFJLEVBQUUsQ0FBQyxDQUFDO3dCQUNoRCxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUNsQixHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7d0JBQ1osT0FBTyxJQUFJLENBQUM7b0JBQ2QsQ0FBQztvQkFDRCxPQUFPLEtBQUssQ0FBQztnQkFDZixDQUFDO2FBQ0Y7U0FDRixDQUFDO0lBQ0osQ0FBQztDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7am9pbn0gZnJvbSAncGF0aCc7XG5cbmltcG9ydCB7Q2hpbGRQcm9jZXNzfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcblxuaW1wb3J0IHtGb3JtYXR0ZXJ9IGZyb20gJy4vYmFzZS1mb3JtYXR0ZXIuanMnO1xuXG4vKipcbiAqIEZvcm1hdHRlciBmb3IgcnVubmluZyBwcmV0dGllciBhZ2FpbnN0IFR5cGVzY3JpcHQgYW5kIEphdmFzY3JpcHQgZmlsZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBQcmV0dGllciBleHRlbmRzIEZvcm1hdHRlciB7XG4gIG92ZXJyaWRlIG5hbWUgPSAncHJldHRpZXInO1xuXG4gIG92ZXJyaWRlIGJpbmFyeUZpbGVQYXRoID0gam9pbih0aGlzLmdpdC5iYXNlRGlyLCAnbm9kZV9tb2R1bGVzLy5iaW4vcHJldHRpZXInKTtcblxuICBvdmVycmlkZSBkZWZhdWx0RmlsZU1hdGNoZXIgPSBbXG4gICAgJyoqLyoue2pzLGNqcyxtanN9JyxcbiAgICAnKiovKi57dHMsY3RzLG10c30nLFxuICAgICcqKi8qLntqc29uLGpzb241fScsXG4gICAgJyoqLyoue3ltbCx5YW1sfScsXG4gIF07XG5cbiAgLyoqXG4gICAqIFRoZSBjb25maWd1cmF0aW9uIHBhdGggb2YgdGhlIHByZXR0aWVyIGNvbmZpZywgb2J0YWluZWQgZHVyaW5nIGNvbnN0cnVjdGlvbiB0byBwcmV2ZW50IG5lZWRpbmdcbiAgICogdG8gZGlzY292ZXIgaXQgcmVwZWF0ZWRseSBmb3IgZWFjaCBleGVjdXRpb24uXG4gICAqL1xuICBwcml2YXRlIGNvbmZpZ1BhdGggPSB0aGlzLmNvbmZpZ1sncHJldHRpZXInXVxuICAgID8gQ2hpbGRQcm9jZXNzLnNwYXduU3luYyh0aGlzLmJpbmFyeUZpbGVQYXRoLCBbXG4gICAgICAgICctLWZpbmQtY29uZmlnLXBhdGgnLFxuICAgICAgICBqb2luKHByb2Nlc3MuY3dkKCksICdkdW1teS5qcycpLFxuICAgICAgXSkuc3Rkb3V0LnRyaW0oKVxuICAgIDogJyc7XG5cbiAgb3ZlcnJpZGUgYWN0aW9ucyA9IHtcbiAgICBjaGVjazoge1xuICAgICAgY29tbWFuZEZsYWdzOiBgLS1jb25maWcgJHt0aGlzLmNvbmZpZ1BhdGh9IC0tY2hlY2tgLFxuICAgICAgY2FsbGJhY2s6IChfOiBzdHJpbmcsIGNvZGU6IG51bWJlciB8IE5vZGVKUy5TaWduYWxzLCBzdGRvdXQ6IHN0cmluZykgPT4ge1xuICAgICAgICByZXR1cm4gY29kZSAhPT0gMDtcbiAgICAgIH0sXG4gICAgfSxcbiAgICBmb3JtYXQ6IHtcbiAgICAgIGNvbW1hbmRGbGFnczogYC0tY29uZmlnICR7dGhpcy5jb25maWdQYXRofSAtLXdyaXRlYCxcbiAgICAgIGNhbGxiYWNrOiAoZmlsZTogc3RyaW5nLCBjb2RlOiBudW1iZXIgfCBOb2RlSlMuU2lnbmFscywgXzogc3RyaW5nLCBzdGRlcnI6IHN0cmluZykgPT4ge1xuICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgIExvZy5lcnJvcihgRXJyb3IgcnVubmluZyBwcmV0dGllciBvbjogJHtmaWxlfWApO1xuICAgICAgICAgIExvZy5lcnJvcihzdGRlcnIpO1xuICAgICAgICAgIExvZy5lcnJvcigpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==