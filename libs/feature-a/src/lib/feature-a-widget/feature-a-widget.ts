import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureAService } from '../feature-a.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'lib-feature-a-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">📊 Feature A Summary</div>
      <div class="metric-row">
        <div class="metric">
          <span class="metric-value">{{ svc.recordsProcessed() }}</span>
          <span class="metric-label">Records processed</span>
        </div>
        <div class="metric">
          <span class="metric-value">{{ svc.successRate() }}%</span>
          <span class="metric-label">Success rate</span>
        </div>
      </div>
      <p class="widget-status">
        Last sync: {{ svc.lastSyncedAt() | date: 'short' }}
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
export class FeatureAWidget {
  protected readonly svc = inject(FeatureAService);
}
