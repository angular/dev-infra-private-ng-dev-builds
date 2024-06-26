import { Log } from '../../utils/logging.js';
/** Builds the command. */
async function builder(yargs) {
    return yargs;
}
/** Handles the command. */
async function handler() {
    Log.warn('ng-dev auth logout has been deprecated. Authentication will be done');
    Log.warn('using local environment.');
}
/** yargs command module for logging out of the ng-dev service. */
export const LogoutModule = {
    handler,
    builder,
    command: 'logout',
    describe: 'Log out of the ng-dev service',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2F1dGgvbG9nb3V0L2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFJM0MsMEJBQTBCO0FBQzFCLEtBQUssVUFBVSxPQUFPLENBQUMsS0FBVztJQUNoQyxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCwyQkFBMkI7QUFDM0IsS0FBSyxVQUFVLE9BQU87SUFDcEIsR0FBRyxDQUFDLElBQUksQ0FBQyxxRUFBcUUsQ0FBQyxDQUFDO0lBQ2hGLEdBQUcsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQsa0VBQWtFO0FBQ2xFLE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBK0I7SUFDdEQsT0FBTztJQUNQLE9BQU87SUFDUCxPQUFPLEVBQUUsUUFBUTtJQUNqQixRQUFRLEVBQUUsK0JBQStCO0NBQzFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0FyZ3YsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBPcHRpb25zIHt9XG5cbi8qKiBCdWlsZHMgdGhlIGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBidWlsZGVyKHlhcmdzOiBBcmd2KSB7XG4gIHJldHVybiB5YXJncztcbn1cblxuLyoqIEhhbmRsZXMgdGhlIGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKCkge1xuICBMb2cud2FybignbmctZGV2IGF1dGggbG9nb3V0IGhhcyBiZWVuIGRlcHJlY2F0ZWQuIEF1dGhlbnRpY2F0aW9uIHdpbGwgYmUgZG9uZScpO1xuICBMb2cud2FybigndXNpbmcgbG9jYWwgZW52aXJvbm1lbnQuJyk7XG59XG5cbi8qKiB5YXJncyBjb21tYW5kIG1vZHVsZSBmb3IgbG9nZ2luZyBvdXQgb2YgdGhlIG5nLWRldiBzZXJ2aWNlLiAqL1xuZXhwb3J0IGNvbnN0IExvZ291dE1vZHVsZTogQ29tbWFuZE1vZHVsZTx7fSwgT3B0aW9ucz4gPSB7XG4gIGhhbmRsZXIsXG4gIGJ1aWxkZXIsXG4gIGNvbW1hbmQ6ICdsb2dvdXQnLFxuICBkZXNjcmliZTogJ0xvZyBvdXQgb2YgdGhlIG5nLWRldiBzZXJ2aWNlJyxcbn07XG4iXX0=