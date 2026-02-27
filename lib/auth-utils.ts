import { auth } from '@/lib/auth';
import { hasPermission, type AdminRole, type Permission } from '@/lib/permissions';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError('Authentication required', 401);
  }
  return session.user;
}

export async function requireAdmin(permission?: Permission) {
  const user = await requireAuth();

  if (user.userType !== 'admin') {
    throw new AuthError('Admin access required', 403);
  }

  if (permission && user.role) {
    if (!hasPermission(user.role as AdminRole, permission)) {
      throw new AuthError(`Missing permission: ${permission}`, 403);
    }
  }

  return user;
}
