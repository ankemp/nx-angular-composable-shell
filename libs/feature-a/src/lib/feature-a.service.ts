import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FeatureAService {
  private readonly _recordsProcessed = signal(1284);
  private readonly _successCount = signal(1207);
  private readonly _pendingCount = signal(0);

  readonly recordsProcessed = this._recordsProcessed.asReadonly();
  readonly successRate = computed(() =>
    this._recordsProcessed() === 0
      ? 0
      : Math.round((this._successCount() / this._recordsProcessed()) * 100),
  );
  readonly lastSyncedAt = signal<Date>(new Date(Date.now() - 5 * 60 * 1000));

  /** Count of records queued since last processed — drives the sidebar nav badge. */
  readonly pendingCount = this._pendingCount.asReadonly();

  constructor() {
    setTimeout(() => {
      this.simulate();
    }, 1000);
  }

  simulate(): void {
    const batch = Math.floor(Math.random() * 50) + 10;
    const successes = Math.floor(batch * (0.88 + Math.random() * 0.12));
    this._recordsProcessed.update((n) => n + batch);
    this._successCount.update((n) => n + successes);
    this._pendingCount.update((n) => n + batch);
    this.lastSyncedAt.set(new Date());
  }
}
