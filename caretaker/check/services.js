import { bold, green, Log, red } from '../../utils/logging.js';
import { BaseModule } from './base.js';
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
        Log.info(bold('Service Statuses'));
        for (const status of statuses) {
            const name = status.name.padEnd(serviceNameMinLength);
            if (status.status === 'passing') {
                Log.info(`${name} ${green('✔')}`);
            }
            else {
                Log.info(`${name} ${red('✘')} (Updated: ${status.lastUpdated.toLocaleString()})`);
                Log.info(`  Details: ${status.description}`);
                Log.info(`  Status URL: ${status.statusUrl}`);
            }
        }
        Log.info();
    }
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
//# sourceMappingURL=services.js.map