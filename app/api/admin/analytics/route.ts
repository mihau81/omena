import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import {
  getSellThroughRate,
  getHammerToEstimateRatio,
  getRevenueTrends,
  getTopArtists,
  getBidActivity,
  getUserActivityStats,
  getAuctionComparison,
  getLotPerformance,
} from '@/db/queries/analytics';
import { getOverallStats } from '@/db/queries/reports';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('reports:read');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'overview';
    const rawAuctionId = searchParams.get('auctionId') ?? undefined;
    const auctionId = rawAuctionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAuctionId)
      ? rawAuctionId
      : undefined;

    switch (type) {
      case 'overview': {
        const [overallStats, sellThrough, hammerRatio, userStats] = await Promise.all([
          getOverallStats(),
          getSellThroughRate(),
          getHammerToEstimateRatio(),
          getUserActivityStats(),
        ]);

        const avgRatio =
          hammerRatio.length > 0
            ? Math.round(
                (hammerRatio.reduce((s, r) => s + (r.avgHammerToEstimateRatio ?? 0), 0) /
                  hammerRatio.length) *
                  100,
              ) / 100
            : null;

        return NextResponse.json({
          totalRevenue: overallStats.totalRevenue,
          totalLots: overallStats.totalLots,
          soldLots: overallStats.soldLots,
          overallSellThroughRate: overallStats.overallSellThroughRate,
          activeUsers: overallStats.activeUsers,
          pendingRegistrations: overallStats.pendingRegistrations,
          avgHammerToEstimateRatio: avgRatio,
          newUsersLast30Days: userStats.newUsersLast30Days,
          activeBiddersLast30Days: userStats.activeBiddersLast30Days,
        });
      }

      case 'revenue': {
        const months = Number(searchParams.get('months') ?? '12');
        const trends = await getRevenueTrends(Math.max(1, Math.min(months, 60)));
        return NextResponse.json({ trends });
      }

      case 'artists': {
        const limit = Number(searchParams.get('limit') ?? '20');
        const artists = await getTopArtists(Math.max(1, Math.min(limit, 100)));
        return NextResponse.json({ artists });
      }

      case 'activity': {
        const days = Number(searchParams.get('days') ?? '30');
        const activity = await getBidActivity(auctionId, Math.max(1, Math.min(days, 365)));
        return NextResponse.json(activity);
      }

      case 'users': {
        const userStats = await getUserActivityStats();
        return NextResponse.json(userStats);
      }

      case 'comparison': {
        const comparison = await getAuctionComparison();
        return NextResponse.json({ auctions: comparison });
      }

      case 'lot-performance': {
        const performance = await getLotPerformance(auctionId);
        return NextResponse.json({ performance });
      }

      default:
        return NextResponse.json({ error: 'Unknown analytics type' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
