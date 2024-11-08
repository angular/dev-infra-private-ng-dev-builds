/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { bold, green, Log, red } from '../../utils/logging.js';
import { BaseModule } from './base.js';
/** List of services Angular relies on. */
export const services = [
    {
        prettyUrl: 'https://status.saucelabs.com',
        url: 'https://status.saucelabs.com/api/v2/status.json',
        name: 'Saucelabs',
    },
    {
        prettyUrl: 'https://status.npmjs.org/',
        url: 'https://status.npmjs.org/api/v2/status.json',
        name: 'Npm',
    },
    {
        prettyUrl: 'https://www.githubstatus.com',
        url: 'https://www.githubstatus.com/api/v2/status.json',
        name: 'Github',
    },
];
export class ServicesModule extends BaseModule {
    async retrieveData() {
        return Promise.all(services.map((service) => this.getStatusFromStandardApi(service)));
    }
    async printToTerminal() {
        const statuses = await this.data;
        const serviceNameMinLength = Math.max(...statuses.map((service) => service.name.length));
        Log.info.group(bold('Service Statuses'));
        for (const status of statuses) {
            const name = status.name.padEnd(serviceNameMinLength);
            if (status.status === 'passing') {
                Log.info(`${name} ${green('✔')}`);
            }
            else {
                Log.info.group(`${name} ${red('✘')} (Updated: ${status.lastUpdated.toLocaleString()})`);
                Log.info(`  Details: ${status.description}`);
                Log.info(`  Status URL: ${status.statusUrl}`);
                Log.info.groupEnd();
            }
        }
        Log.info.groupEnd();
        Log.info();
    }
    /** Retrieve the status information for a service which uses a standard API response. */
    async getStatusFromStandardApi(service) {
        try {
            const result = (await fetch(service.url).then((r) => r.json()));
            const status = result.status.indicator === 'none' ? 'passing' : 'failing';
            return {
                name: service.name,
                statusUrl: service.prettyUrl,
                status,
                description: result.status.description,
                lastUpdated: new Date(result.page.updated_at),
            };
        }
        catch {
            return {
                name: service.name,
                statusUrl: service.prettyUrl,
                status: 'failing',
                description: `Unable to retrieve status from ${service.name}`,
                lastUpdated: new Date(),
            };
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvY2FyZXRha2VyL2NoZWNrL3NlcnZpY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUM3RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBK0JyQywwQ0FBMEM7QUFDMUMsTUFBTSxDQUFDLE1BQU0sUUFBUSxHQUFvQjtJQUN2QztRQUNFLFNBQVMsRUFBRSw4QkFBOEI7UUFDekMsR0FBRyxFQUFFLGlEQUFpRDtRQUN0RCxJQUFJLEVBQUUsV0FBVztLQUNsQjtJQUNEO1FBQ0UsU0FBUyxFQUFFLDJCQUEyQjtRQUN0QyxHQUFHLEVBQUUsNkNBQTZDO1FBQ2xELElBQUksRUFBRSxLQUFLO0tBQ1o7SUFDRDtRQUNFLFNBQVMsRUFBRSw4QkFBOEI7UUFDekMsR0FBRyxFQUFFLGlEQUFpRDtRQUN0RCxJQUFJLEVBQUUsUUFBUTtLQUNmO0NBQ0YsQ0FBQztBQUVGLE1BQU0sT0FBTyxjQUFlLFNBQVEsVUFBK0I7SUFDeEQsS0FBSyxDQUFDLFlBQVk7UUFDekIsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUVRLEtBQUssQ0FBQyxlQUFlO1FBQzVCLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQztRQUNqQyxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDekYsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUN6QyxLQUFLLE1BQU0sTUFBTSxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQzlCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFDdEQsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNoQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDcEMsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxNQUFNLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDeEYsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO2dCQUM3QyxHQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztnQkFDOUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixDQUFDO1FBQ0gsQ0FBQztRQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztJQUVELHdGQUF3RjtJQUN4RixLQUFLLENBQUMsd0JBQXdCLENBQUMsT0FBc0I7UUFDbkQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxNQUFNLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBdUIsQ0FBQztZQUN0RixNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQzFFLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJO2dCQUNsQixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7Z0JBQzVCLE1BQU07Z0JBQ04sV0FBVyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVztnQkFDdEMsV0FBVyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO2FBQzlDLENBQUM7UUFDSixDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsT0FBTztnQkFDTCxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7Z0JBQ2xCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztnQkFDNUIsTUFBTSxFQUFFLFNBQVM7Z0JBQ2pCLFdBQVcsRUFBRSxrQ0FBa0MsT0FBTyxDQUFDLElBQUksRUFBRTtnQkFDN0QsV0FBVyxFQUFFLElBQUksSUFBSSxFQUFFO2FBQ3hCLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Ym9sZCwgZ3JlZW4sIExvZywgcmVkfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7QmFzZU1vZHVsZX0gZnJvbSAnLi9iYXNlLmpzJztcblxuaW50ZXJmYWNlIFNlcnZpY2VDb25maWcge1xuICBuYW1lOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xuICBwcmV0dHlVcmw6IHN0cmluZztcbn1cblxuLyoqXG4gKiBTdGF0dXMgSFRUUCByZXNwb25zZXMgd2hpY2ggYXJlIGNvbW1vbmx5IHVzZWQgYnkgc2VydmljZXMgbGlrZSBHaXRIdWIuXG4gKiBTZWUgZm9yIGV4YW1wbGU6IGh0dHBzOi8vd3d3LmdpdGh1YnN0YXR1cy5jb20vYXBpLlxuICovXG5pbnRlcmZhY2UgU3RhdHVzSHR0cFJlc3BvbnNlIHtcbiAgcGFnZToge1xuICAgIHVwZGF0ZWRfYXQ6IHN0cmluZztcbiAgfTtcbiAgc3RhdHVzOiB7XG4gICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICBpbmRpY2F0b3I6ICdub25lJyB8ICdtaW5vcicgfCAnbWFqb3InIHwgJ2NyaXRpY2FsJztcbiAgfTtcbn1cblxuLyoqIFRoZSByZXN1bHRzIG9mIGNoZWNraW5nIHRoZSBzdGF0dXMgb2YgYSBzZXJ2aWNlICovXG5pbnRlcmZhY2UgU3RhdHVzQ2hlY2tSZXN1bHQge1xuICBuYW1lOiBzdHJpbmc7XG4gIHN0YXR1czogJ3Bhc3NpbmcnIHwgJ2ZhaWxpbmcnO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICBsYXN0VXBkYXRlZDogRGF0ZTtcbiAgc3RhdHVzVXJsOiBzdHJpbmc7XG59XG5cbi8qKiBMaXN0IG9mIHNlcnZpY2VzIEFuZ3VsYXIgcmVsaWVzIG9uLiAqL1xuZXhwb3J0IGNvbnN0IHNlcnZpY2VzOiBTZXJ2aWNlQ29uZmlnW10gPSBbXG4gIHtcbiAgICBwcmV0dHlVcmw6ICdodHRwczovL3N0YXR1cy5zYXVjZWxhYnMuY29tJyxcbiAgICB1cmw6ICdodHRwczovL3N0YXR1cy5zYXVjZWxhYnMuY29tL2FwaS92Mi9zdGF0dXMuanNvbicsXG4gICAgbmFtZTogJ1NhdWNlbGFicycsXG4gIH0sXG4gIHtcbiAgICBwcmV0dHlVcmw6ICdodHRwczovL3N0YXR1cy5ucG1qcy5vcmcvJyxcbiAgICB1cmw6ICdodHRwczovL3N0YXR1cy5ucG1qcy5vcmcvYXBpL3YyL3N0YXR1cy5qc29uJyxcbiAgICBuYW1lOiAnTnBtJyxcbiAgfSxcbiAge1xuICAgIHByZXR0eVVybDogJ2h0dHBzOi8vd3d3LmdpdGh1YnN0YXR1cy5jb20nLFxuICAgIHVybDogJ2h0dHBzOi8vd3d3LmdpdGh1YnN0YXR1cy5jb20vYXBpL3YyL3N0YXR1cy5qc29uJyxcbiAgICBuYW1lOiAnR2l0aHViJyxcbiAgfSxcbl07XG5cbmV4cG9ydCBjbGFzcyBTZXJ2aWNlc01vZHVsZSBleHRlbmRzIEJhc2VNb2R1bGU8U3RhdHVzQ2hlY2tSZXN1bHRbXT4ge1xuICBvdmVycmlkZSBhc3luYyByZXRyaWV2ZURhdGEoKSB7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHNlcnZpY2VzLm1hcCgoc2VydmljZSkgPT4gdGhpcy5nZXRTdGF0dXNGcm9tU3RhbmRhcmRBcGkoc2VydmljZSkpKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHByaW50VG9UZXJtaW5hbCgpIHtcbiAgICBjb25zdCBzdGF0dXNlcyA9IGF3YWl0IHRoaXMuZGF0YTtcbiAgICBjb25zdCBzZXJ2aWNlTmFtZU1pbkxlbmd0aCA9IE1hdGgubWF4KC4uLnN0YXR1c2VzLm1hcCgoc2VydmljZSkgPT4gc2VydmljZS5uYW1lLmxlbmd0aCkpO1xuICAgIExvZy5pbmZvLmdyb3VwKGJvbGQoJ1NlcnZpY2UgU3RhdHVzZXMnKSk7XG4gICAgZm9yIChjb25zdCBzdGF0dXMgb2Ygc3RhdHVzZXMpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBzdGF0dXMubmFtZS5wYWRFbmQoc2VydmljZU5hbWVNaW5MZW5ndGgpO1xuICAgICAgaWYgKHN0YXR1cy5zdGF0dXMgPT09ICdwYXNzaW5nJykge1xuICAgICAgICBMb2cuaW5mbyhgJHtuYW1lfSAke2dyZWVuKCfinJQnKX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIExvZy5pbmZvLmdyb3VwKGAke25hbWV9ICR7cmVkKCfinJgnKX0gKFVwZGF0ZWQ6ICR7c3RhdHVzLmxhc3RVcGRhdGVkLnRvTG9jYWxlU3RyaW5nKCl9KWApO1xuICAgICAgICBMb2cuaW5mbyhgICBEZXRhaWxzOiAke3N0YXR1cy5kZXNjcmlwdGlvbn1gKTtcbiAgICAgICAgTG9nLmluZm8oYCAgU3RhdHVzIFVSTDogJHtzdGF0dXMuc3RhdHVzVXJsfWApO1xuICAgICAgICBMb2cuaW5mby5ncm91cEVuZCgpO1xuICAgICAgfVxuICAgIH1cbiAgICBMb2cuaW5mby5ncm91cEVuZCgpO1xuICAgIExvZy5pbmZvKCk7XG4gIH1cblxuICAvKiogUmV0cmlldmUgdGhlIHN0YXR1cyBpbmZvcm1hdGlvbiBmb3IgYSBzZXJ2aWNlIHdoaWNoIHVzZXMgYSBzdGFuZGFyZCBBUEkgcmVzcG9uc2UuICovXG4gIGFzeW5jIGdldFN0YXR1c0Zyb21TdGFuZGFyZEFwaShzZXJ2aWNlOiBTZXJ2aWNlQ29uZmlnKTogUHJvbWlzZTxTdGF0dXNDaGVja1Jlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSAoYXdhaXQgZmV0Y2goc2VydmljZS51cmwpLnRoZW4oKHIpID0+IHIuanNvbigpKSkgYXMgU3RhdHVzSHR0cFJlc3BvbnNlO1xuICAgICAgY29uc3Qgc3RhdHVzID0gcmVzdWx0LnN0YXR1cy5pbmRpY2F0b3IgPT09ICdub25lJyA/ICdwYXNzaW5nJyA6ICdmYWlsaW5nJztcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IHNlcnZpY2UubmFtZSxcbiAgICAgICAgc3RhdHVzVXJsOiBzZXJ2aWNlLnByZXR0eVVybCxcbiAgICAgICAgc3RhdHVzLFxuICAgICAgICBkZXNjcmlwdGlvbjogcmVzdWx0LnN0YXR1cy5kZXNjcmlwdGlvbixcbiAgICAgICAgbGFzdFVwZGF0ZWQ6IG5ldyBEYXRlKHJlc3VsdC5wYWdlLnVwZGF0ZWRfYXQpLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IHNlcnZpY2UubmFtZSxcbiAgICAgICAgc3RhdHVzVXJsOiBzZXJ2aWNlLnByZXR0eVVybCxcbiAgICAgICAgc3RhdHVzOiAnZmFpbGluZycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgVW5hYmxlIHRvIHJldHJpZXZlIHN0YXR1cyBmcm9tICR7c2VydmljZS5uYW1lfWAsXG4gICAgICAgIGxhc3RVcGRhdGVkOiBuZXcgRGF0ZSgpLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==