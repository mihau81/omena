import { eq, desc, count, and, gte, lte, or } from 'drizzle-orm';
import { db } from '../connection';
import { userLogins, pageViews } from '../schema';

// ─── User Login History (paginated) ─────────────────────────────────────────

export async function getUserLoginsPaginated(userId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: userLogins.id,
        email: userLogins.email,
        ipAddress: userLogins.ipAddress,
        userAgent: userLogins.userAgent,
        countryCode: userLogins.countryCode,
        city: userLogins.city,
        success: userLogins.success,
        failReason: userLogins.failReason,
        loginMethod: userLogins.loginMethod,
        createdAt: userLogins.createdAt,
      })
      .from(userLogins)
      .where(eq(userLogins.userId, userId))
      .orderBy(desc(userLogins.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(userLogins)
      .where(eq(userLogins.userId, userId)),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}

// ─── Login history by email (catches failed logins for non-existent userId) ─

export async function getLoginsByEmailPaginated(email: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: userLogins.id,
        email: userLogins.email,
        ipAddress: userLogins.ipAddress,
        userAgent: userLogins.userAgent,
        countryCode: userLogins.countryCode,
        city: userLogins.city,
        success: userLogins.success,
        failReason: userLogins.failReason,
        loginMethod: userLogins.loginMethod,
        createdAt: userLogins.createdAt,
      })
      .from(userLogins)
      .where(eq(userLogins.email, email))
      .orderBy(desc(userLogins.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(userLogins)
      .where(eq(userLogins.email, email)),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}

// ─── User Page Views (paginated) ────────────────────────────────────────────

export async function getUserPageViewsPaginated(userId: string, page = 1, limit = 30) {
  const offset = (page - 1) * limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: pageViews.id,
        path: pageViews.path,
        ipAddress: pageViews.ipAddress,
        userAgent: pageViews.userAgent,
        createdAt: pageViews.createdAt,
      })
      .from(pageViews)
      .where(eq(pageViews.userId, userId))
      .orderBy(desc(pageViews.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(pageViews)
      .where(eq(pageViews.userId, userId)),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}
