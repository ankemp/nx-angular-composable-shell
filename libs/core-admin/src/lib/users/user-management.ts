import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TitleCasePipe } from '@angular/common';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  group: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string;
  avatarInitials: string;
  avatarColor: string;
}

const MOCK_USERS: User[] = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice.johnson@acme.com',
    role: 'Admin',
    group: 'Engineering',
    status: 'active',
    lastLogin: '2 hours ago',
    avatarInitials: 'AJ',
    avatarColor: '#6366f1',
  },
  {
    id: 2,
    name: 'Bob Martinez',
    email: 'bob.martinez@acme.com',
    role: 'Editor',
    group: 'Marketing',
    status: 'active',
    lastLogin: '1 day ago',
    avatarInitials: 'BM',
    avatarColor: '#0ea5e9',
  },
  {
    id: 3,
    name: 'Carol White',
    email: 'carol.white@acme.com',
    role: 'Viewer',
    group: 'Finance',
    status: 'pending',
    lastLogin: 'Never',
    avatarInitials: 'CW',
    avatarColor: '#f59e0b',
  },
  {
    id: 4,
    name: 'David Kim',
    email: 'david.kim@acme.com',
    role: 'Editor',
    group: 'Engineering',
    status: 'active',
    lastLogin: '3 days ago',
    avatarInitials: 'DK',
    avatarColor: '#10b981',
  },
  {
    id: 5,
    name: 'Eva Chen',
    email: 'eva.chen@acme.com',
    role: 'Admin',
    group: 'Operations',
    status: 'active',
    lastLogin: '5 minutes ago',
    avatarInitials: 'EC',
    avatarColor: '#ec4899',
  },
  {
    id: 6,
    name: 'Frank Okafor',
    email: 'frank.okafor@acme.com',
    role: 'Viewer',
    group: 'Sales',
    status: 'inactive',
    lastLogin: '2 months ago',
    avatarInitials: 'FO',
    avatarColor: '#8b5cf6',
  },
  {
    id: 7,
    name: 'Grace Lee',
    email: 'grace.lee@acme.com',
    role: 'Editor',
    group: 'Marketing',
    status: 'active',
    lastLogin: '1 week ago',
    avatarInitials: 'GL',
    avatarColor: '#14b8a6',
  },
];

@Component({
  selector: 'lib-user-management',
  standalone: true,
  imports: [TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            class="search-input"
            type="text"
            placeholder="Search users..."
            readonly
          />
        </div>
        <div class="toolbar-actions">
          <button class="btn-secondary">Export</button>
          <button class="btn-primary">+ Invite User</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ users.length }}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ activeCount }}</div>
          <div class="stat-label">Active</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ pendingCount }}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ inactiveCount }}</div>
          <div class="stat-label">Inactive</div>
        </div>
      </div>

      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Group</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users; track user.id) {
              <tr>
                <td>
                  <div class="user-cell">
                    <div class="avatar" [style.background]="user.avatarColor">
                      {{ user.avatarInitials }}
                    </div>
                    <div class="user-info">
                      <div class="user-name">{{ user.name }}</div>
                      <div class="user-email">{{ user.email }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    class="role-badge"
                    [class]="'role-' + user.role.toLowerCase()"
                  >
                    {{ user.role }}
                  </span>
                </td>
                <td class="text-muted">{{ user.group }}</td>
                <td>
                  <span
                    class="status-dot"
                    [class]="'status-' + user.status"
                  ></span>
                  <span class="status-label">{{
                    user.status | titlecase
                  }}</span>
                </td>
                <td class="text-muted">{{ user.lastLogin }}</td>
                <td>
                  <div class="row-actions">
                    <button class="action-btn">Edit</button>
                    <button class="action-btn action-btn--danger">
                      Remove
                    </button>
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

    .user-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .user-name {
      font-weight: 500;
      color: #111827;
    }
    .user-email {
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 1px;
    }

    .role-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .role-admin {
      background: #ede9fe;
      color: #6d28d9;
    }
    .role-editor {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .role-viewer {
      background: #f3f4f6;
      color: #374151;
    }

    .text-muted {
      color: #6b7280;
    }

    .status-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }

    .status-active {
      background: #10b981;
    }
    .status-inactive {
      background: #d1d5db;
    }
    .status-pending {
      background: #f59e0b;
    }

    .status-label {
      text-transform: capitalize;
    }

    .row-actions {
      display: flex;
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
  `,
})
export class UserManagement {
  users = MOCK_USERS;
  get activeCount() {
    return this.users.filter((u) => u.status === 'active').length;
  }
  get pendingCount() {
    return this.users.filter((u) => u.status === 'pending').length;
  }
  get inactiveCount() {
    return this.users.filter((u) => u.status === 'inactive').length;
  }
}
