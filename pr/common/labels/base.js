export const createTypedObject = (LabelConstructor) => {
    return (val) => {
        for (const key in val) {
            val[key] = new LabelConstructor(val[key]);
        }
        return val;
    };
};
export class Label {
    constructor(params) {
        this.params = params;
        this.repositories = this.params.repositories || [
            ManagedRepositories.ANGULAR,
            ManagedRepositories.ANGULAR_CLI,
            ManagedRepositories.COMPONENTS,
            ManagedRepositories.DEV_INFRA,
        ];
        this.name = this.params.name;
        this.description = this.params.description;
        this.color = this.params.color;
    }
}
export var ManagedRepositories;
(function (ManagedRepositories) {
    ManagedRepositories["COMPONENTS"] = "components";
    ManagedRepositories["ANGULAR"] = "angular";
    ManagedRepositories["ANGULAR_CLI"] = "angular-cli";
    ManagedRepositories["DEV_INFRA"] = "dev-infra";
})(ManagedRepositories || (ManagedRepositories = {}));
//# sourceMappingURL=base.js.map