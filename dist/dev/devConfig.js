/**
 * DEV CONTROL CONFIG  (global)
 * ------------------------------------------------------------------
 * Edit this file to simulate slow/failing responses across the WHOLE
 * project while developing. Nothing here runs in production.
 *
 *   ENABLED   : master on/off for all dev delays & errors
 *   DELAY     : `delayMs` (ms) applies to EVERY request in the app.
 *               e.g. 3000 = every API call takes 3 seconds.
 *   RANDOM    : set `randomDelay: true` to use delayMinMs..delayMaxMs
 *               instead of the fixed `delayMs`.
 *   ROUTES    : optional per-endpoint overrides (rarely needed when
 *               global delay is on).
 *
 * The middleware reads this file live, so editing here while the server
 * runs under `npm run dev` (nodemon) reloads automatically.
 */
export const devControl = {
    enabled: true,
    // ⬇ GLOBAL delay (milliseconds) applied to EVERY request in the app.
    //    5000 = everyone waits 5 seconds; 0 or null = no delay.
    delayMs: 5000,
    randomDelay: false,
    delayMinMs: 1000,
    delayMaxMs: 5000,
    // Optional per-route overrides. Empty = no overrides.
    // A `delayMs` here replaces the global delay for that route.
    // `forceError: true` makes that route return the error below (e.g. to
    // test your error/retry UI).
    routes: [
    // {
    //   path: "/api/v1/bookings",
    //   method: "GET",
    //   delayMs: 3000,            // slower than global for this route
    // },
    // {
    //   path: "/api/v1/auth",
    //   method: "POST",
    //   forceError: true,        // simulate server error to test error UI
    //   errorStatus: 500,
    //   errorMessage: "Simulated dev error",
    // },
    ],
};
//# sourceMappingURL=devConfig.js.map