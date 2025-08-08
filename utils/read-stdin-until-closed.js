export class ReadBufferFromStdinError extends Error {
}
export function readBufferFromStdinUntilClosed(input = process.stdin) {
    return new Promise((resolve, reject) => {
        const data = [];
        input.on('data', (chunk) => data.push(chunk));
        input.on('end', () => resolve(Buffer.concat(data)));
        input.on('error', () => reject(new ReadBufferFromStdinError()));
        input.on('timeout', () => reject(new ReadBufferFromStdinError('Unexpected timeout')));
    });
}
//# sourceMappingURL=read-stdin-until-closed.js.map