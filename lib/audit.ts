import { db } from '@/db/connection';
import { auditLog } from '@/db/schema';

// ─── Types ──────────────────────────────────────────────────────────────────

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';
type PerformedByType = 'admin' | 'user' | 'system';

interface AuditLogEntry {
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  performedBy?: string;
  performedByType?: PerformedByType;
  ipAddress?: string;
}

// ─── Core Logger ────────────────────────────────────────────────────────────

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await db.insert(auditLog).values({
    tableName: entry.tableName,
    recordId: entry.recordId,
    action: entry.action,
    oldData: entry.oldData ?? null,
    newData: entry.newData ?? null,
    changedFields: entry.changedFields ?? null,
    performedBy: entry.performedBy ?? null,
    performedByType: entry.performedByType ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}

// ─── Convenience Wrappers ───────────────────────────────────────────────────

export async function logCreate(
  tableName: string,
  recordId: string,
  newData: Record<string, unknown>,
  performedBy?: string,
  performedByType?: PerformedByType,
  ipAddress?: string,
): Promise<void> {
  await logAudit({
    tableName,
    recordId,
    action: 'INSERT',
    newData,
    performedBy,
    performedByType,
    ipAddress,
  });
}

export async function logUpdate(
  tableName: string,
  recordId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  performedBy?: string,
  performedByType?: PerformedByType,
  ipAddress?: string,
): Promise<void> {
  const changedFields = computeChangedFields(oldData, newData);
  await logAudit({
    tableName,
    recordId,
    action: 'UPDATE',
    oldData,
    newData,
    changedFields,
    performedBy,
    performedByType,
    ipAddress,
  });
}

export async function logDelete(
  tableName: string,
  recordId: string,
  oldData: Record<string, unknown>,
  performedBy?: string,
  performedByType?: PerformedByType,
  ipAddress?: string,
): Promise<void> {
  await logAudit({
    tableName,
    recordId,
    action: 'DELETE',
    oldData,
    performedBy,
    performedByType,
    ipAddress,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeChangedFields(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
): string[] {
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key);
    }
  }
  return changed;
}
