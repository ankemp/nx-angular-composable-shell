import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureAService } from '../feature-a.service';

@Component({
  selector: 'lib-feature-a-nav-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (count() > 0) {
      <span class="badge">{{ count() }}</span>
    }
  `,
  styles: `
    .badge {
      margin-left: auto;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 10px;
      background: #5b7cf7;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex-shrink: 0;
    }
  `,
})
export class FeatureANavBadge {
  private readonly svc = inject(FeatureAService);

  protected readonly count = this.svc.pendingCount;
}
