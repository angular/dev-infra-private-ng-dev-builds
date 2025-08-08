async function isGooglerOrgMember(client, username) {
    try {
        const response = await client.orgs.checkMembershipForUser({ org: 'googlers', username });
        if (response.status === 204) {
            return true;
        }
    }
    catch { }
    return false;
}
async function getCombinedChecksAndStatusesForRef(github, params) {
    const { data: checkResults } = await github.checks.listForRef(params);
    const { data: statusResults } = await github.repos.getCombinedStatusForRef(params);
    const results = [
        ...checkResults.check_runs.map((result) => ({
            type: 'check',
            name: result.name,
            result: result.status === 'completed' ? result.conclusion : result.status,
            url: result.details_url ?? '',
            check: result,
        })),
        ...statusResults.statuses.map((result) => ({
            type: 'status',
            name: result.context,
            result: result.state,
            description: result.description ?? '',
            url: result.target_url ?? '',
            status: result,
        })),
    ];
    return {
        result: results.reduce((currentResult, { result }) => {
            if (currentResult === 'pending' || ['queued', 'in_progress', 'pending'].includes(result)) {
                return 'pending';
            }
            if (currentResult === 'failing' ||
                ['failure', 'error', 'timed_out', 'cancelled'].includes(result)) {
                return 'failing';
            }
            return 'passing';
        }, null),
        results,
    };
}
export default {
    getCombinedChecksAndStatusesForRef,
    isGooglerOrgMember,
};
//# sourceMappingURL=github-macros.js.map