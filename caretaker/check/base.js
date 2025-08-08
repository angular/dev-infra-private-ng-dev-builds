export class BaseModule {
    constructor(git, config) {
        this.git = git;
        this.config = config;
        this.data = this.retrieveData();
    }
}
//# sourceMappingURL=base.js.map