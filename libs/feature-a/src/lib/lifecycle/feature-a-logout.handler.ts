export async function featureALogoutHandler(): Promise<void> {
  sessionStorage.removeItem('feature-a-cache');
  console.log('[Feature A] Logout cleanup complete.');
}
