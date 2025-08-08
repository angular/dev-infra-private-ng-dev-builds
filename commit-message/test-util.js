export function commitMessageBuilder(defaults) {
    return (params = {}) => {
        const { prefix, type, scope, summary, body, footer } = { ...defaults, ...params };
        return `${prefix}${type}${scope ? '(' + scope + ')' : ''}: ${summary}\n\n${body}\n\n${footer}`;
    };
}
//# sourceMappingURL=test-util.js.map