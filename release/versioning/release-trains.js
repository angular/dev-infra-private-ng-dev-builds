export class ReleaseTrain {
    constructor(branchName, version) {
        this.branchName = branchName;
        this.version = version;
        this.isMajor = this.version.minor === 0 && this.version.patch === 0;
    }
}
//# sourceMappingURL=release-trains.js.map