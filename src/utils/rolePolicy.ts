import { UserRole } from '../types';

export const USER_ROLES: UserRole[] = ['student', 'instructor', 'admin', 'superadmin'];

/** Roles that can use the admin dashboard APIs (not superadmin-only management). */
export const ADMIN_PANEL_ROLES: UserRole[] = ['admin', 'superadmin'];

export const ASSIGNABLE_BY_ADMIN: UserRole[] = ['student', 'instructor'];

export function hasAdminPanelAccess(role: UserRole): boolean {
  return ADMIN_PANEL_ROLES.includes(role);
}

export function isSuperadmin(role: UserRole): boolean {
  return role === 'superadmin';
}

/** Only superadmin may create users with role admin or superadmin. */
export function canCreateAdminUser(actorRole: UserRole): boolean {
  return actorRole === 'superadmin';
}

/** Whether actor may assign `targetRole` to another user. */
export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === 'superadmin') {
    return actorRole === 'superadmin';
  }
  if (targetRole === 'admin') {
    return actorRole === 'superadmin';
  }
  if (actorRole === 'superadmin') {
    return USER_ROLES.includes(targetRole);
  }
  if (actorRole === 'admin') {
    return ASSIGNABLE_BY_ADMIN.includes(targetRole);
  }
  return false;
}

export function isValidUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}
