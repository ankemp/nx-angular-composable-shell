import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureAService } from '../feature-a.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'lib-feature-a',
  imports: [DatePipe],
  templateUrl: './feature-a.html',
  styleUrl: './feature-a.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureA {
  protected readonly svc = inject(FeatureAService);
}
