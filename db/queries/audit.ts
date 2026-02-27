import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';
import { db } from '../connection';
import { auditLog } from '../schema';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuditLogFilters {
  tableName?: string;
  recordId?: string;
  action?: string;
  performedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getAuditLog(filters: AuditLogFilters = {}) {
  const { page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  const conditions = buildConditions(filters);

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(auditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}

export async function getAuditLogForRecord(tableName: string, recordId: string) {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.tableName, tableName), eq(auditLog.recordId, recordId)))
    .orderBy(desc(auditLog.createdAt));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildConditions(filters: AuditLogFilters) {
  const conditions = [];

  if (filters.tableName) {
    conditions.push(eq(auditLog.tableName, filters.tableName));
  }
  if (filters.recordId) {
    conditions.push(eq(auditLog.recordId, filters.recordId));
  }
  if (filters.action) {
    conditions.push(eq(auditLog.action, filters.action));
  }
  if (filters.performedBy) {
    conditions.push(eq(auditLog.performedBy, filters.performedBy));
  }
  if (filters.dateFrom) {
    conditions.push(gte(auditLog.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(auditLog.createdAt, filters.dateTo));
  }

  return conditions;
}
