import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterModule, NavigationEnd, Route } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { LifecycleDispatcher } from '@nacs/shell-lifecycle';
import { NAV_BADGES } from '../nav-badges.token';

interface MenuRouteData {
  title: string;
  icon: string;
  excludeFromMenu?: boolean;
}

function hasMenuData(route: Route): route is Route & { data: MenuRouteData } {
  return !route.data?.['excludeFromMenu'] && !!route.data?.['title'];
}

@Component({
  selector: 'lib-sidebar',
  imports: [RouterModule, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sidebar',
    '[class.collapsed]': '!expanded()',
  },
  styles: `
    :host {
      width: 240px;
      background: #1a1d2e;
      color: #c8ccd8;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width 0.25s ease;
      overflow: hidden;
      position: relative;
      z-index: 10;
    }

    :host.collapsed {
      width: 60px;
    }

    :host.collapsed:hover {
      width: 240px;
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.25);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
      border-bottom: 1px solid #2d3147;
      white-space: nowrap;
      overflow: hidden;
    }

    .logo-icon {
      font-size: 1.4rem;
      flex-shrink: 0;
    }

    .logo-text {
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff;
      opacity: 1;
      transition: opacity 0.15s ease;
    }

    :host.collapsed .logo-text {
      opacity: 0;
    }
    :host.collapsed:hover .logo-text {
      opacity: 1;
    }

    .nav {
      flex: 1;
      padding: 12px 0;
      overflow: hidden;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 16px;
      color: #9a9fb8;
      text-decoration: none;
      white-space: nowrap;
      border-left: 3px solid transparent;
      transition:
        background 0.15s,
        color 0.15s,
        border-color 0.15s;
      overflow: hidden;
    }

    .nav-item:hover {
      background: #252840;
      color: #ffffff;
      border-left-color: #5b7cf7;
    }

    .nav-item.active {
      background: #252840;
      color: #ffffff;
      border-left-color: #5b7cf7;
    }

    .nav-icon {
      font-size: 1.1rem;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
    }

    .nav-label {
      flex: 1;
      opacity: 1;
      transition: opacity 0.15s ease;
      font-size: 0.9rem;
    }

    :host.collapsed .nav-label {
      opacity: 0;
    }
    :host.collapsed:hover .nav-label {
      opacity: 1;
    }

    .sidebar-footer {
      border-top: 1px solid #2d3147;
      padding: 8px 0;
    }

    .user-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 16px;
      color: #9a9fb8;
      white-space: nowrap;
      overflow: hidden;
    }

    .logout-btn {
      background: none;
      border: none;
      color: #9a9fb8;
      cursor: pointer;
      font-size: 1rem;
      margin-left: auto;
      padding: 4px;
      flex-shrink: 0;
    }

    :host.collapsed .logout-btn {
      opacity: 0;
    }
    :host.collapsed:hover .logout-btn {
      opacity: 1;
    }
  `,
  template: `
    <div class="sidebar-header">
      <span class="logo-icon">🚀</span>
      <span class="logo-text">AcmeSaaS</span>
    </div>

    <nav class="nav">
      @for (item of menuItems(); track item.path) {
        <a
          [routerLink]="['/', item.path]"
          routerLinkActive="active"
          class="nav-item"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.title }}</span>
          @if (item.badge; as badge) {
            <ng-container [ngComponentOutlet]="badge" />
          }
        </a>
      }
    </nav>

    <div class="sidebar-footer">
      <a [routerLink]="['/admin']" routerLinkActive="active" class="nav-item">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">Admin</span>
      </a>
      <div class="user-row">
        <span class="nav-icon">👤</span>
        <span class="nav-label">John Doe</span>
        <button class="logout-btn" title="Logout" (click)="logout()">🚪</button>
      </div>
    </div>
  `,
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly lifecycle = inject(LifecycleDispatcher);
  private readonly resolvedBadges = signal(new Map<string, Type<unknown>>());

  expanded = input(true);

  private readonly routeItems = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() =>
        this.router.config.filter(hasMenuData).map((route) => ({
          path: route.path as string,
          title: route.data.title,
          icon: route.data.icon,
        })),
      ),
    ),
    { initialValue: [] },
  );

  menuItems = computed(() =>
    this.routeItems().map((item) => ({
      ...item,
      badge: this.resolvedBadges().get(item.path),
    })),
  );

  constructor() {
    const navBadges = inject(NAV_BADGES);
    Promise.all(
      navBadges.map((b) =>
        b.loadComponent().then((t) => [b.routePath, t] as const),
      ),
    ).then((entries) => this.resolvedBadges.set(new Map(entries)));
  }

  async logout(): Promise<void> {
    await this.lifecycle.dispatch('user.logout');
    // After all feature handlers have run, navigate to a post-logout destination.
    // In a real app this would redirect to a login page or SSO endpoint.
    console.log('[Shell] All logout handlers complete.');
    alert('Logged out! (This is a placeholder action.)');
  }
}
