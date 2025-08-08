import { statSync } from 'fs';
export function getFileStatus(filePath) {
    try {
        return statSync(filePath);
    }
    catch {
        return null;
    }
}
export function convertPathToForwardSlash(path) {
    return path.replace(/\\/g, '/');
}
//# sourceMappingURL=file_system.js.map