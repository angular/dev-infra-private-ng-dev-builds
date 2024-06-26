import { ReleaseNpmDistTagDeleteCommand } from './delete/cli.js';
import { ReleaseNpmDistTagSetCommand } from './set/cli.js';
function subCommandsBuilder(argv) {
    return argv
        .help()
        .strict()
        .demandCommand()
        .command(ReleaseNpmDistTagDeleteCommand)
        .command(ReleaseNpmDistTagSetCommand);
}
export const ReleaseNpmDistTagCommand = {
    describe: 'Update the NPM dist tags for release packages.',
    command: 'npm-dist-tag',
    builder: subCommandsBuilder,
    handler: () => { },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2UvbnBtLWRpc3QtdGFnL2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFTQSxPQUFPLEVBQUMsOEJBQThCLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUMvRCxPQUFPLEVBQUMsMkJBQTJCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFekQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFVO0lBQ3BDLE9BQU8sSUFBSTtTQUNSLElBQUksRUFBRTtTQUNOLE1BQU0sRUFBRTtTQUNSLGFBQWEsRUFBRTtTQUNmLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQztTQUN2QyxPQUFPLENBQUMsMkJBQTJCLENBQUMsQ0FBQztBQUMxQyxDQUFDO0FBRUQsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQTBCO0lBQzdELFFBQVEsRUFBRSxnREFBZ0Q7SUFDMUQsT0FBTyxFQUFFLGNBQWM7SUFDdkIsT0FBTyxFQUFFLGtCQUFrQjtJQUMzQixPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUUsQ0FBQztDQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0FyZ3YsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcblxuaW1wb3J0IHtSZWxlYXNlTnBtRGlzdFRhZ0RlbGV0ZUNvbW1hbmR9IGZyb20gJy4vZGVsZXRlL2NsaS5qcyc7XG5pbXBvcnQge1JlbGVhc2VOcG1EaXN0VGFnU2V0Q29tbWFuZH0gZnJvbSAnLi9zZXQvY2xpLmpzJztcblxuZnVuY3Rpb24gc3ViQ29tbWFuZHNCdWlsZGVyKGFyZ3Y6IEFyZ3YpIHtcbiAgcmV0dXJuIGFyZ3ZcbiAgICAuaGVscCgpXG4gICAgLnN0cmljdCgpXG4gICAgLmRlbWFuZENvbW1hbmQoKVxuICAgIC5jb21tYW5kKFJlbGVhc2VOcG1EaXN0VGFnRGVsZXRlQ29tbWFuZClcbiAgICAuY29tbWFuZChSZWxlYXNlTnBtRGlzdFRhZ1NldENvbW1hbmQpO1xufVxuXG5leHBvcnQgY29uc3QgUmVsZWFzZU5wbURpc3RUYWdDb21tYW5kOiBDb21tYW5kTW9kdWxlPHt9LCB7fT4gPSB7XG4gIGRlc2NyaWJlOiAnVXBkYXRlIHRoZSBOUE0gZGlzdCB0YWdzIGZvciByZWxlYXNlIHBhY2thZ2VzLicsXG4gIGNvbW1hbmQ6ICducG0tZGlzdC10YWcnLFxuICBidWlsZGVyOiBzdWJDb21tYW5kc0J1aWxkZXIsXG4gIGhhbmRsZXI6ICgpID0+IHt9LFxufTtcbiJdfQ==