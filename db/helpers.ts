import { isNull, lte, or, and, isNotNull, sql } from 'drizzle-orm';
import { auctions, lots, type visibilityLevelEnum } from './schema';

type VisibilityLevel = (typeof visibilityLevelEnum.enumValues)[number];

export function notDeleted<T extends { deletedAt: any }>(table: T) {
  return isNull(table.deletedAt);
}

export function auctionVisibilityFilter(userVisibility: number) {
  const level = String(userVisibility) as VisibilityLevel;
  return and(
    lte(auctions.visibilityLevel, level),
    isNull(auctions.deletedAt),
  );
}

export function lotVisibilityFilter(userVisibility: number) {
  const level = String(userVisibility) as VisibilityLevel;
  // If lot has visibilityOverride, use it. Otherwise, inherit from auction.
  return and(
    isNull(lots.deletedAt),
    or(
      // Lot has explicit override — check against user level
      and(
        isNotNull(lots.visibilityOverride),
        lte(lots.visibilityOverride, level),
      ),
      // Lot inherits from auction — auction visibility already checked
      and(
        isNull(lots.visibilityOverride),
        lte(auctions.visibilityLevel, level),
      ),
    ),
  );
}
