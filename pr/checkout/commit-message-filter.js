#!/usr/bin/env node
"use strict";
main();
function main() {
    const [prNumber] = process.argv.slice(2);
    if (!prNumber) {
        console.error('No pull request number specified.');
        process.exit(1);
    }
    let commitMessage = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
        const chunk = process.stdin.read();
        if (chunk !== null) {
            commitMessage += chunk;
        }
    });
    process.stdin.on('end', () => {
        console.info(rewriteCommitMessage(commitMessage, prNumber));
    });
}
function rewriteCommitMessage(message, prNumber) {
    const lines = message.split(/\n/);
    lines.push(`Closes #${prNumber} as a pr takeover`);
    return lines.join('\n');
}
//# sourceMappingURL=commit-message-filter.js.map