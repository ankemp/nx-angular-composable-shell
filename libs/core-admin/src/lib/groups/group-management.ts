import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Group {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  type: 'team' | 'department' | 'project';
  owner: string;
  createdAt: string;
  icon: string;
}

const MOCK_GROUPS: Group[] = [
  {
    id: 1,
    name: 'Engineering',
    description: 'Core product engineering team',
    memberCount: 18,
    type: 'department',
    owner: 'Alice Johnson',
    createdAt: 'Jan 12, 2024',
    icon: '⚙️',
  },
  {
    id: 2,
    name: 'Marketing',
    description: 'Brand, growth, and content team',
    memberCount: 9,
    type: 'department',
    owner: 'Bob Martinez',
    createdAt: 'Jan 12, 2024',
    icon: '📣',
  },
  {
    id: 3,
    name: 'Finance',
    description: 'Finance and accounting operations',
    memberCount: 6,
    type: 'department',
    owner: 'Carol White',
    createdAt: 'Feb 3, 2024',
    icon: '💼',
  },
  {
    id: 4,
    name: 'Operations',
    description: 'Infrastructure and platform ops',
    memberCount: 11,
    type: 'department',
    owner: 'Eva Chen',
    createdAt: 'Jan 12, 2024',
    icon: '🖥️',
  },
  {
    id: 5,
    name: 'Sales',
    description: 'Revenue and client acquisition',
    memberCount: 14,
    type: 'department',
    owner: 'Frank Okafor',
    createdAt: 'Mar 1, 2024',
    icon: '📈',
  },
  {
    id: 6,
    name: 'Project Phoenix',
    description: 'Cross-functional product launch team',
    memberCount: 7,
    type: 'project',
    owner: 'David Kim',
    createdAt: 'Jun 15, 2024',
    icon: '🚀',
  },
  {
    id: 7,
    name: 'Platform Team',
    description: 'Shared platform and tooling squad',
    memberCount: 5,
    type: 'team',
    owner: 'Alice Johnson',
    createdAt: 'Apr 22, 2024',
    icon: '🔧',
  },
];

@Component({
  selector: 'lib-group-management',
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
            placeholder="Search groups..."
            readonly
          />
        </div>
        <div class="toolbar-actions">
          <button class="btn-secondary">Export</button>
          <button class="btn-primary">+ Create Group</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ groups.length }}</div>
          <div class="stat-label">Total Groups</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalMembers }}</div>
          <div class="stat-label">Total Members</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ departmentCount }}</div>
          <div class="stat-label">Departments</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ projectCount }}</div>
          <div class="stat-label">Projects / Teams</div>
        </div>
      </div>

      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Type</th>
              <th>Members</th>
              <th>Owner</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (group of groups; track group.id) {
              <tr>
                <td>
                  <div class="group-cell">
                    <div class="group-icon-wrap">{{ group.icon }}</div>
                    <div class="group-info">
                      <div class="group-name">{{ group.name }}</div>
                      <div class="group-desc">{{ group.description }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="type-badge" [class]="'type-' + group.type">
                    {{ group.type }}
                  </span>
                </td>
                <td>
                  <div class="member-count">
                    <span class="count-number">{{ group.memberCount }}</span>
                    <span class="count-label">members</span>
                  </div>
                </td>
                <td class="text-muted">{{ group.owner }}</td>
                <td class="text-muted">{{ group.createdAt }}</td>
                <td>
                  <div class="row-actions">
                    <button class="action-btn">Manage</button>
                    <button class="action-btn">Edit</button>
                    <button class="action-btn action-btn--danger">
                      Delete
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

    .group-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .group-icon-wrap {
      width: 36px;
      height: 36px;
      background: #f0f0ff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .group-name {
      font-weight: 500;
      color: #111827;
    }
    .group-desc {
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 1px;
    }

    .type-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: capitalize;
    }

    .type-department {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .type-team {
      background: #d1fae5;
      color: #065f46;
    }
    .type-project {
      background: #fef3c7;
      color: #92400e;
    }

    .member-count {
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
export class GroupManagement {
  groups = MOCK_GROUPS;
  get totalMembers() {
    return this.groups.reduce((sum, g) => sum + g.memberCount, 0);
  }
  get departmentCount() {
    return this.groups.filter((g) => g.type === 'department').length;
  }
  get projectCount() {
    return this.groups.filter((g) => g.type !== 'department').length;
  }
}
