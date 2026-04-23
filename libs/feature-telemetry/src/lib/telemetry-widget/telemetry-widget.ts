import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TelemetryService } from '../telemetry.service';

@Component({
  selector: 'lib-telemetry-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card">
      <div class="widget-header">📡 Platform Telemetry</div>
      <div class="metric-row">
        <div class="metric">
          <span class="metric-value">{{ svc.requestsPerSecond() }}</span>
          <span class="metric-label">req/s</span>
        </div>
        <div class="metric">
          <span class="metric-value">{{ svc.errorRate() }}%</span>
          <span class="metric-label">Error rate</span>
        </div>
        <div class="metric">
          <span class="metric-value">{{ svc.latencyP99() }}ms</span>
          <span class="metric-label">P99 latency</span>
        </div>
      </div>
      <p class="widget-status buffer-info">
        {{ svc.bufferSize() }} events buffered
      </p>
    </div>
  `,
  styles: `
    .widget-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .widget-header {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
    }
    .metric-row {
      display: flex;
      gap: 24px;
    }
    .metric {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .metric-value {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1a1d2e;
    }
    .metric-label {
      font-size: 0.75rem;
      color: #888;
    }
    .widget-status {
      font-size: 0.78rem;
      color: #aaa;
      margin: 0;
    }
  `,
})
export class TelemetryWidget {
  protected readonly svc = inject(TelemetryService);
}
