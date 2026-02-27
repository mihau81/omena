import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import {
  getSalesSummary,
  getUserActivitySummary,
  getRevenueByAuction,
  getOverallStats,
} from '@/db/queries/reports';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin('reports:read');

    // Get all reports data
    const [salesSummary, userActivity, revenueByAuction, overallStats] = await Promise.all([
      getSalesSummary(),
      getUserActivitySummary(),
      getRevenueByAuction(),
      getOverallStats(),
    ]);

    return NextResponse.json({
      salesSummary,
      userActivity,
      revenueByAuction,
      overallStats,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Get reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
