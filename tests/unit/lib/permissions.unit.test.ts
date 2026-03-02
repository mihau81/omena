import { describe, it, expect } from 'vitest';
import { hasPermission, getPermissions, requirePermission } from '@/lib/permissions';
import type { AdminRole, Permission } from '@/lib/permissions';

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

describe('hasPermission', () => {
  describe('super_admin', () => {
    it('has all permissions via wildcard', () => {
      for (const perm of ALL_PERMISSIONS) {
        expect(hasPermission('super_admin', perm)).toBe(true);
      }
    });

    it('has admins:manage', () => {
      expect(hasPermission('super_admin', 'admins:manage')).toBe(true);
    });

    it('has settings:manage', () => {
      expect(hasPermission('super_admin', 'settings:manage')).toBe(true);
    });
  });

  describe('admin role', () => {
    it('has auctions:read', () => {
      expect(hasPermission('admin', 'auctions:read')).toBe(true);
    });

    it('has auctions:write', () => {
      expect(hasPermission('admin', 'auctions:write')).toBe(true);
    });

    it('has invoices:manage', () => {
      expect(hasPermission('admin', 'invoices:manage')).toBe(true);
    });

    it('does NOT have admins:manage', () => {
      expect(hasPermission('admin', 'admins:manage')).toBe(false);
    });

    it('does NOT have settings:manage', () => {
      expect(hasPermission('admin', 'settings:manage')).toBe(false);
    });
  });

  describe('cataloguer role', () => {
    it('has auctions:read', () => {
      expect(hasPermission('cataloguer', 'auctions:read')).toBe(true);
    });

    it('has lots:read', () => {
      expect(hasPermission('cataloguer', 'lots:read')).toBe(true);
    });

    it('has lots:write', () => {
      expect(hasPermission('cataloguer', 'lots:write')).toBe(true);
    });

    it('has media:write', () => {
      expect(hasPermission('cataloguer', 'media:write')).toBe(true);
    });

    it('does NOT have auctions:write', () => {
      expect(hasPermission('cataloguer', 'auctions:write')).toBe(false);
    });

    it('does NOT have bids:enter', () => {
      expect(hasPermission('cataloguer', 'bids:enter')).toBe(false);
    });

    it('does NOT have users:read', () => {
      expect(hasPermission('cataloguer', 'users:read')).toBe(false);
    });
  });

  describe('auctioneer role', () => {
    it('has auctions:read', () => {
      expect(hasPermission('auctioneer', 'auctions:read')).toBe(true);
    });

    it('has auctions:status', () => {
      expect(hasPermission('auctioneer', 'auctions:status')).toBe(true);
    });

    it('has bids:enter', () => {
      expect(hasPermission('auctioneer', 'bids:enter')).toBe(true);
    });

    it('has bids:retract', () => {
      expect(hasPermission('auctioneer', 'bids:retract')).toBe(true);
    });

    it('has registrations:manage', () => {
      expect(hasPermission('auctioneer', 'registrations:manage')).toBe(true);
    });

    it('does NOT have lots:write', () => {
      expect(hasPermission('auctioneer', 'lots:write')).toBe(false);
    });

    it('does NOT have users:write', () => {
      expect(hasPermission('auctioneer', 'users:write')).toBe(false);
    });
  });

  describe('viewer role', () => {
    it('has auctions:read', () => {
      expect(hasPermission('viewer', 'auctions:read')).toBe(true);
    });

    it('has lots:read', () => {
      expect(hasPermission('viewer', 'lots:read')).toBe(true);
    });

    it('has users:read', () => {
      expect(hasPermission('viewer', 'users:read')).toBe(true);
    });

    it('has audit:read', () => {
      expect(hasPermission('viewer', 'audit:read')).toBe(true);
    });

    it('has reports:read', () => {
      expect(hasPermission('viewer', 'reports:read')).toBe(true);
    });

    it('does NOT have lots:write', () => {
      expect(hasPermission('viewer', 'lots:write')).toBe(false);
    });

    it('does NOT have bids:enter', () => {
      expect(hasPermission('viewer', 'bids:enter')).toBe(false);
    });

    it('does NOT have admins:manage', () => {
      expect(hasPermission('viewer', 'admins:manage')).toBe(false);
    });
  });
});

describe('getPermissions', () => {
  it('returns all 18 permissions for super_admin', () => {
    const perms = getPermissions('super_admin');
    expect(perms).toHaveLength(ALL_PERMISSIONS.length);
    for (const p of ALL_PERMISSIONS) {
      expect(perms).toContain(p);
    }
  });

  it('returns correct set for cataloguer', () => {
    const perms = getPermissions('cataloguer');
    expect(perms).toContain('auctions:read');
    expect(perms).toContain('lots:write');
    expect(perms).not.toContain('admins:manage');
    expect(perms).not.toContain('bids:enter');
  });

  it('returns correct set for viewer', () => {
    const perms = getPermissions('viewer');
    expect(perms).toContain('auctions:read');
    expect(perms).not.toContain('auctions:write');
  });

  it('does not return wildcard for super_admin', () => {
    const perms = getPermissions('super_admin');
    expect(perms).not.toContain('*');
  });
});

describe('requirePermission', () => {
  it('does not throw when role has permission', () => {
    expect(() => requirePermission('super_admin', 'admins:manage')).not.toThrow();
  });

  it('throws when role lacks permission', () => {
    expect(() => requirePermission('viewer', 'admins:manage')).toThrow(
      "Role 'viewer' lacks permission 'admins:manage'"
    );
  });

  it('throws with correct message for cataloguer missing bids:enter', () => {
    expect(() => requirePermission('cataloguer', 'bids:enter')).toThrow(/cataloguer/);
  });
});
