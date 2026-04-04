import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lib-feature-b-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="feature-b-admin">
      <h2>Feature B Settings</h2>
      <p>Configure Feature B specific permissions and settings for your organization.</p>
    </div>
  `,
  styles: `
    .feature-b-admin {
      padding: 16px 0;
    }
    h2 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #1a1d2e;
      margin: 0 0 8px;
    }
    p {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
    }
  `,
})
export class FeatureBAdmin {}
