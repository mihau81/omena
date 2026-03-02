import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/auth-utils';

/**
 * Standard error handler for API routes.
 * Handles AuthError with proper status codes, logs others as 500.
 */
export function handleApiError(error: unknown, context: string): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  console.error(`[${context}] Error:`, error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
