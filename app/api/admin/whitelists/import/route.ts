import { NextResponse } from 'next/server';
import { db } from '@/db/connection';
import { userWhitelists } from '@/db/schema';
import { requireAdmin } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin('users:write');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());

    // Skip header if present
    const startIdx = lines[0]?.toLowerCase().includes('email') ? 1 : 0;

    // Parse all rows first
    const rows: { email: string; name: string | null; notes: string | null }[] = [];
    let skipped = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      const email = parts[0];
      const name = parts[1] || null;
      const notes = parts[2] || null;

      if (!email || !email.includes('@')) {
        skipped++;
        continue;
      }
      rows.push({ email, name, notes });
    }

    // Batch insert (50 at a time)
    let imported = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const result = await db
        .insert(userWhitelists)
        .values(batch.map((r) => ({ ...r, importedBy: admin.id })))
        .onConflictDoNothing({ target: userWhitelists.email })
        .returning({ id: userWhitelists.id });
      imported += result.length;
    }
    skipped += rows.length - imported;

    return NextResponse.json({ imported, skipped });
  } catch (error) {
    return handleApiError(error, 'whitelists/import');
  }
}
