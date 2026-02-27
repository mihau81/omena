import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getAuditLog } from '@/db/queries/audit';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('audit:read');

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const tableName = searchParams.get('tableName') || undefined;
    const action = searchParams.get('action') || undefined;
    const performedBy = searchParams.get('performedBy') || undefined;
    const recordId = searchParams.get('recordId') || undefined;
    const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined;
    const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined;

    const result = await getAuditLog({
      tableName,
      action,
      performedBy,
      recordId,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    // Serialize dates for JSON
    const serialized = {
      ...result,
      data: result.data.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Audit log API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
