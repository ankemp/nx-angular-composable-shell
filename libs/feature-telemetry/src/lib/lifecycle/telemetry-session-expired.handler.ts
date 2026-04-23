export async function telemetrySessionExpiredHandler(): Promise<void> {
  console.log('[Telemetry] Session expired — flushing emergency buffer...');
  sessionStorage.removeItem('telemetry-buffer');
  sessionStorage.removeItem('telemetry-session-id');
  console.log('[Telemetry] Session expiry cleanup complete.');
}
