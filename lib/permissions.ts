import type { adminRoleEnum } from '@/db/schema';

type AdminRole = (typeof adminRoleEnum.enumValues)[number];

type Permission =
  | 'auctions:read' | 'auctions:write' | 'auctions:status'
  | 'lots:read' | 'lots:write' | 'lots:order'
  | 'media:write'
  | 'bids:enter' | 'bids:retract'
  | 'users:read' | 'users:write' | 'users:visibility'
  | 'registrations:manage'
  | 'audit:read'
  | 'admins:manage'
  | 'settings:manage'
  | 'reports:read'
  | 'invoices:manage';

const ALL_PERMISSIONS: Permission[] = [
  'auctions:read', 'auctions:write', 'auctions:status',
  'lots:read', 'lots:write', 'lots:order',
  'media:write',
  'bids:enter', 'bids:retract',
  'users:read', 'users:write', 'users:visibility',
  'registrations:manage',
  'audit:read',
  'admins:manage',
  'settings:manage',
  'reports:read',
  'invoices:manage',
];

type WildcardPermission = '*';

const ROLE_PERMISSIONS: Record<AdminRole, Permission[] | WildcardPermission[]> = {
  super_admin: ['*'],  // All permissions
  admin: [
    'auctions:read', 'auctions:write', 'auctions:status',
    'lots:read', 'lots:write', 'lots:order', 'media:write',
    'bids:enter', 'bids:retract',
    'users:read', 'users:write', 'users:visibility',
    'registrations:manage', 'audit:read', 'reports:read',
    'invoices:manage',
  ],
  cataloguer: [
    'auctions:read', 'lots:read', 'lots:write', 'lots:order', 'media:write',
  ],
  auctioneer: [
    'auctions:read', 'auctions:status',
    'lots:read', 'bids:enter', 'bids:retract',
    'registrations:manage',
  ],
  viewer: [
    'auctions:read', 'lots:read', 'users:read', 'audit:read', 'reports:read',
  ],
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if ((perms as WildcardPermission[]).includes('*')) return true;
  return (perms as Permission[]).includes(permission);
}

export function requirePermission(role: AdminRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role '${role}' lacks permission '${permission}'`);
  }
}

export function getPermissions(role: AdminRole): Permission[] {
  const perms = ROLE_PERMISSIONS[role];
  if ((perms as WildcardPermission[]).includes('*')) return ALL_PERMISSIONS;
  return perms as Permission[];
}

export type { AdminRole, Permission };
