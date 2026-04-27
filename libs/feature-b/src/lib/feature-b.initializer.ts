/**
 * Feature B initializer — runs before the Angular app renders.
 *
 * Registered via provideAppInitializer(), so this function runs in an injection
 * context: use inject() here for any Angular services needed at startup.
 *
 * Simulates pre-loading Feature B configuration (e.g. user preferences,
 * message thread metadata) so the first render is data-ready. In a real
 * implementation this would call an HTTP endpoint via inject(HttpClient);
 * here it resolves immediately to keep the POC dependency-free.
 */
export function featureBInitializer(): Promise<void> {
  console.log('[feature-b] Initializer: pre-loading Feature B config...');
  // Example with injection context:
  //   const http = inject(HttpClient);
  //   return firstValueFrom(http.get('/api/feature-b/config'));
  return Promise.resolve();
}
