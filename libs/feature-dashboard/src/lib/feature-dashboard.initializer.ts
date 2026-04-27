/**
 * Feature Dashboard initializer — runs before the Angular app renders.
 *
 * Registered via provideAppInitializer(), so this function runs in an injection
 * context: use inject() here for any Angular services needed at startup.
 *
 * Simulates pre-loading the dashboard layout configuration (e.g. which widgets
 * are pinned, column ordering) so the first render is data-ready. In a real
 * implementation this would call an HTTP endpoint via inject(HttpClient);
 * here it resolves immediately to keep the POC dependency-free.
 */
export function featureDashboardInitializer(): Promise<void> {
  console.log(
    '[feature-dashboard] Initializer: pre-loading dashboard config...',
  );
  // Example with injection context:
  //   const http = inject(HttpClient);
  //   return firstValueFrom(http.get('/api/dashboard/config'));
  return Promise.resolve();
}
