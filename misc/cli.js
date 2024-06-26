import { BuildAndLinkCommandModule } from './build-and-link/cli.js';
import { UpdateYarnCommandModule } from './update-yarn/cli.js';
import { ValidateLicensesModule } from './validate-licenses/cli.js';
/** Build the parser for the misc commands. */
export function buildMiscParser(localYargs) {
    return localYargs
        .help()
        .strict()
        .command(BuildAndLinkCommandModule)
        .command(UpdateYarnCommandModule)
        .command(ValidateLicensesModule);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L21pc2MvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVNBLE9BQU8sRUFBQyx5QkFBeUIsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ2xFLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzdELE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBRWxFLDhDQUE4QztBQUM5QyxNQUFNLFVBQVUsZUFBZSxDQUFDLFVBQWdCO0lBQzlDLE9BQU8sVUFBVTtTQUNkLElBQUksRUFBRTtTQUNOLE1BQU0sRUFBRTtTQUNSLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQztTQUNsQyxPQUFPLENBQUMsdUJBQXVCLENBQUM7U0FDaEMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFDckMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtBcmd2fSBmcm9tICd5YXJncyc7XG5cbmltcG9ydCB7QnVpbGRBbmRMaW5rQ29tbWFuZE1vZHVsZX0gZnJvbSAnLi9idWlsZC1hbmQtbGluay9jbGkuanMnO1xuaW1wb3J0IHtVcGRhdGVZYXJuQ29tbWFuZE1vZHVsZX0gZnJvbSAnLi91cGRhdGUteWFybi9jbGkuanMnO1xuaW1wb3J0IHtWYWxpZGF0ZUxpY2Vuc2VzTW9kdWxlfSBmcm9tICcuL3ZhbGlkYXRlLWxpY2Vuc2VzL2NsaS5qcyc7XG5cbi8qKiBCdWlsZCB0aGUgcGFyc2VyIGZvciB0aGUgbWlzYyBjb21tYW5kcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZE1pc2NQYXJzZXIobG9jYWxZYXJnczogQXJndikge1xuICByZXR1cm4gbG9jYWxZYXJnc1xuICAgIC5oZWxwKClcbiAgICAuc3RyaWN0KClcbiAgICAuY29tbWFuZChCdWlsZEFuZExpbmtDb21tYW5kTW9kdWxlKVxuICAgIC5jb21tYW5kKFVwZGF0ZVlhcm5Db21tYW5kTW9kdWxlKVxuICAgIC5jb21tYW5kKFZhbGlkYXRlTGljZW5zZXNNb2R1bGUpO1xufVxuIl19