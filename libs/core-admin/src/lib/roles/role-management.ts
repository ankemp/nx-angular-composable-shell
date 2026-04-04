import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Role {
  id: number;
  name: string;
  description: string;
  userCount: number;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

const MOCK_ROLES: Role[] = [
  {
    id: 1,
    name: 'Admin',
    description: 'Full system access with all permissions',
    userCount: 3,
    isSystem: true,
    createdAt: 'Jan 12, 2024',
    permissions: [
      'users:read',
      'users:write',
      'groups:manage',
      'roles:manage',
      'billing:manage',
    ],
  },
  {
    id: 2,
    name: 'Editor',
    description: 'Can create and edit content, manage own profile',
    userCount: 12,
    isSystem: true,
    createdAt: 'Jan 12, 2024',
    permissions: ['users:read', 'content:write', 'reports:read'],
  },
  {
    id: 3,
    name: 'Viewer',
    description: 'Read-only access to permitted resources',
    userCount: 21,
    isSystem: true,
    createdAt: 'Jan 12, 2024',
    permissions: ['users:read', 'content:read', 'reports:read'],
  },
  {
    id: 4,
    name: 'Billing Manager',
    description: 'Access to billing, invoices, and subscriptions',
    userCount: 2,
    isSystem: false,
    createdAt: 'Mar 8, 2024',
    permissions: ['billing:manage', 'reports:read', 'users:read'],
  },
  {
    id: 5,
    name: 'HR Manager',
    description: 'Manage user accounts and organizational structure',
    userCount: 4,
    isSystem: false,
    createdAt: 'Apr 15, 2024',
    permissions: ['users:read', 'users:write', 'groups:manage'],
  },
  {
    id: 6,
    name: 'Auditor',
    description: 'Read-only access to audit logs and reports',
    userCount: 1,
    isSystem: false,
    createdAt: 'Jun 1, 2024',
    permissions: ['audit:read', 'reports:read', 'users:read'],
  },
];

const PERMISSION_COLORS: Record<string, { bg: string; color: string }> = {
  'users:read': { bg: '#dbeafe', color: '#1d4ed8' },
  'users:write': { bg: '#ede9fe', color: '#6d28d9' },
  'groups:manage': { bg: '#d1fae5', color: '#065f46' },
  'roles:manage': { bg: '#fef3c7', color: '#92400e' },
  'billing:manage': { bg: '#fce7f3', color: '#9d174d' },
  'content:read': { bg: '#e0f2fe', color: '#0369a1' },
  'content:write': { bg: '#cffafe', color: '#0e7490' },
  'reports:read': { bg: '#f0fdf4', color: '#166534' },
  'audit:read': { bg: '#f5f3ff', color: '#5b21b6' },
};

@Component({
  selector: 'lib-role-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            class="search-input"
            type="text"
            placeholder="Search roles..."
            readonly
          />
        </div>
        <div class="toolbar-actions">
          <button class="btn-secondary">Export</button>
          <button class="btn-primary">+ Create Role</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ roles.length }}</div>
          <div class="stat-label">Total Roles</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ systemRoles }}</div>
          <div class="stat-label">System Roles</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ customRoles }}</div>
          <div class="stat-label">Custom Roles</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ uniquePermissions }}</div>
          <div class="stat-label">Unique Permissions</div>
        </div>
      </div>

      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Type</th>
              <th>Permissions</th>
              <th>Users</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (role of roles; track role.id) {
              <tr>
                <td>
                  <div class="role-name">{{ role.name }}</div>
                  <div class="role-desc">{{ role.description }}</div>
                </td>
                <td>
                  @if (role.isSystem) {
                    <span class="badge badge-system">System</span>
                  } @else {
                    <span class="badge badge-custom">Custom</span>
                  }
                </td>
                <td>
                  <div class="permissions-list">
                    @for (perm of role.permissions.slice(0, 3); track perm) {
                      <span
                        class="perm-tag"
                        [style.background]="permColor(perm).bg"
                        [style.color]="permColor(perm).color"
                        >{{ perm }}</span
                      >
                    }
                    @if (role.permissions.length > 3) {
                      <span class="perm-more"
                        >+{{ role.permissions.length - 3 }} more</span
                      >
                    }
                  </div>
                </td>
                <td>
                  <div class="user-count">
                    <span class="count-number">{{ role.userCount }}</span>
                    <span class="count-label">{{
                      role.userCount === 1 ? 'user' : 'users'
                    }}</span>
                  </div>
                </td>
                <td class="text-muted">{{ role.createdAt }}</td>
                <td>
                  <div class="row-actions">
                    @if (!role.isSystem) {
                      <button class="action-btn">Edit</button>
                      <button class="action-btn action-btn--danger">
                        Delete
                      </button>
                    } @else {
                      <button class="action-btn">View</button>
                      <span class="locked-badge">🔒 Protected</span>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 12px;
      width: 280px;
    }

    .search-icon {
      font-size: 0.875rem;
    }

    .search-input {
      border: none;
      outline: none;
      font-size: 0.875rem;
      color: #374151;
      background: transparent;
      width: 100%;
    }

    .toolbar-actions {
      display: flex;
      gap: 8px;
    }

    .btn-primary {
      padding: 8px 16px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-secondary {
      padding: 8px 16px;
      background: #fff;
      color: #374151;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .stat-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 16px 20px;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1a1d2e;
    }

    .stat-label {
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 2px;
    }

    .card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .data-table thead {
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .data-table th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .data-table td {
      padding: 14px 16px;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: middle;
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }
    .data-table tr:hover td {
      background: #fafafa;
    }

    .role-name {
      font-weight: 500;
      color: #111827;
    }
    .role-desc {
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 2px;
    }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .badge-system {
      background: #fef3c7;
      color: #92400e;
    }
    .badge-custom {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .permissions-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .perm-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 500;
      font-family: monospace;
    }

    .perm-more {
      font-size: 0.7rem;
      color: #6b7280;
      padding: 2px 0;
    }

    .user-count {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .count-number {
      font-weight: 600;
      color: #111827;
    }
    .count-label {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .text-muted {
      color: #6b7280;
    }

    .row-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .action-btn {
      padding: 4px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
      font-size: 0.75rem;
      color: #374151;
      cursor: pointer;
    }

    .action-btn--danger {
      color: #dc2626;
      border-color: #fecaca;
    }

    .locked-badge {
      font-size: 0.7rem;
      color: #9ca3af;
    }
  `,
})
export class RoleManagement {
  roles = MOCK_ROLES;

  permColor(perm: string) {
    return PERMISSION_COLORS[perm] ?? { bg: '#f3f4f6', color: '#374151' };
  }

  get systemRoles() {
    return this.roles.filter((r) => r.isSystem).length;
  }
  get customRoles() {
    return this.roles.filter((r) => !r.isSystem).length;
  }
  get uniquePermissions() {
    return new Set(this.roles.flatMap((r) => r.permissions)).size;
  }
}
