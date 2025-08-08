export async function isPullRequestMerged(api, id) {
    const { data } = await api.github.pulls.get({ ...api.remoteParams, pull_number: id });
    if (data.merged) {
        return true;
    }
    return await isPullRequestClosedWithAssociatedCommit(api, id);
}
async function isPullRequestClosedWithAssociatedCommit(api, id) {
    const events = await api.github.paginate(api.github.issues.listEvents, {
        ...api.remoteParams,
        issue_number: id,
    });
    for (let i = events.length - 1; i >= 0; i--) {
        const { event, commit_id } = events[i];
        if (event === 'reopened') {
            return false;
        }
        if (event === 'closed' && commit_id) {
            return true;
        }
        if (event === 'referenced' &&
            commit_id &&
            (await isCommitClosingPullRequest(api, commit_id, id))) {
            return true;
        }
    }
    return false;
}
async function isCommitClosingPullRequest(api, sha, id) {
    const { data } = await api.github.repos.getCommit({ ...api.remoteParams, ref: sha });
    return data.commit.message.match(new RegExp(`(?:close[sd]?|fix(?:e[sd]?)|resolve[sd]?):? #${id}(?!\\d)`, 'i'));
}
//# sourceMappingURL=pull-request-state.js.map