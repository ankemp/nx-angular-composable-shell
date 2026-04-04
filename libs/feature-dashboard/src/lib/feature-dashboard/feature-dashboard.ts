import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { DASHBOARD_WIDGETS } from './dashboard-widgets.token';

@Component({
  selector: 'lib-feature-dashboard',
  imports: [NgComponentOutlet],
  templateUrl: './feature-dashboard.html',
  styleUrl: './feature-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureDashboard {
  readonly resolvedWidgets = signal<Type<unknown>[]>([]);

  constructor() {
    const lazyWidgets = inject(DASHBOARD_WIDGETS);
    Promise.all(lazyWidgets.map((w) => w.loadComponent())).then((types) => {
      this.resolvedWidgets.set(types);
    });
  }
  readonly activityItems = [
    { user: 'Alice', action: 'created project Alpha', time: '2m ago' },
    { user: 'Bob', action: 'updated billing plan', time: '15m ago' },
    { user: 'Carol', action: 'invited 3 members', time: '1h ago' },
    { user: 'Dave', action: 'exported analytics report', time: '3h ago' },
    { user: 'Eve', action: 'closed 5 support tickets', time: '5h ago' },
  ];

  readonly quickActions = [
    { icon: '➕', label: 'New Project' },
    { icon: '👤', label: 'Invite User' },
    { icon: '📤', label: 'Export Data' },
    { icon: '🔗', label: 'API Keys' },
  ];

  readonly statusItems = [
    { name: 'API Gateway', ok: true },
    { name: 'Database', ok: true },
    { name: 'CDN', ok: true },
    { name: 'Email Service', ok: false },
  ];
}
