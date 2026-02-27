import { getAuctions } from '@/db/queries';
import { mapDBAuctionToFrontend } from '@/lib/mappers';
import AuctionsClient from './AuctionsClient';

export const dynamic = 'force-dynamic';

export default async function AuctionsPage() {
  const dbAuctions = await getAuctions(0);
  const auctions = dbAuctions.map((row) =>
    mapDBAuctionToFrontend(row, {
      lotCount: row.lotCount,
      coverImageUrl: row.coverImageUrl ?? undefined,
    }),
  );

  return <AuctionsClient auctions={auctions} />;
}
