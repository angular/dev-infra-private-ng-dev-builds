export class Formatter {
    constructor(git, config) {
        this.git = git;
        this.config = config;
    }
    commandFor(action) {
        switch (action) {
            case 'check':
                return `${this.binaryFilePath} ${this.actions.check.commandFlags}`;
            case 'format':
                return `${this.binaryFilePath} ${this.actions.format.commandFlags}`;
            default:
                throw Error('Unknown action type');
        }
    }
    callbackFor(action) {
        switch (action) {
            case 'check':
                return this.actions.check.callback;
            case 'format':
                return this.actions.format.callback;
            default:
                throw Error('Unknown action type');
        }
    }
    isEnabled() {
        return !!this.config[this.name];
    }
    getFileMatcher() {
        return this.config[this.name] ? this.matchers : [];
    }
}
//# sourceMappingURL=base-formatter.js.map