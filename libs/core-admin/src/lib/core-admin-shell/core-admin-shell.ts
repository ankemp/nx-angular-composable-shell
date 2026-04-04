import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Route,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';

interface AdminTabData {
  title: string;
  icon: string;
}

function hasTabData(route: Route): route is Route & { data: AdminTabData } {
  return !!route.data?.['title'] && !!route.data?.['icon'];
}

@Component({
  selector: 'lib-core-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell">
      <div class="admin-header">
        <h1 class="admin-title">Administration</h1>
        <p class="admin-subtitle">
          Manage users, groups, and roles for your organization
        </p>
      </div>

      <nav class="tab-nav" role="tablist">
        @for (tab of tabs(); track tab.path) {
          <a
            class="tab-link"
            [routerLink]="tab.path"
            routerLinkActive="active"
            role="tab"
          >
            <span class="tab-icon">{{ tab.icon }}</span> {{ tab.title }}
          </a>
        }
      </nav>

      <div class="tab-content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    .admin-shell {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f5f6fa;
    }

    .admin-header {
      padding: 28px 32px 0;
    }

    .admin-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1a1d2e;
      margin: 0 0 4px;
    }

    .admin-subtitle {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0 0 24px;
    }

    .tab-nav {
      display: flex;
      gap: 0;
      padding: 0 32px;
      border-bottom: 2px solid #e5e7eb;
      background: #f5f6fa;
    }

    .tab-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      text-decoration: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition:
        color 0.15s,
        border-color 0.15s;
      white-space: nowrap;
    }

    .tab-link:hover {
      color: #1a1d2e;
    }

    .tab-link.active {
      color: #4f46e5;
      border-bottom-color: #4f46e5;
    }

    .tab-icon {
      font-size: 1rem;
    }

    .tab-content {
      flex: 1;
      overflow: auto;
      padding: 24px 32px;
    }
  `,
})
export class CoreAdminShell {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  tabs = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() =>
        (this.route.routeConfig?.children ?? [])
          .filter(hasTabData)
          .map((r) => ({
            path: r.path!,
            title: r.data.title,
            icon: r.data.icon,
          })),
      ),
    ),
    { initialValue: [] },
  );
}
