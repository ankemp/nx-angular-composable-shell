import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly _requestCount = signal(0);
  private readonly _errorCount = signal(0);
  private readonly _latencyP99Ms = signal(0);
  private readonly _bufferSize = signal(0);

  readonly requestsPerSecond = signal(142);
  readonly errorRate = computed(() =>
    this._requestCount() === 0
      ? 0
      : Math.round((this._errorCount() / this._requestCount()) * 100 * 10) / 10,
  );
  readonly latencyP99 = this._latencyP99Ms.asReadonly();
  readonly bufferSize = this._bufferSize.asReadonly();

  constructor() {
    this.simulate();
    setInterval(() => this.simulate(), 1000);
  }

  simulate(): void {
    this._requestCount.update((n) => n + Math.floor(Math.random() * 200) + 100);
    this._errorCount.update((n) => n + Math.floor(Math.random() * 5));
    this._latencyP99Ms.set(Math.floor(Math.random() * 80) + 20);
    this._bufferSize.update((n) => n + Math.floor(Math.random() * 30) + 5);
    this.requestsPerSecond.set(Math.floor(Math.random() * 100) + 100);
  }

  /** Flush the pending telemetry buffer. Called on logout/session expiry. */
  flush(): void {
    const pending = this._bufferSize();
    console.log(`[Telemetry] Flushing ${pending} buffered events.`);
    this._bufferSize.set(0);
  }
}
