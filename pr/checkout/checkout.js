/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { green, Log, red } from '../../utils/logging.js';
import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
import { Prompt } from '../../utils/prompt.js';
import { checkoutToTargetBranch } from './target.js';
import { checkoutAsPrTakeover } from './takeover.js';
export async function checkoutPullRequest(params) {
    const { pr, takeover, target } = params;
    /** An authenticated git client. */
    const git = await AuthenticatedGitClient.get();
    if (takeover && target) {
        Log.error(` ${red('✘')} The --takeover and --target flags cannot be provided simultaneously`);
        return;
    }
    // Make sure the local repository is clean.
    if (git.hasUncommittedChanges()) {
        Log.error(` ${red('✘')} Local working repository not clean. Please make sure there are no uncommitted changes`);
        return;
    }
    const localCheckoutResult = await checkOutPullRequestLocally(pr, {
        allowIfMaintainerCannotModify: true,
    });
    if (takeover) {
        return await checkoutAsPrTakeover(pr, localCheckoutResult);
    }
    if (target) {
        return await checkoutToTargetBranch(pr, target, localCheckoutResult);
    }
    /**
     * Whether the pull request is configured to allow for the maintainers to modify the pull request.
     */
    const maintainerCanModify = localCheckoutResult.pullRequest.maintainerCanModify;
    if (!maintainerCanModify) {
        Log.info('The author of this pull request does not allow maintainers to modify the pull');
        Log.info('request. Since you will not be able to push changes to the original pull request');
        Log.info('you will instead need to perform a "takeover." In a takeover, the original pull');
        Log.info('request will be checked out, the commits are modified to close the original on');
        Log.info('merge of the newly created branch.');
        if (await Prompt.confirm({
            message: `Would you like to create a takeover pull request?`,
            default: true,
        })) {
            return await checkoutAsPrTakeover(pr, localCheckoutResult);
        }
    }
    Log.info(` ${green('✔')} Checked out the remote branch for pull request #${pr}`);
    if (maintainerCanModify) {
        Log.info('To push the checked out branch back to its PR, run the following command:');
        Log.info(`  $ ${localCheckoutResult.pushToUpstreamCommand}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tvdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY2hlY2tvdXQvY2hlY2tvdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDcEUsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUNuRCxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFRbkQsTUFBTSxDQUFDLEtBQUssVUFBVSxtQkFBbUIsQ0FBQyxNQUFpQztJQUN6RSxNQUFNLEVBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUMsR0FBRyxNQUFNLENBQUM7SUFDdEMsbUNBQW1DO0lBQ25DLE1BQU0sR0FBRyxHQUFHLE1BQU0sc0JBQXNCLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFL0MsSUFBSSxRQUFRLElBQUksTUFBTSxFQUFFLENBQUM7UUFDdkIsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsc0VBQXNFLENBQUMsQ0FBQztRQUM5RixPQUFPO0lBQ1QsQ0FBQztJQUVELDJDQUEyQztJQUMzQyxJQUFJLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUM7UUFDaEMsR0FBRyxDQUFDLEtBQUssQ0FDUCxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsd0ZBQXdGLENBQ3JHLENBQUM7UUFDRixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sbUJBQW1CLEdBQUcsTUFBTSwwQkFBMEIsQ0FBQyxFQUFFLEVBQUU7UUFDL0QsNkJBQTZCLEVBQUUsSUFBSTtLQUNwQyxDQUFDLENBQUM7SUFFSCxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ2IsT0FBTyxNQUFNLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRCxJQUFJLE1BQU0sRUFBRSxDQUFDO1FBQ1gsT0FBTyxNQUFNLHNCQUFzQixDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLG1CQUFtQixHQUFHLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQztJQUVoRixJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUN6QixHQUFHLENBQUMsSUFBSSxDQUFDLCtFQUErRSxDQUFDLENBQUM7UUFDMUYsR0FBRyxDQUFDLElBQUksQ0FBQyxrRkFBa0YsQ0FBQyxDQUFDO1FBQzdGLEdBQUcsQ0FBQyxJQUFJLENBQUMsaUZBQWlGLENBQUMsQ0FBQztRQUM1RixHQUFHLENBQUMsSUFBSSxDQUFDLGdGQUFnRixDQUFDLENBQUM7UUFDM0YsR0FBRyxDQUFDLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO1FBRS9DLElBQ0UsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQ25CLE9BQU8sRUFBRSxtREFBbUQ7WUFDNUQsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLEVBQ0YsQ0FBQztZQUNELE9BQU8sTUFBTSxvQkFBb0IsQ0FBQyxFQUFFLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUM3RCxDQUFDO0lBQ0gsQ0FBQztJQUVELEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLG9EQUFvRCxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2pGLElBQUksbUJBQW1CLEVBQUUsQ0FBQztRQUN4QixHQUFHLENBQUMsSUFBSSxDQUFDLDJFQUEyRSxDQUFDLENBQUM7UUFDdEYsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLG1CQUFtQixDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQztJQUMvRCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtncmVlbiwgTG9nLCByZWR9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtjaGVja091dFB1bGxSZXF1ZXN0TG9jYWxseX0gZnJvbSAnLi4vY29tbW9uL2NoZWNrb3V0LXByLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtjaGVja291dFRvVGFyZ2V0QnJhbmNofSBmcm9tICcuL3RhcmdldC5qcyc7XG5pbXBvcnQge2NoZWNrb3V0QXNQclRha2VvdmVyfSBmcm9tICcuL3Rha2VvdmVyLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBDaGVja291dFB1bGxSZXF1ZXN0UGFyYW1zIHtcbiAgcHI6IG51bWJlcjtcbiAgdGFrZW92ZXI/OiBib29sZWFuO1xuICB0YXJnZXQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja291dFB1bGxSZXF1ZXN0KHBhcmFtczogQ2hlY2tvdXRQdWxsUmVxdWVzdFBhcmFtcyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCB7cHIsIHRha2VvdmVyLCB0YXJnZXR9ID0gcGFyYW1zO1xuICAvKiogQW4gYXV0aGVudGljYXRlZCBnaXQgY2xpZW50LiAqL1xuICBjb25zdCBnaXQgPSBhd2FpdCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LmdldCgpO1xuXG4gIGlmICh0YWtlb3ZlciAmJiB0YXJnZXQpIHtcbiAgICBMb2cuZXJyb3IoYCAke3JlZCgn4pyYJyl9IFRoZSAtLXRha2VvdmVyIGFuZCAtLXRhcmdldCBmbGFncyBjYW5ub3QgYmUgcHJvdmlkZWQgc2ltdWx0YW5lb3VzbHlgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBNYWtlIHN1cmUgdGhlIGxvY2FsIHJlcG9zaXRvcnkgaXMgY2xlYW4uXG4gIGlmIChnaXQuaGFzVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHtcbiAgICBMb2cuZXJyb3IoXG4gICAgICBgICR7cmVkKCfinJgnKX0gTG9jYWwgd29ya2luZyByZXBvc2l0b3J5IG5vdCBjbGVhbi4gUGxlYXNlIG1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gdW5jb21taXR0ZWQgY2hhbmdlc2AsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBsb2NhbENoZWNrb3V0UmVzdWx0ID0gYXdhaXQgY2hlY2tPdXRQdWxsUmVxdWVzdExvY2FsbHkocHIsIHtcbiAgICBhbGxvd0lmTWFpbnRhaW5lckNhbm5vdE1vZGlmeTogdHJ1ZSxcbiAgfSk7XG5cbiAgaWYgKHRha2VvdmVyKSB7XG4gICAgcmV0dXJuIGF3YWl0IGNoZWNrb3V0QXNQclRha2VvdmVyKHByLCBsb2NhbENoZWNrb3V0UmVzdWx0KTtcbiAgfVxuXG4gIGlmICh0YXJnZXQpIHtcbiAgICByZXR1cm4gYXdhaXQgY2hlY2tvdXRUb1RhcmdldEJyYW5jaChwciwgdGFyZ2V0LCBsb2NhbENoZWNrb3V0UmVzdWx0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBwdWxsIHJlcXVlc3QgaXMgY29uZmlndXJlZCB0byBhbGxvdyBmb3IgdGhlIG1haW50YWluZXJzIHRvIG1vZGlmeSB0aGUgcHVsbCByZXF1ZXN0LlxuICAgKi9cbiAgY29uc3QgbWFpbnRhaW5lckNhbk1vZGlmeSA9IGxvY2FsQ2hlY2tvdXRSZXN1bHQucHVsbFJlcXVlc3QubWFpbnRhaW5lckNhbk1vZGlmeTtcblxuICBpZiAoIW1haW50YWluZXJDYW5Nb2RpZnkpIHtcbiAgICBMb2cuaW5mbygnVGhlIGF1dGhvciBvZiB0aGlzIHB1bGwgcmVxdWVzdCBkb2VzIG5vdCBhbGxvdyBtYWludGFpbmVycyB0byBtb2RpZnkgdGhlIHB1bGwnKTtcbiAgICBMb2cuaW5mbygncmVxdWVzdC4gU2luY2UgeW91IHdpbGwgbm90IGJlIGFibGUgdG8gcHVzaCBjaGFuZ2VzIHRvIHRoZSBvcmlnaW5hbCBwdWxsIHJlcXVlc3QnKTtcbiAgICBMb2cuaW5mbygneW91IHdpbGwgaW5zdGVhZCBuZWVkIHRvIHBlcmZvcm0gYSBcInRha2VvdmVyLlwiIEluIGEgdGFrZW92ZXIsIHRoZSBvcmlnaW5hbCBwdWxsJyk7XG4gICAgTG9nLmluZm8oJ3JlcXVlc3Qgd2lsbCBiZSBjaGVja2VkIG91dCwgdGhlIGNvbW1pdHMgYXJlIG1vZGlmaWVkIHRvIGNsb3NlIHRoZSBvcmlnaW5hbCBvbicpO1xuICAgIExvZy5pbmZvKCdtZXJnZSBvZiB0aGUgbmV3bHkgY3JlYXRlZCBicmFuY2guJyk7XG5cbiAgICBpZiAoXG4gICAgICBhd2FpdCBQcm9tcHQuY29uZmlybSh7XG4gICAgICAgIG1lc3NhZ2U6IGBXb3VsZCB5b3UgbGlrZSB0byBjcmVhdGUgYSB0YWtlb3ZlciBwdWxsIHJlcXVlc3Q/YCxcbiAgICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgIH0pXG4gICAgKSB7XG4gICAgICByZXR1cm4gYXdhaXQgY2hlY2tvdXRBc1ByVGFrZW92ZXIocHIsIGxvY2FsQ2hlY2tvdXRSZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIExvZy5pbmZvKGAgJHtncmVlbign4pyUJyl9IENoZWNrZWQgb3V0IHRoZSByZW1vdGUgYnJhbmNoIGZvciBwdWxsIHJlcXVlc3QgIyR7cHJ9YCk7XG4gIGlmIChtYWludGFpbmVyQ2FuTW9kaWZ5KSB7XG4gICAgTG9nLmluZm8oJ1RvIHB1c2ggdGhlIGNoZWNrZWQgb3V0IGJyYW5jaCBiYWNrIHRvIGl0cyBQUiwgcnVuIHRoZSBmb2xsb3dpbmcgY29tbWFuZDonKTtcbiAgICBMb2cuaW5mbyhgICAkICR7bG9jYWxDaGVja291dFJlc3VsdC5wdXNoVG9VcHN0cmVhbUNvbW1hbmR9YCk7XG4gIH1cbn1cbiJdfQ==