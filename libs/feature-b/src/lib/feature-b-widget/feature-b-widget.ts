import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lib-feature-b-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card">
      <div class="widget-header">💬 Feature B Summary</div>
      <div class="metric-row">
        <div class="metric">
          <span class="metric-value">42</span>
          <span class="metric-label">Open threads</span>
        </div>
        <div class="metric">
          <span class="metric-value">7</span>
          <span class="metric-label">Unread mentions</span>
        </div>
      </div>
      <p class="widget-status">3 messages in the last hour</p>
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
export class FeatureBWidget {}
