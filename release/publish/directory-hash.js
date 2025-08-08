import { hashElement } from 'folder-hash';
export class DirectoryHash {
    static async compute(dirPath) {
        return (await hashElement(dirPath, {})).hash;
    }
}
//# sourceMappingURL=directory-hash.js.map