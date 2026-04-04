import { Route } from '@angular/router';
import { CoreAdminShell } from './core-admin-shell/core-admin-shell';
import { UserManagement } from './users/user-management';
import { GroupManagement } from './groups/group-management';
import { RoleManagement } from './roles/role-management';

export function coreAdminRoutes(extensions: Route[] = []): Route[] {
  return [
    {
      path: '',
      component: CoreAdminShell,
      children: [
        { path: '', redirectTo: 'users', pathMatch: 'full' },
        {
          path: 'users',
          component: UserManagement,
          data: { title: 'User Management', icon: '👤' },
        },
        {
          path: 'groups',
          component: GroupManagement,
          data: { title: 'Group Management', icon: '👥' },
        },
        {
          path: 'roles',
          component: RoleManagement,
          data: { title: 'Role Management', icon: '🔑' },
        },
        ...extensions,
      ],
    },
  ];
}
