import { PullApproveGroupStateDependencyError } from './condition_errors.js';
import { getOrCreateGlob } from './utils.js';
export class PullApproveStringArray extends Array {
    include(pattern) {
        return new PullApproveStringArray(...this.filter((s) => getOrCreateGlob(pattern).match(s)));
    }
    exclude(pattern) {
        return new PullApproveStringArray(...this.filter((s) => !getOrCreateGlob(pattern).match(s)));
    }
}
export class PullApproveGroupArray extends Array {
    include(pattern) {
        return new PullApproveGroupArray(...this.filter((s) => s.groupName.match(pattern)));
    }
    exclude(pattern) {
        return new PullApproveGroupArray(...this.filter((s) => s.groupName.match(pattern)));
    }
    get approved() {
        throw new PullApproveGroupStateDependencyError();
    }
    get pending() {
        throw new PullApproveGroupStateDependencyError();
    }
    get active() {
        throw new PullApproveGroupStateDependencyError();
    }
    get inactive() {
        throw new PullApproveGroupStateDependencyError();
    }
    get rejected() {
        throw new PullApproveGroupStateDependencyError();
    }
    get names() {
        return this.map((g) => g.groupName);
    }
}
//# sourceMappingURL=pullapprove_arrays.js.map